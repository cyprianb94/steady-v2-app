import { describe, it, expect } from 'vitest';
import { generateHomeAnnotations, type AnnotationInput } from '../src/lib/annotation-engine';
import type { PlannedSession } from '@steady/types';

function makeSession(type: PlannedSession['type'], distance?: number, id = `s-${type}`): PlannedSession {
  return {
    id,
    type,
    date: '2026-04-09',
    distance,
    pace: '5:00',
  };
}

function makeInput(overrides: Partial<AnnotationInput> = {}): AnnotationInput {
  return {
    todaySession: makeSession('EASY', 8),
    tomorrowSession: makeSession('EASY', 8),
    phase: 'BASE',
    weekNumber: 5,
    totalWeeks: 20,
    allSessions: [
      makeSession('EASY', 8, 'mon'),
      makeSession('INTERVAL', undefined, 'tue'),
      makeSession('EASY', 6, 'wed'),
      null,
      makeSession('TEMPO', 10, 'fri'),
      makeSession('LONG', 16, 'sat'),
      null,
    ],
    ...overrides,
  };
}

describe('generateHomeAnnotations', () => {
  it('keeps tomorrow-focused guidance out of the inline note path', () => {
    const result = generateHomeAnnotations(makeInput({
      phase: 'BUILD',
      todaySession: makeSession('EASY', 8, 'today-easy'),
      tomorrowSession: makeSession('INTERVAL', undefined, 'tomorrow-interval'),
      allSessions: [
        makeSession('EASY', 8, 'today-easy'),
        makeSession('INTERVAL', undefined, 'tomorrow-interval'),
        null,
        null,
        null,
        null,
        null,
      ],
    }));

    expect(result.todayAnnotation).toMatch(/volume is climbing|recover well/i);
    expect(result.coachAnnotation).toMatch(/intervals tomorrow|conversational/i);
  });

  it('surfaces back-to-back quality risk as broader coach guidance', () => {
    const tempo = makeSession('TEMPO', 10, 'today-tempo');
    const result = generateHomeAnnotations(makeInput({
      todaySession: tempo,
      tomorrowSession: makeSession('INTERVAL', undefined, 'tomorrow-interval'),
      allSessions: [
        makeSession('EASY', 8, 'mon'),
        tempo,
        makeSession('INTERVAL', undefined, 'wed'),
        null,
        makeSession('EASY', 6, 'fri'),
        makeSession('LONG', 16, 'sat'),
        null,
      ],
    }));

    expect(result.todayAnnotation).toMatch(/tempo|rhythm|confidence/i);
    expect(result.coachAnnotation).toMatch(/back-to-back|swapping|heavy/i);
  });

  it('keeps long-run advice in the inline note path', () => {
    const longRun = makeSession('LONG', 22, 'long');
    const result = generateHomeAnnotations(makeInput({
      todaySession: longRun,
      allSessions: [
        makeSession('EASY', 8, 'mon'),
        makeSession('INTERVAL', undefined, 'tue'),
        makeSession('EASY', 6, 'wed'),
        null,
        makeSession('TEMPO', 10, 'fri'),
        longRun,
        null,
      ],
    }));

    expect(result.todayAnnotation).toMatch(/fuel|slow|longest/i);
    expect(result.coachAnnotation).toBeNull();
  });

  it('keeps recovery weeks to a single inline note', () => {
    const result = generateHomeAnnotations(makeInput({
      phase: 'RECOVERY',
    }));

    expect(result.todayAnnotation).toMatch(/recover|lower|intentional/i);
    expect(result.coachAnnotation).toBeNull();
  });

  it('keeps rest-day advice inline while still allowing tomorrow guidance below', () => {
    const result = generateHomeAnnotations(makeInput({
      todaySession: null,
      tomorrowSession: makeSession('INTERVAL', undefined, 'tomorrow-interval'),
      allSessions: [
        null,
        makeSession('INTERVAL', undefined, 'tomorrow-interval'),
        null,
        null,
        null,
        null,
        null,
      ],
    }));

    expect(result.todayAnnotation).toMatch(/rest day|recovery/i);
    expect(result.coachAnnotation).toMatch(/intervals tomorrow|conversational/i);
  });

  it('uses the first-week confidence note inline when no stronger today rule fires', () => {
    const result = generateHomeAnnotations(makeInput({
      todaySession: makeSession('EASY', 8),
      tomorrowSession: null,
      weekNumber: 1,
      allSessions: [
        makeSession('EASY', 8, 'mon'),
        null,
        null,
        null,
        null,
        null,
        null,
      ],
    }));

    expect(result.todayAnnotation).toMatch(/first week|consistency/i);
    expect(result.coachAnnotation).toBeNull();
  });
});
