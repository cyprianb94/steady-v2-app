import { beforeEach, describe, expect, it } from 'vitest';
import type { Activity } from '@steady/types';
import type { ShoeRepo } from '../src/repos/shoe-repo';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryShoeRepo } from '../src/repos/shoe-repo.memory';

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

function runShoeRepoTests(
  name: string,
  createRepo: () => { shoeRepo: ShoeRepo; activityRepo: InMemoryActivityRepo },
) {
  describe(name, () => {
    let shoeRepo: ShoeRepo;
    let activityRepo: InMemoryActivityRepo;

    beforeEach(() => {
      const repos = createRepo();
      shoeRepo = repos.shoeRepo;
      activityRepo = repos.activityRepo;
    });

    it('lists shoes for a user with zero lifetime km when no activities reference them', async () => {
      await shoeRepo.save({
        id: 'shoe-1',
        userId: 'user-1',
        stravaGearId: 'gear-1',
        brand: 'Nike',
        model: 'Pegasus',
        nickname: 'Daily',
        retired: false,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
      });

      await shoeRepo.save({
        id: 'shoe-2',
        userId: 'user-2',
        stravaGearId: 'gear-2',
        brand: 'Adidas',
        model: 'Boston',
        retired: false,
        createdAt: '2026-04-02T00:00:00Z',
        updatedAt: '2026-04-02T00:00:00Z',
      });

      expect(await shoeRepo.listByUserId('user-1')).toEqual([
        expect.objectContaining({
          id: 'shoe-1',
          brand: 'Nike',
          model: 'Pegasus',
          nickname: 'Daily',
          totalKm: 0,
        }),
      ]);
    });

    it('aggregates lifetime km across multiple activities for the same shoe', async () => {
      await shoeRepo.save({
        id: 'shoe-1',
        userId: 'user-1',
        stravaGearId: 'gear-1',
        brand: 'Nike',
        model: 'Pegasus',
        retired: false,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
      });

      await activityRepo.save(makeActivity('user-1', { shoeId: 'shoe-1', distance: 10.25 }));
      await activityRepo.save(makeActivity('user-1', { shoeId: 'shoe-1', distance: 8.75 }));
      await activityRepo.save(makeActivity('user-1', { shoeId: 'shoe-other', distance: 99 }));

      const shoes = await shoeRepo.listByUserId('user-1');

      expect(shoes).toEqual([
        expect.objectContaining({
          id: 'shoe-1',
          totalKm: 19,
        }),
      ]);
    });

    it('preserves Strava lifetime separately from the local activity aggregate', async () => {
      await shoeRepo.save({
        id: 'shoe-1',
        userId: 'user-1',
        stravaGearId: 'gear-1',
        stravaDistanceKm: 388.206,
        brand: 'Nike',
        model: 'Pegasus',
        retired: false,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
      });

      await activityRepo.save(makeActivity('user-1', { shoeId: 'shoe-1', distance: 10 }));

      const [shoe] = await shoeRepo.listByUserId('user-1');

      expect(shoe).toMatchObject({
        stravaDistanceKm: 388.206,
        totalKm: 10,
      });
    });

    it('updates the Strava lifetime when the same gear is saved again', async () => {
      await shoeRepo.save({
        id: 'shoe-1',
        userId: 'user-1',
        stravaGearId: 'gear-1',
        stravaDistanceKm: 388.206,
        brand: 'Nike',
        model: 'Pegasus',
        retired: false,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
      });

      await shoeRepo.save({
        id: 'shoe-new-id',
        userId: 'user-1',
        stravaGearId: 'gear-1',
        stravaDistanceKm: 401.5,
        brand: 'Nike',
        model: 'Pegasus',
        retired: false,
        createdAt: '2026-04-02T00:00:00Z',
        updatedAt: '2026-04-02T00:00:00Z',
      });

      expect(await shoeRepo.listByUserId('user-1')).toEqual([
        expect.objectContaining({
          id: 'shoe-1',
          stravaDistanceKm: 401.5,
        }),
      ]);
    });

    it('keeps the higher stored Strava lifetime when a later gear fetch returns stale distance', async () => {
      await shoeRepo.save({
        id: 'shoe-1',
        userId: 'user-1',
        stravaGearId: 'gear-1',
        stravaDistanceKm: 401.5,
        brand: 'Nike',
        model: 'Pegasus',
        retired: false,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
      });

      await shoeRepo.save({
        id: 'shoe-new-id',
        userId: 'user-1',
        stravaGearId: 'gear-1',
        stravaDistanceKm: 388.206,
        brand: 'Nike',
        model: 'Pegasus',
        retired: false,
        createdAt: '2026-04-02T00:00:00Z',
        updatedAt: '2026-04-02T00:00:00Z',
      });

      expect(await shoeRepo.listByUserId('user-1')).toEqual([
        expect.objectContaining({
          id: 'shoe-1',
          stravaDistanceKm: 401.5,
        }),
      ]);
    });

    it('preserves retired metadata while still computing lifetime km', async () => {
      await shoeRepo.save({
        id: 'shoe-1',
        userId: 'user-1',
        stravaGearId: 'gear-1',
        brand: 'Saucony',
        model: 'Endorphin Speed',
        retired: true,
        retireAtKm: 600,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
      });
      await activityRepo.save(makeActivity('user-1', { shoeId: 'shoe-1', distance: 42.2 }));

      const [shoe] = await shoeRepo.listByUserId('user-1');

      expect(shoe).toMatchObject({
        retired: true,
        retireAtKm: 600,
        totalKm: 42.2,
      });
    });
  });
}

runShoeRepoTests('InMemoryShoeRepo', () => {
  const activityRepo = new InMemoryActivityRepo();
  return {
    activityRepo,
    shoeRepo: new InMemoryShoeRepo(activityRepo),
  };
});
