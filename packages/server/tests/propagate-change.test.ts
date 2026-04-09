import { describe, it, expect } from 'vitest';
import { propagateChange } from '../src/lib/propagate-change';
import { generatePlan } from '../src/lib/plan-generator';
import type { PlannedSession, PhaseConfig, PlanWeek } from '@steady/types';

function easy(distance = 8): PlannedSession {
  return { id: 't-easy', type: 'EASY', date: '2026-01-01', distance };
}

function interval(reps = 6): PlannedSession {
  return { id: 't-int', type: 'INTERVAL', date: '2026-01-01', reps, repDist: 800, recovery: '90s', warmup: 1.5, cooldown: 1 };
}

// Simple template: EASY 8km, INTERVAL 6x800, REST, EASY 10km
const TEMPLATE: (PlannedSession | null)[] = [easy(8), interval(6), null, easy(10)];
const PHASES: PhaseConfig = { BASE: 1, BUILD: 4, RECOVERY: 0, PEAK: 1, TAPER: 0 };

function makePlan(): PlanWeek[] {
  return generatePlan(TEMPLATE, 6, 0, PHASES);
}

describe('propagateChange — scope: this', () => {
  it('only changes the target week', () => {
    const plan = makePlan();
    const updated = easy(12);
    const result = propagateChange(plan, 2, 0, updated, 'this', TEMPLATE);

    expect(result[2].sessions[0]!.distance).toBe(12);
    // Other weeks unchanged
    expect(result[0].sessions[0]!.distance).toBe(8);
    expect(result[1].sessions[0]!.distance).toBe(8);
    expect(result[3].sessions[0]!.distance).toBe(8);
  });

  it('does not affect other days in the same week', () => {
    const plan = makePlan();
    const updated = easy(12);
    const result = propagateChange(plan, 2, 0, updated, 'this', TEMPLATE);

    // Day 1 (interval) should be unchanged
    expect(result[2].sessions[1]!.reps).toBe(6);
  });

  it('recalculates km for the changed week', () => {
    const plan = makePlan();
    const originalKm = plan[2].plannedKm;
    const updated = easy(20);
    const result = propagateChange(plan, 2, 0, updated, 'this', TEMPLATE);

    expect(result[2].plannedKm).not.toBe(originalKm);
  });
});

describe('propagateChange — scope: remaining', () => {
  it('changes target week and all subsequent weeks', () => {
    const plan = makePlan();
    const updated = easy(12);
    const result = propagateChange(plan, 2, 0, updated, 'remaining', TEMPLATE);

    // Week 2 gets exact value
    expect(result[2].sessions[0]!.distance).toBe(12);
    // Weeks 3-5 get delta applied: base=8, updated=12, delta=+4
    expect(result[3].sessions[0]!.distance).toBe(12); // 8+4
    expect(result[4].sessions[0]!.distance).toBe(12); // 8+4
    expect(result[5].sessions[0]!.distance).toBe(12); // 8+4
  });

  it('does not change weeks before the target', () => {
    const plan = makePlan();
    const updated = easy(12);
    const result = propagateChange(plan, 2, 0, updated, 'remaining', TEMPLATE);

    expect(result[0].sessions[0]!.distance).toBe(8);
    expect(result[1].sessions[0]!.distance).toBe(8);
  });

  it('applies delta to INTERVAL reps', () => {
    const plan = makePlan();
    const updated = interval(10); // template has 6, delta = +4
    const result = propagateChange(plan, 1, 1, updated, 'remaining', TEMPLATE);

    expect(result[1].sessions[1]!.reps).toBe(10); // exact
    expect(result[2].sessions[1]!.reps).toBe(10); // 6+4
    expect(result[3].sessions[1]!.reps).toBe(10); // 6+4
  });

  it('preserves progression when applying delta', () => {
    // Use progression so weeks have different distances
    const plan = generatePlan(TEMPLATE, 6, 7, PHASES);
    const week4Distance = plan[3].sessions[0]!.distance!;

    // Edit week 1 (day 0): template 8 → 10, delta +2
    const updated = easy(10);
    const result = propagateChange(plan, 0, 0, updated, 'remaining', TEMPLATE);

    // Week 4 should have its progressed value + 2
    expect(result[3].sessions[0]!.distance).toBe(week4Distance + 2);
  });

  it('floors distance at 2', () => {
    const plan = makePlan();
    const updated = easy(2); // delta = 2-8 = -6, so 8-6=2
    const result = propagateChange(plan, 2, 0, updated, 'remaining', TEMPLATE);

    for (let i = 2; i < result.length; i++) {
      expect(result[i].sessions[0]!.distance).toBeGreaterThanOrEqual(2);
    }
  });

  it('skips completed sessions when propagating to remaining weeks', () => {
    const plan = makePlan();
    const completed = { ...plan[3].sessions[0]!, actualActivityId: 'activity-3' };
    plan[3] = { ...plan[3], sessions: [completed, ...plan[3].sessions.slice(1)] };

    const result = propagateChange(plan, 2, 0, easy(12), 'remaining', TEMPLATE);

    expect(result[2].sessions[0]!.distance).toBe(12);
    expect(result[3].sessions[0]).toEqual(completed);
    expect(result[4].sessions[0]!.distance).toBe(12);
  });
});

describe('propagateChange — scope: build', () => {
  it('only changes BUILD phase weeks at or after target', () => {
    const plan = makePlan();
    // Phases: BASE(1), BUILD(4), PEAK(1)
    const updated = easy(12);
    // Edit from week 1 (index 1, first BUILD week)
    const result = propagateChange(plan, 1, 0, updated, 'build', TEMPLATE);

    // Week 0 = BASE, untouched
    expect(result[0].sessions[0]!.distance).toBe(8);
    // Weeks 1-4 = BUILD, changed
    expect(result[1].sessions[0]!.distance).toBe(12);
    expect(result[2].sessions[0]!.distance).toBe(12);
    expect(result[3].sessions[0]!.distance).toBe(12);
    expect(result[4].sessions[0]!.distance).toBe(12);
    // Week 5 = PEAK, untouched
    expect(result[5].sessions[0]!.distance).toBe(8);
  });

  it('skips non-BUILD weeks even if after target', () => {
    const plan = makePlan();
    const updated = easy(15);
    const result = propagateChange(plan, 1, 0, updated, 'build', TEMPLATE);

    // PEAK week (index 5) should not be affected
    expect(result[5].phase).toBe('PEAK');
    expect(result[5].sessions[0]!.distance).toBe(8);
  });

  it('skips completed sessions in BUILD weeks', () => {
    const plan = makePlan();
    const completed = { ...plan[3].sessions[0]!, actualActivityId: 'activity-build' };
    plan[3] = { ...plan[3], sessions: [completed, ...plan[3].sessions.slice(1)] };

    const result = propagateChange(plan, 1, 0, easy(12), 'build', TEMPLATE);

    expect(result[1].sessions[0]!.distance).toBe(12);
    expect(result[2].sessions[0]!.distance).toBe(12);
    expect(result[3].sessions[0]).toEqual(completed);
    expect(result[4].sessions[0]!.distance).toBe(12);
  });
});

describe('propagateChange — edge cases', () => {
  it('handles null/REST updated session', () => {
    const plan = makePlan();
    const result = propagateChange(plan, 2, 0, null, 'remaining', TEMPLATE);

    // Target week and forward: day 0 becomes null
    expect(result[2].sessions[0]).toBeNull();
    expect(result[3].sessions[0]).toBeNull();
    // Before target: unchanged
    expect(result[0].sessions[0]!.distance).toBe(8);
  });

  it('handles editing a REST day slot', () => {
    const plan = makePlan();
    // Day index 2 is REST (null) in template
    const updated = easy(5);
    const result = propagateChange(plan, 1, 2, updated, 'remaining', TEMPLATE);

    // All weeks from 1 onward should have the new session at index 2
    for (let i = 1; i < result.length; i++) {
      expect(result[i].sessions[2]!.distance).toBe(5);
    }
  });

  it('updates repDist when propagating interval changes', () => {
    const plan = makePlan();
    const updated: PlannedSession = { ...interval(8), repDist: 1000 };
    const result = propagateChange(plan, 1, 1, updated, 'remaining', TEMPLATE);

    // Target week: exact
    expect(result[1].sessions[1]!.repDist).toBe(1000);
    // Other weeks: repDist updated too
    expect(result[2].sessions[1]!.repDist).toBe(1000);
  });
});
