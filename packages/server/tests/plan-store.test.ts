import { describe, it, expect, beforeEach } from 'vitest';
import { planStore } from '../src/lib/stores';
import type { TrainingPlan, PlanWeek } from '@steady/types';

function makePlan(userId: string, overrides?: Partial<TrainingPlan>): TrainingPlan {
  return {
    id: 'plan-1',
    userId,
    createdAt: '2026-01-01T00:00:00Z',
    raceName: 'Test Marathon',
    raceDate: '2026-10-04',
    raceDistance: 'Marathon',
    targetTime: 'sub-3:30',
    phases: { BASE: 3, BUILD: 8, RECOVERY: 2, PEAK: 2, TAPER: 3 },
    progressionPct: 7,
    templateWeek: [
      { id: 't1', type: 'EASY', date: '', distance: 8, pace: '5:20' },
      null, null, null, null, null, null,
    ],
    weeks: [{
      weekNumber: 1,
      phase: 'BUILD',
      sessions: [
        { id: 's1', type: 'EASY', date: '2026-03-23', distance: 8, pace: '5:20' },
        null, null, null, null, null, null,
      ],
      plannedKm: 8,
    }],
    ...overrides,
  };
}

describe('plan store', () => {
  beforeEach(() => {
    planStore.clear();
  });

  it('stores and retrieves a plan by userId', () => {
    const plan = makePlan('user-1');
    planStore.set('user-1', plan);

    const retrieved = planStore.get('user-1');
    expect(retrieved).not.toBeUndefined();
    expect(retrieved!.raceName).toBe('Test Marathon');
  });

  it('returns undefined for missing user', () => {
    expect(planStore.get('nonexistent')).toBeUndefined();
  });

  it('overwrites existing plan on save', () => {
    planStore.set('user-1', makePlan('user-1', { raceName: 'First' }));
    planStore.set('user-1', makePlan('user-1', { raceName: 'Second' }));

    expect(planStore.get('user-1')!.raceName).toBe('Second');
  });

  it('supports updating weeks in-place', () => {
    const plan = makePlan('user-1');
    planStore.set('user-1', plan);

    const newWeeks: PlanWeek[] = [{
      weekNumber: 1,
      phase: 'BUILD',
      sessions: [
        { id: 's1', type: 'TEMPO', date: '2026-03-23', distance: 10, pace: '4:20', warmup: 2, cooldown: 1.5 },
        null, null, null, null, null, null,
      ],
      plannedKm: 13.5,
    }];

    plan.weeks = newWeeks;
    expect(planStore.get('user-1')!.weeks[0].sessions[0]!.type).toBe('TEMPO');
  });

  it('isolates plans between users', () => {
    planStore.set('user-1', makePlan('user-1', { raceName: 'Race A' }));
    planStore.set('user-2', makePlan('user-2', { raceName: 'Race B' }));

    expect(planStore.get('user-1')!.raceName).toBe('Race A');
    expect(planStore.get('user-2')!.raceName).toBe('Race B');
  });
});
