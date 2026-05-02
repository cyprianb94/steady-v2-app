import { describe, expect, it } from 'vitest';
import type { PlannedSession } from '../src';
import {
  expectedDistance,
  sessionKm,
  sessionKmBreakdown,
  weekKmBreakdown,
} from '../src';

function session(overrides: Partial<PlannedSession>): PlannedSession {
  return {
    id: 'session-1',
    type: 'EASY',
    date: '2026-04-06',
    ...overrides,
  };
}

describe('session km calculation', () => {
  it('keeps simple distance sessions exact', () => {
    const easy = session({
      type: 'EASY',
      distance: 8,
      pace: '5:20',
    });

    expect(sessionKm(easy)).toBe(8);
    expect(sessionKmBreakdown(easy)).toEqual({
      exactKm: 8,
      estimatedKm: 0,
      totalKm: 8,
      hasEstimatedKm: false,
    });
  });

  it('includes interval work, recovery jogs, warm-up, and cool-down in simple volume', () => {
    const intervals = session({
      type: 'INTERVAL',
      reps: 6,
      repDuration: { unit: 'km', value: 0.8 },
      recovery: { unit: 'km', value: 0.2 },
      warmup: { unit: 'km', value: 1.5 },
      cooldown: { unit: 'km', value: 1 },
      pace: '3:50',
    });

    expect(sessionKm(intervals)).toBe(8.5);
    expect(expectedDistance(intervals)).toBeCloseTo(7.3, 5);
  });

  it('estimates minute-based interval reps from the representative target pace', () => {
    const intervals = session({
      type: 'INTERVAL',
      reps: 4,
      repDuration: { unit: 'min', value: 4 },
      pace: undefined,
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        paceRange: { min: '4:00', max: '4:20' },
      },
    });

    expect(sessionKm(intervals)).toBe(3.8);
    expect(sessionKmBreakdown(intervals)).toMatchObject({
      exactKm: 0,
      estimatedKm: 3.8,
      totalKm: 3.8,
      hasEstimatedKm: true,
    });
  });

  it('uses structured totals instead of stale parent distance', () => {
    const structured = session({
      type: 'LONG',
      distance: 18,
      plannedVolume: { unit: 'km', value: 18 },
      runStructure: {
        items: [
          { kind: 'RUN', volume: { unit: 'km', value: 13 } },
          {
            kind: 'REPEAT',
            repeats: 2,
            segments: [
              { kind: 'RECOVERY', volume: { unit: 'km', value: 0.4 } },
              { kind: 'RUN', volume: { unit: 'km', value: 1 } },
            ],
          },
        ],
      },
    });

    expect(sessionKm(structured)).toBe(15.8);
    expect(sessionKmBreakdown(structured)).toMatchObject({
      exactKm: 15.8,
      estimatedKm: 0,
      totalKm: 15.8,
    });
  });

  it('keeps exact and estimated structured distance separate for session and week totals', () => {
    const mixed = session({
      type: 'TEMPO',
      distance: undefined,
      runStructure: {
        items: [
          { kind: 'WARMUP', volume: { unit: 'km', value: 2 } },
          {
            kind: 'RUN',
            volume: { unit: 'min', value: 30 },
            intensityTarget: { source: 'manual', mode: 'pace', pace: '5:00' },
          },
        ],
      },
    });
    const easy = session({
      id: 'easy',
      type: 'EASY',
      date: '2026-04-07',
      distance: 8,
    });

    expect(sessionKmBreakdown(mixed)).toMatchObject({
      exactKm: 2,
      estimatedKm: 6,
      totalKm: 8,
      hasEstimatedKm: true,
    });
    expect(weekKmBreakdown([mixed, easy])).toEqual({
      exactKm: 10,
      estimatedKm: 6,
      totalKm: 16,
      hasEstimatedKm: true,
    });
  });
});
