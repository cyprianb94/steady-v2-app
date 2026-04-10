import { beforeEach, describe, expect, it } from 'vitest';
import type { CrossTrainingRepo } from '../src/repos/cross-training-repo';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';

function runCrossTrainingRepoTests(name: string, createRepo: () => CrossTrainingRepo) {
  describe(name, () => {
    let repo: CrossTrainingRepo;

    beforeEach(() => {
      repo = createRepo();
    });

    it('logs an entry and returns it for the matching training week', async () => {
      const entry = await repo.log({
        userId: 'user-1',
        planId: 'plan-1',
        date: '2026-04-08',
        type: 'Cycling',
        durationMinutes: 45,
      });

      const entries = await repo.getForWeek('plan-1', '2026-04-06');

      expect(entry.id).toBeTruthy();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        planId: 'plan-1',
        date: '2026-04-08',
        type: 'Cycling',
        durationMinutes: 45,
      });
    });

    it('deletes an existing entry', async () => {
      const entry = await repo.log({
        userId: 'user-1',
        planId: 'plan-1',
        date: '2026-04-08',
        type: 'Swimming',
        durationMinutes: 30,
      });

      await repo.delete(entry.id);

      const entries = await repo.getForWeek('plan-1', '2026-04-06');
      expect(entries).toEqual([]);
    });

    it('returns an empty array for a week with no entries', async () => {
      const entries = await repo.getForWeek('plan-1', '2026-04-13');
      expect(entries).toEqual([]);
    });

    it('returns only entries inside the requested date range', async () => {
      await repo.log({
        userId: 'user-1',
        planId: 'plan-1',
        date: '2026-04-08',
        type: 'Cycling',
        durationMinutes: 45,
      });
      await repo.log({
        userId: 'user-1',
        planId: 'plan-1',
        date: '2026-04-17',
        type: 'Swimming',
        durationMinutes: 30,
      });
      await repo.log({
        userId: 'user-1',
        planId: 'plan-1',
        date: '2026-04-24',
        type: 'Walking',
        durationMinutes: 60,
      });

      const entries = await repo.getForDateRange('plan-1', '2026-04-06', '2026-04-20');

      expect(entries.map((entry) => entry.type)).toEqual(['Cycling', 'Swimming']);
    });
  });
}

runCrossTrainingRepoTests('InMemoryCrossTrainingRepo', () => new InMemoryCrossTrainingRepo());
