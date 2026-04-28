import { describe, expect, it } from 'vitest';
import type { PhaseConfig, PlannedSession } from '../src';
import {
  buildWeeklyVolumeSummary,
  generatePlan,
  propagateChange,
  representativeSessionPaceSeconds,
  sessionKm,
} from '../src';

const PHASES: PhaseConfig = { BASE: 0, BUILD: 4, RECOVERY: 0, PEAK: 0, TAPER: 0 };

function easy(overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'easy-template',
    type: 'EASY',
    date: '2026-04-06',
    distance: 8,
    pace: '5:20',
    intensityTarget: {
      source: 'manual',
      mode: 'effort',
      profileKey: 'easy',
      effortCue: 'conversational',
    },
    ...overrides,
  };
}

function interval(overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'interval-template',
    type: 'INTERVAL',
    date: '2026-04-06',
    reps: 6,
    repDist: 800,
    recovery: '90s',
    warmup: { unit: 'km', value: 1 },
    cooldown: { unit: 'km', value: 1 },
    pace: '3:50',
    intensityTarget: {
      source: 'manual',
      mode: 'pace',
      profileKey: 'interval',
      paceRange: { min: '3:45', max: '3:55' },
      effortCue: 'hard repeatable',
    },
    ...overrides,
  };
}

describe('intensity target plan flow', () => {
  it('retains template intensity metadata when generating progressed weeks', () => {
    const plan = generatePlan([easy()], 4, 10, PHASES);

    expect(plan[0].sessions[0]).toMatchObject({
      distance: 8,
      pace: '5:20',
      intensityTarget: {
        mode: 'effort',
        profileKey: 'easy',
        effortCue: 'conversational',
      },
    });
    expect(plan[2].sessions[0]).toMatchObject({
      distance: 9,
      intensityTarget: plan[0].sessions[0]!.intensityTarget,
    });
  });

  it('converts legacy template pace to a structured target instead of using type defaults', () => {
    const plan = generatePlan([
      interval({
        pace: '3:40',
        intensityTarget: undefined,
      }),
    ], 1, 0, { BASE: 1, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 });

    expect(plan[0].sessions[0]).toMatchObject({
      pace: '3:40',
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        pace: '3:40',
      },
    });
  });

  it('propagates target metadata while preserving distance progression', () => {
    const template = [easy()];
    const plan = generatePlan(template, 4, 10, PHASES);
    const progressedDistance = plan[3].sessions[0]!.distance!;
    const updated = {
      ...plan[0].sessions[0]!,
      distance: 10,
      pace: undefined,
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        profileKey: 'steady',
        paceRange: { min: '5:00', max: '5:20' },
        effortCue: 'steady',
      },
    } satisfies PlannedSession;

    const result = propagateChange(plan, 0, 0, updated, 'remaining', template);

    expect(result[0].sessions[0]).toMatchObject({
      distance: 10,
      pace: '5:10',
    });
    expect(result[3].sessions[0]).toMatchObject({
      distance: progressedDistance + 2,
      pace: '5:10',
      intensityTarget: {
        profileKey: 'steady',
        paceRange: { min: '5:00', max: '5:20' },
        effortCue: 'steady',
      },
    });
  });

  it('uses structured representative pace for interval minute reps', () => {
    const workout = interval({
      reps: 4,
      repDist: undefined,
      repDuration: { unit: 'min', value: 4 },
      recovery: undefined,
      warmup: undefined,
      cooldown: undefined,
      pace: undefined,
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        paceRange: { min: '4:00', max: '4:20' },
      },
    });

    expect(representativeSessionPaceSeconds(workout)).toBe(250);
    expect(sessionKm(workout)).toBe(3.8);
  });

  it('uses structured representative pace for weekly planned time estimates', () => {
    const summary = buildWeeklyVolumeSummary({
      today: '2026-04-06',
      weekStartDate: '2026-04-06',
      sessions: [
        easy({
          id: 'structured-easy',
          distance: 10,
          pace: undefined,
          intensityTarget: {
            source: 'manual',
            mode: 'pace',
            paceRange: { min: '5:00', max: '5:20' },
          },
        }),
      ],
    });

    expect(summary.days[0].plannedSeconds).toBe(3100);
  });
});
