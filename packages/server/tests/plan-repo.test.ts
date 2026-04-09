import { describe, it, expect, beforeEach } from 'vitest';
import type { TrainingPlan } from '@steady/types';
import type { PlanRepo } from '../src/repos/plan-repo';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';

function makePlan(userId: string, overrides?: Partial<TrainingPlan>): TrainingPlan {
  return {
    id: crypto.randomUUID(),
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
    activeInjury: null,
    ...overrides,
  };
}

function runPlanRepoTests(name: string, createRepo: () => PlanRepo) {
  describe(name, () => {
    let repo: PlanRepo;

    beforeEach(() => {
      repo = createRepo();
    });

    it('returns null for user with no plan', async () => {
      expect(await repo.getActive('nonexistent')).toBeNull();
    });

    it('saves a plan and retrieves it as active', async () => {
      const plan = makePlan('user-1');
      const saved = await repo.save(plan);

      expect(saved.id).toBe(plan.id);
      expect(saved.raceName).toBe('Test Marathon');

      const active = await repo.getActive('user-1');
      expect(active).not.toBeNull();
      expect(active!.id).toBe(plan.id);
    });

    it('deactivates old plan when saving a new one for the same user', async () => {
      const plan1 = makePlan('user-1', { raceName: 'First' });
      const plan2 = makePlan('user-1', { raceName: 'Second' });

      await repo.save(plan1);
      await repo.save(plan2);

      const active = await repo.getActive('user-1');
      expect(active!.raceName).toBe('Second');
    });

    it('returns all plans for a user including inactive', async () => {
      const plan1 = makePlan('user-1', { raceName: 'First' });
      const plan2 = makePlan('user-1', { raceName: 'Second' });

      await repo.save(plan1);
      await repo.save(plan2);

      const all = await repo.getAllByUserId('user-1');
      expect(all).toHaveLength(2);
      expect(all.map(p => p.raceName).sort()).toEqual(['First', 'Second']);
    });

    it('updates weeks on an existing plan', async () => {
      const plan = makePlan('user-1');
      await repo.save(plan);

      const newWeeks = [{
        weekNumber: 1,
        phase: 'BUILD' as const,
        sessions: [
          { id: 's1', type: 'TEMPO' as const, date: '2026-03-23', distance: 10, pace: '4:20', warmup: 2, cooldown: 1.5 },
          null, null, null, null, null, null,
        ],
        plannedKm: 13.5,
      }];

      const updated = await repo.updateWeeks(plan.id, newWeeks);
      expect(updated).not.toBeNull();
      expect(updated!.weeks[0].sessions[0]!.type).toBe('TEMPO');
      expect(updated!.weeks[0].plannedKm).toBe(13.5);

      // Persisted
      const retrieved = await repo.getActive('user-1');
      expect(retrieved!.weeks[0].sessions[0]!.type).toBe('TEMPO');
    });

    it('updateWeeks returns null for nonexistent plan', async () => {
      expect(await repo.updateWeeks('ghost', [])).toBeNull();
    });

    it('deactivate makes plan no longer active', async () => {
      const plan = makePlan('user-1');
      await repo.save(plan);

      await repo.deactivate(plan.id);
      expect(await repo.getActive('user-1')).toBeNull();

      // But still exists in getAllByUserId
      const all = await repo.getAllByUserId('user-1');
      expect(all).toHaveLength(1);
    });

    it('marks an injury with the default recovery state', async () => {
      const plan = makePlan('user-1');
      await repo.save(plan);

      const updated = await repo.markInjury(plan.id, 'Calf strain');
      expect(updated).not.toBeNull();
      expect(updated!.activeInjury).toEqual({
        name: 'Calf strain',
        markedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        rtrStep: 0,
        rtrStepCompletedDates: [],
        status: 'recovering',
      });

      const retrieved = await repo.getActive('user-1');
      expect(retrieved!.activeInjury!.name).toBe('Calf strain');
    });

    it('updates the active injury fields without losing existing metadata', async () => {
      const plan = makePlan('user-1');
      await repo.save(plan);
      await repo.markInjury(plan.id, 'Calf strain');

      const updated = await repo.updateInjury(plan.id, {
        rtrStep: 2,
        rtrStepCompletedDates: ['2026-04-01', '2026-04-03'],
        reassessedTarget: 'sub-3:35',
        status: 'returning',
      });

      expect(updated).not.toBeNull();
      expect(updated!.activeInjury).toMatchObject({
        name: 'Calf strain',
        rtrStep: 2,
        rtrStepCompletedDates: ['2026-04-01', '2026-04-03'],
        reassessedTarget: 'sub-3:35',
        status: 'returning',
      });
    });

    it('returns null when updating injury on a plan without an active injury', async () => {
      const plan = makePlan('user-1');
      await repo.save(plan);

      expect(await repo.updateInjury(plan.id, { status: 'returning' })).toBeNull();
    });

    it('clears an injury by marking it resolved', async () => {
      const plan = makePlan('user-1');
      await repo.save(plan);
      await repo.markInjury(plan.id, 'Hamstring');

      const updated = await repo.clearInjury(plan.id);
      expect(updated).not.toBeNull();
      expect(updated!.activeInjury).toMatchObject({
        name: 'Hamstring',
        status: 'resolved',
        resolvedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
    });

    it('isolates plans between users', async () => {
      await repo.save(makePlan('user-1', { raceName: 'Race A' }));
      await repo.save(makePlan('user-2', { raceName: 'Race B' }));

      expect((await repo.getActive('user-1'))!.raceName).toBe('Race A');
      expect((await repo.getActive('user-2'))!.raceName).toBe('Race B');
    });
  });
}

runPlanRepoTests('InMemoryPlanRepo', () => new InMemoryPlanRepo());
