import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../src/trpc/router';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryActivityProvenanceRepo } from '../src/repos/activity-provenance-repo.memory';
import { InMemoryActivitySyncLogRepo } from '../src/repos/activity-sync-log-repo.memory';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';

describe('apple health router', () => {
  let profileRepo: InMemoryProfileRepo;
  let activityRepo: InMemoryActivityRepo;
  let syncLogRepo: InMemoryActivitySyncLogRepo;
  let caller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeEach(async () => {
    profileRepo = new InMemoryProfileRepo();
    activityRepo = new InMemoryActivityRepo();
    syncLogRepo = new InMemoryActivitySyncLogRepo();

    await profileRepo.upsert({
      id: 'user-1',
      email: 'runner@test.com',
      createdAt: '2026-04-01T00:00:00.000Z',
      appleHealthConnected: false,
      subscriptionTier: 'free',
      timezone: 'Europe/London',
      units: 'metric',
      weeklyVolumeMetric: 'distance',
    });

    const appRouter = createAppRouter({
      profileRepo,
      planRepo: new InMemoryPlanRepo(),
      activityRepo,
      activityProvenanceRepo: new InMemoryActivityProvenanceRepo(),
      activitySyncLogRepo: syncLogRepo,
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });
    caller = appRouter.createCaller({ userId: 'user-1' });
  });

  it('connects and disconnects Apple Health without deleting imported activities', async () => {
    await expect(caller.appleHealth.status()).resolves.toEqual({
      connected: false,
      primaryRunSource: null,
      lastSyncedAt: null,
    });

    await expect(caller.appleHealth.connect()).resolves.toEqual({ success: true });
    await expect(profileRepo.getById('user-1')).resolves.toMatchObject({
      appleHealthConnected: true,
      primaryRunSource: 'apple_watch',
    });

    await activityRepo.save({
      id: 'activity-1',
      userId: 'user-1',
      source: 'apple_health',
      externalId: 'apple-workout-1',
      startTime: '2026-05-29T07:00:00.000Z',
      distance: 6.2,
      duration: 1800,
      avgPace: 290,
      splits: [],
    });

    await expect(caller.appleHealth.disconnect()).resolves.toEqual({ success: true });
    const profile = await profileRepo.getById('user-1');
    expect(profile?.appleHealthConnected).toBe(false);
    expect(profile?.primaryRunSource).toBeUndefined();
    await expect(activityRepo.getById('activity-1')).resolves.toMatchObject({
      source: 'apple_health',
      externalId: 'apple-workout-1',
    });
  });

  it('auto-marks Apple Health connected when a valid sync arrives', async () => {
    const result = await caller.appleHealth.sync({
      activities: [
        {
          source: 'apple_health',
          externalId: 'apple-workout-1',
          sourceName: 'Apple Watch',
          startTime: '2026-05-29T07:00:00.000Z',
          runSubtype: 'outdoor',
          distanceKm: 6.2,
          durationSeconds: 1800,
          avgPaceSecondsPerKm: 290,
          avgHR: 148,
          splits: [{ km: 1, label: 'Workout', distance: 6.2, pace: 290, hr: 148 }],
          dataQuality: { routeRetained: false, hasHeartRate: true },
        },
      ],
    });

    expect(result).toMatchObject({
      fetched: 1,
      imported: 1,
      errors: 0,
    });
    await expect(profileRepo.getById('user-1')).resolves.toMatchObject({
      appleHealthConnected: true,
      primaryRunSource: 'apple_watch',
    });
    await expect(caller.appleHealth.status()).resolves.toMatchObject({
      connected: true,
      primaryRunSource: 'apple_watch',
      lastSyncedAt: expect.any(String),
    });
  });

  it('rejects over-collected route payloads at the API boundary', async () => {
    await expect(caller.appleHealth.sync({
      activities: [
        {
          source: 'apple_health',
          externalId: 'apple-workout-1',
          startTime: '2026-05-29T07:00:00.000Z',
          runSubtype: 'outdoor',
          distanceKm: 6.2,
          durationSeconds: 1800,
          splits: [],
          dataQuality: { routeRetained: false },
          routePolyline: 'encoded-route',
        } as never,
      ],
    })).rejects.toThrow();
  });
});
