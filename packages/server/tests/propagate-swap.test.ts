import { describe, expect, it } from 'vitest';
import { propagateSwap, type PlannedSession, type PlanWeek } from '@steady/types';

function session(id: string, type: PlannedSession['type']): PlannedSession {
  return { id, type, date: '2026-04-06', distance: 8 };
}

function week(weekNumber: number, phase: PlanWeek['phase'], prefix: string): PlanWeek {
  return {
    weekNumber,
    phase,
    sessions: [
      session(`${prefix}-easy`, 'EASY'),
      null,
      session(`${prefix}-long`, 'LONG'),
      null,
      null,
      null,
      null,
    ],
    plannedKm: 24,
  };
}

describe('propagateSwap', () => {
  it('applies a swap to the target week only for this-week scope', () => {
    const plan = [week(1, 'BASE', 'w1'), week(2, 'BUILD', 'w2'), week(3, 'BUILD', 'w3')];

    const result = propagateSwap(plan, 1, 0, 2, 'this');

    expect(result[0].sessions[0]?.id).toBe('w1-easy');
    expect(result[1].sessions[0]?.id).toBe('w2-long');
    expect(result[1].sessions[2]?.id).toBe('w2-easy');
    expect(result[1].swapLog).toEqual([{ from: 0, to: 2 }]);
    expect(result[2].sessions[0]?.id).toBe('w3-easy');
    expect(result[2].swapLog).toBeUndefined();
  });

  it('applies the same positional swap from target week through the remaining plan', () => {
    const plan = [week(1, 'BASE', 'w1'), week(2, 'BUILD', 'w2'), week(3, 'BUILD', 'w3')];

    const result = propagateSwap(plan, 1, 0, 2, 'remaining');

    expect(result[0].sessions[0]?.id).toBe('w1-easy');
    expect(result[1].sessions[0]?.id).toBe('w2-long');
    expect(result[1].sessions[2]?.id).toBe('w2-easy');
    expect(result[1].swapLog).toEqual([{ from: 0, to: 2 }]);
    expect(result[2].sessions[0]?.id).toBe('w3-long');
    expect(result[2].sessions[2]?.id).toBe('w3-easy');
    expect(result[2].swapLog).toEqual([{ from: 0, to: 2 }]);
  });

  it('only applies to the target phase weeks for build scope', () => {
    const plan = [
      week(1, 'BASE', 'w1'),
      week(2, 'BUILD', 'w2'),
      week(3, 'RECOVERY', 'w3'),
      week(4, 'BUILD', 'w4'),
      week(5, 'PEAK', 'w5'),
    ];

    const result = propagateSwap(plan, 1, 0, 2, 'build');

    expect(result[0].sessions[0]?.id).toBe('w1-easy');
    expect(result[1].sessions[0]?.id).toBe('w2-long');
    expect(result[2].sessions[0]?.id).toBe('w3-easy');
    expect(result[3].sessions[0]?.id).toBe('w4-long');
    expect(result[4].sessions[0]?.id).toBe('w5-easy');
    expect(result[1].swapLog).toEqual([{ from: 0, to: 2 }]);
    expect(result[3].swapLog).toEqual([{ from: 0, to: 2 }]);
  });

  it('can apply the phase-scoped option to BASE weeks', () => {
    const plan = [
      week(1, 'BASE', 'w1'),
      week(2, 'BUILD', 'w2'),
      week(3, 'BASE', 'w3'),
      week(4, 'PEAK', 'w4'),
    ];

    const result = propagateSwap(plan, 0, 0, 2, 'build', 'BASE');

    expect(result[0].sessions[0]?.id).toBe('w1-long');
    expect(result[1].sessions[0]?.id).toBe('w2-easy');
    expect(result[2].sessions[0]?.id).toBe('w3-long');
    expect(result[3].sessions[0]?.id).toBe('w4-easy');
    expect(result[0].swapLog).toEqual([{ from: 0, to: 2 }]);
    expect(result[2].swapLog).toEqual([{ from: 0, to: 2 }]);
  });

  it('also applies to earlier weeks in the same phase', () => {
    const plan = [
      week(1, 'BASE', 'w1'),
      week(2, 'BASE', 'w2'),
      week(3, 'PEAK', 'w3'),
    ];

    const result = propagateSwap(plan, 1, 0, 2, 'build', 'BASE');

    expect(result[0].sessions[0]?.id).toBe('w1-long');
    expect(result[1].sessions[0]?.id).toBe('w2-long');
    expect(result[2].sessions[0]?.id).toBe('w3-easy');
  });

  it('silently skips weeks where either swap position is completed', () => {
    const plan = [week(1, 'BASE', 'w1'), week(2, 'BUILD', 'w2'), week(3, 'BUILD', 'w3')];
    const completedLong = { ...plan[2].sessions[2]!, actualActivityId: 'activity-3' };
    plan[2] = {
      ...plan[2],
      sessions: [plan[2].sessions[0], null, completedLong, null, null, null, null],
    };

    const result = propagateSwap(plan, 0, 0, 2, 'remaining');

    expect(result[0].sessions[0]?.id).toBe('w1-long');
    expect(result[1].sessions[0]?.id).toBe('w2-long');
    expect(result[2].sessions[0]?.id).toBe('w3-easy');
    expect(result[2].sessions[2]).toEqual(completedLong);
    expect(result[2].swapLog).toBeUndefined();
  });

  it('preserves existing swap log entries when appending propagated swaps', () => {
    const plan = [week(1, 'BASE', 'w1')];
    plan[0] = { ...plan[0], swapLog: [{ from: 5, to: 6 }] };

    const result = propagateSwap(plan, 0, 0, 2, 'remaining');

    expect(result[0].swapLog).toEqual([
      { from: 5, to: 6 },
      { from: 0, to: 2 },
    ]);
  });
});
