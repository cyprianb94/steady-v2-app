import { describe, it, expect } from 'vitest';
import { generateAnnotation, type AnnotationInput } from '../src/lib/annotation-engine';
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
      makeSession('EASY', 8),
      makeSession('INTERVAL'),
      makeSession('EASY', 6),
      null,
      makeSession('TEMPO', 10),
      makeSession('LONG', 16),
      null,
    ],
    ...overrides,
  };
}

describe('generateAnnotation', () => {
  it('warns to keep it easy when intervals are tomorrow', () => {
    const result = generateAnnotation(makeInput({
      todaySession: makeSession('EASY', 8),
      tomorrowSession: makeSession('INTERVAL'),
    }));
    expect(result).toMatch(/conversational|easy/i);
  });

  it('warns on back-to-back quality days', () => {
    const tempo = makeSession('TEMPO', 10, 'today-tempo');
    const result = generateAnnotation(makeInput({
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

    expect(result).toMatch(/back-to-back|swapping|heavy/i);
  });

  it('gives long run advice for the longest run of the week', () => {
    const longRun = makeSession('LONG', 22, 'long');
    const result = generateAnnotation(makeInput({
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
    expect(result).toMatch(/fuel|slow|longest/i);
  });

  it('notes recovery week when phase is RECOVERY', () => {
    const result = generateAnnotation(makeInput({
      phase: 'RECOVERY',
    }));
    expect(result).toMatch(/recover|lower|intentional/i);
  });

  it('highlights key session for intervals', () => {
    const result = generateAnnotation(makeInput({
      todaySession: makeSession('INTERVAL'),
      tomorrowSession: makeSession('EASY', 6),
    }));
    expect(result).toMatch(/key|adaptation|quality/i);
  });

  it('highlights key session for tempo days', () => {
    const result = generateAnnotation(makeInput({
      todaySession: makeSession('TEMPO', 10),
      tomorrowSession: makeSession('EASY', 6),
      allSessions: [
        makeSession('EASY', 8, 'mon'),
        makeSession('EASY', 8, 'tue'),
        makeSession('TEMPO', 10),
        null,
        makeSession('EASY', 6, 'fri'),
        makeSession('LONG', 16, 'sat'),
        null,
      ],
    }));
    expect(result).toMatch(/tempo|rhythm|confidence/i);
  });

  it('gives rest day advice on rest days', () => {
    const result = generateAnnotation(makeInput({
      todaySession: null,
    }));
    expect(result).toMatch(/rest|recover/i);
  });

  it('falls back to phase-level annotation when no specific rule fires', () => {
    const result = generateAnnotation(makeInput({
      todaySession: makeSession('EASY', 8),
      tomorrowSession: null, // rest tomorrow, not intervals
      phase: 'BUILD',
    }));
    // Should still return something meaningful
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(10);
  });

  it('handles the first week with a specific confidence note', () => {
    const result = generateAnnotation(makeInput({
      todaySession: makeSession('EASY', 8),
      tomorrowSession: null,
      weekNumber: 1,
    }));

    expect(result).toMatch(/first week|consistency/i);
  });

  it('handles the final week without needing a tomorrow session', () => {
    const result = generateAnnotation(makeInput({
      todaySession: makeSession('EASY', 6),
      tomorrowSession: null,
      weekNumber: 20,
      totalWeeks: 20,
    }));

    expect(result).toMatch(/final week|freshness|race/i);
  });
});
