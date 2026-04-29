import { describe, expect, it } from 'vitest';
import type { PhaseConfig, PlannedSession, PlanWeek } from '../src';
import { generatePlan, propagateChange, sessionKm, weekKm } from '../src';

function easy(distance = 8): PlannedSession {
  return {
    id: `easy-${distance}`,
    type: 'EASY',
    date: '2026-01-01',
    distance,
    pace: '5:20',
  };
}

function tempo(distance = 10, warmup = 1.5, cooldown = 1): PlannedSession {
  return {
    id: `tempo-${distance}`,
    type: 'TEMPO',
    date: '2026-01-01',
    distance,
    pace: '4:20',
    warmup: { unit: 'km', value: warmup },
    cooldown: { unit: 'km', value: cooldown },
  };
}

function interval(overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'interval',
    type: 'INTERVAL',
    date: '2026-01-01',
    reps: 6,
    repDuration: { unit: 'km', value: 0.8 },
    repDist: 800,
    recovery: { unit: 'min', value: 1.5 },
    warmup: { unit: 'km', value: 1.5 },
    cooldown: { unit: 'km', value: 1 },
    pace: '3:50',
    ...overrides,
  };
}

const PHASES: PhaseConfig = { BASE: 1, BUILD: 4, RECOVERY: 0, PEAK: 1, TAPER: 0 };

function fullWeek(sessions: (PlannedSession | null)[]): (PlannedSession | null)[] {
  return Array.from({ length: 7 }, (_, index) => sessions[index] ?? null);
}

function week(
  weekNumber: number,
  sessions: (PlannedSession | null)[],
  phase: PlanWeek['phase'] = 'BUILD',
): PlanWeek {
  const fullSessions = fullWeek(sessions);
  return {
    weekNumber,
    phase,
    sessions: fullSessions,
    plannedKm: weekKm(fullSessions),
  };
}

describe('propagateChange structural fields', () => {
  it('preserves distance progression by delta and recalculates weekly volume', () => {
    const template = fullWeek([easy(8)]);
    const plan = generatePlan(template, 6, 7, PHASES);
    const progressedDistance = plan[3].sessions[0]!.distance!;

    const result = propagateChange(plan, 0, 0, easy(10), 'remaining', template);

    expect(result[3].sessions[0]!.distance).toBe(progressedDistance + 2);
    expect(result[3].plannedKm).toBe(weekKm(result[3]));
  });

  it('preserves interval rep progression by delta while copying rep length and recovery exactly', () => {
    const template = fullWeek([interval()]);
    const plan = generatePlan(template, 6, 20, PHASES);
    const progressedReps = plan[3].sessions[0]!.reps!;
    const updated = interval({
      reps: 8,
      repDuration: { unit: 'min', value: 4 },
      recovery: { unit: 'km', value: 0.4 },
    });

    const result = propagateChange(plan, 0, 0, updated, 'remaining', template);
    const future = result[3].sessions[0]!;

    expect(future.reps).toBe(progressedReps + 2);
    expect(future.repDuration).toEqual({ unit: 'min', value: 4 });
    expect(future.recovery).toEqual({ unit: 'km', value: 0.4 });
    expect(result[3].plannedKm).toBe(weekKm(result[3]));
  });

  it('copies warm-up and cool-down exactly for propagated tempo sessions', () => {
    const template = fullWeek([tempo(10, 1.5, 1)]);
    const plan = [
      week(1, [tempo(10, 1.5, 1)]),
      week(2, [tempo(12, 3, 2)]),
    ];
    const updated = tempo(11, 2, 0.5);

    const result = propagateChange(plan, 0, 0, updated, 'remaining', template);
    const future = result[1].sessions[0]!;

    expect(future.distance).toBe(13);
    expect(future.warmup).toEqual({ unit: 'km', value: 2 });
    expect(future.cooldown).toEqual({ unit: 'km', value: 0.5 });
    expect(result[1].plannedKm).toBe(weekKm(result[1]));
  });

  it('clears exact-copy structural fields when they are cleared on the edited session', () => {
    const template = fullWeek([interval()]);
    const plan = [
      week(1, [interval()]),
      week(2, [interval({
        repDuration: { unit: 'km', value: 1 },
        recovery: { unit: 'km', value: 0.5 },
        warmup: { unit: 'km', value: 3 },
        cooldown: { unit: 'km', value: 2 },
      })]),
    ];
    const updated = interval({
      reps: 7,
      repDuration: undefined,
      repDist: undefined,
      recovery: undefined,
      warmup: undefined,
      cooldown: undefined,
    });

    const result = propagateChange(plan, 0, 0, updated, 'remaining', template);
    const future = result[1].sessions[0]!;

    expect(future.reps).toBe(7);
    expect(future.repDuration).toBeUndefined();
    expect(future.repDist).toBeUndefined();
    expect(future.recovery).toBeUndefined();
    expect(future.warmup).toBeUndefined();
    expect(future.cooldown).toBeUndefined();
    expect(result[1].plannedKm).toBe(Math.round(sessionKm(future) * 10) / 10);
  });
});
