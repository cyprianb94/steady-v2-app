import { beforeEach, describe, expect, it } from 'vitest';
import type { Activity, Niggle } from '@steady/types';
import type { NiggleRepo } from '../src/repos/niggle-repo';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryNiggleRepo } from '../src/repos/niggle-repo.memory';

function makeActivity(userId: string, overrides: Partial<Activity> = {}): Activity {
  return {
    id: crypto.randomUUID(),
    userId,
    source: 'strava',
    externalId: `ext-${crypto.randomUUID().slice(0, 8)}`,
    startTime: '2026-04-05T07:00:00Z',
    distance: 12,
    duration: 3600,
    avgPace: 300,
    splits: [{ km: 1, pace: 300 }],
    ...overrides,
  };
}

type NiggleInput = Omit<Niggle, 'id' | 'userId' | 'activityId' | 'createdAt'>;

function runNiggleRepoTests(
  name: string,
  createRepo: () => { niggleRepo: NiggleRepo; activityRepo: InMemoryActivityRepo },
) {
  describe(name, () => {
    let niggleRepo: NiggleRepo;
    let activityRepo: InMemoryActivityRepo;
    let activityId: string;

    beforeEach(async () => {
      const repos = createRepo();
      niggleRepo = repos.niggleRepo;
      activityRepo = repos.activityRepo;
      const activity = makeActivity('user-1');
      activityId = activity.id;
      await activityRepo.save(activity);
    });

    it('stores and lists niggles for an activity in insertion order', async () => {
      const inserted = await niggleRepo.setForActivity(activityId, [
        { bodyPart: 'calf', severity: 'mild', when: 'during', side: 'left' },
        { bodyPart: 'other', bodyPartOtherText: 'Upper calf', severity: 'niggle', when: 'after', side: null },
      ]);

      expect(inserted.map((niggle) => niggle.bodyPart)).toEqual(['calf', 'other']);
      expect(inserted[1]).toMatchObject({ bodyPartOtherText: 'Upper calf' });
      expect(await niggleRepo.listByActivity(activityId)).toEqual(inserted);
    });

    it('replaces the existing niggle set atomically', async () => {
      await niggleRepo.setForActivity(activityId, [
        { bodyPart: 'calf', severity: 'mild', when: 'during', side: 'left' },
      ]);

      const replaced = await niggleRepo.setForActivity(activityId, [
        { bodyPart: 'hip', severity: 'moderate', when: 'before', side: 'right' },
        { bodyPart: 'back', severity: 'stop', when: 'after', side: null },
      ]);

      expect(replaced.map((niggle) => niggle.bodyPart)).toEqual(['hip', 'back']);
      expect((await niggleRepo.listByActivity(activityId)).map((niggle) => niggle.bodyPart)).toEqual(['hip', 'back']);
    });

    it('drops niggles once the parent activity is deleted', async () => {
      await niggleRepo.setForActivity(activityId, [
        { bodyPart: 'foot', severity: 'niggle', when: 'after', side: 'left' },
      ]);

      await activityRepo.delete(activityId);

      expect(await niggleRepo.listByActivity(activityId)).toEqual([]);
    });
  });
}

runNiggleRepoTests('InMemoryNiggleRepo', () => {
  const activityRepo = new InMemoryActivityRepo();
  return {
    activityRepo,
    niggleRepo: new InMemoryNiggleRepo(activityRepo),
  };
});
