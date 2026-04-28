import { describe, expect, it } from 'vitest';
import type { PlannedSession, PlanWeek, TrainingPlan } from '@steady/types';
import {
  deriveLiveBlockReviewModel,
  deriveLiveBlockReviewState,
} from '../features/block-review/live-block-review-model';

function addDays(startDate: string, offset: number): string {
  const value = new Date(`${startDate}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function makeSession(
  id: string,
  date: string,
  overrides: Partial<PlannedSession> = {},
): PlannedSession {
  const type = overrides.type ?? 'EASY';

  return {
    id,
    type,
    date,
    distance: type === 'REST' ? undefined : overrides.distance ?? 8,
    pace: type === 'REST' ? undefined : overrides.pace ?? '5:20',
    ...overrides,
  };
}

function makeWeek(
  weekNumber: number,
  phase: PlanWeek['phase'],
  startDate: string,
  plannedKm: number,
  sessionOverrides: Array<Partial<PlannedSession> | null> = [],
): PlanWeek {
  return {
    weekNumber,
    phase,
    plannedKm,
    sessions: Array.from({ length: 7 }, (_, index) => {
      const override = sessionOverrides[index];
      if (override === null) return null;
      return makeSession(`w${weekNumber}-${index}`, addDays(startDate, index), override ?? {});
    }),
  };
}

function makePlan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  const weeks = [
    makeWeek(1, 'BASE', '2026-04-06', 40, [
      {},
      { distance: 10 },
      { type: 'REST' },
      { type: 'TEMPO', distance: 10, pace: '4:20' },
      {},
      { type: 'LONG', distance: 16, pace: '5:10' },
      { type: 'REST' },
    ]),
    makeWeek(2, 'BUILD', '2026-04-13', 46, [
      {},
      { type: 'INTERVAL', reps: 6, repDist: 800, pace: '3:50', recovery: '90s' },
      { type: 'REST' },
      { type: 'TEMPO', distance: 10, pace: '4:20' },
      {},
      { type: 'LONG', distance: 18, pace: '5:10' },
      { type: 'REST' },
    ]),
    makeWeek(3, 'BUILD', '2026-04-20', 50),
    makeWeek(4, 'PEAK', '2026-04-27', 54),
    makeWeek(5, 'TAPER', '2026-05-04', 30),
  ];

  return {
    id: 'plan-1',
    userId: 'runner-1',
    createdAt: '2026-04-01',
    raceName: 'Spring Marathon',
    raceDate: '2026-05-10',
    raceDistance: 'Marathon',
    targetTime: 'sub-3:20',
    phases: { BASE: 1, BUILD: 2, RECOVERY: 0, PEAK: 1, TAPER: 1 },
    progressionPct: 7,
    templateWeek: weeks[0].sessions,
    weeks,
    activeInjury: null,
    ...overrides,
  };
}

describe('deriveLiveBlockReviewModel', () => {
  it('adapts a live training plan to the shared block review model', () => {
    const model = deriveLiveBlockReviewModel({
      plan: makePlan(),
      currentWeekIndex: 1,
    });

    expect(model.totalWeeks).toBe(5);
    expect(model.structureLabel).toBe('1w base · 2w build · 0w recovery · 1w peak · 1w taper');
    expect(model.overload).toEqual({
      progressionPct: 7,
      progressionEveryWeeks: 2,
      hasProgression: true,
      label: '+7% every 2 weeks',
    });
    expect(model.weeks[1]).toMatchObject({
      weekNumber: 2,
      phase: 'BUILD',
      isCurrentWeek: true,
      plannedKm: 46,
    });
    expect(model.volume.stats).toMatchObject({
      startKm: 40,
      peakKm: 54,
      peakWeekNumber: 4,
      raceKm: 30,
    });
  });

  it('clamps the current week marker into the available week range', () => {
    const model = deriveLiveBlockReviewModel({
      plan: makePlan(),
      currentWeekIndex: 99,
    });

    expect(model.weeks.at(-1)?.isCurrentWeek).toBe(true);
  });

  it('throws when no populated plan is available', () => {
    expect(() => deriveLiveBlockReviewModel({
      plan: null,
      currentWeekIndex: 0,
    })).toThrow('Cannot derive BlockReviewModel without a populated training plan.');
  });
});

describe('deriveLiveBlockReviewState', () => {
  it('returns empty, loading, and error states before deriving the shared model', () => {
    expect(deriveLiveBlockReviewState({
      plan: null,
      currentWeekIndex: 0,
    })).toEqual({ status: 'empty' });

    expect(deriveLiveBlockReviewState({
      plan: null,
      currentWeekIndex: 0,
      loading: true,
    })).toEqual({ status: 'loading' });

    expect(deriveLiveBlockReviewState({
      plan: null,
      currentWeekIndex: 0,
      error: new Error('Could not load plan'),
    })).toEqual({ status: 'error', message: 'Could not load plan' });
  });

  it('returns ready with the shared model when a live plan can be adapted', () => {
    const state = deriveLiveBlockReviewState({
      plan: makePlan(),
      currentWeekIndex: 1,
    });

    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.model.weeks).toHaveLength(5);
      expect(state.model.weeks[1].isCurrentWeek).toBe(true);
    }
  });
});
