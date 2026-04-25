import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../src/trpc/router';
import { decrypt, encrypt } from '../src/lib/encryption';
import type { StravaClient } from '../src/lib/strava-client';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';
import { InMemoryIntegrationTokenRepo } from '../src/repos/integration-token-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';
import type { StravaActivity } from '../src/lib/strava-client';

describe('strava router', () => {
  let profileRepo: InMemoryProfileRepo;
  let integrationTokenRepo: InMemoryIntegrationTokenRepo;
  let activityRepo: InMemoryActivityRepo;
  let planRepo: InMemoryPlanRepo;
  let stravaClient: StravaClient;
  let caller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeEach(async () => {
    profileRepo = new InMemoryProfileRepo();
    integrationTokenRepo = new InMemoryIntegrationTokenRepo();
    activityRepo = new InMemoryActivityRepo();
    planRepo = new InMemoryPlanRepo();
    stravaClient = {
      exchangeCode: async () => ({
        accessToken: 'strava-access-token',
        refreshToken: 'strava-refresh-token',
        expiresAt: '2026-04-10T12:00:00Z',
        athleteId: 'athlete-99',
      }),
      refreshToken: async () => ({
        accessToken: 'unused-access-token',
        refreshToken: 'unused-refresh-token',
        expiresAt: '2026-04-10T12:30:00Z',
        athleteId: 'athlete-99',
      }),
      getActivities: async () => [],
      getActivity: async () => {
        throw new Error('not used');
      },
      getGear: async () => null,
    };

    await profileRepo.upsert({
      id: 'user-1',
      email: 'user-1@test.com',
      createdAt: '2026-04-10T08:00:00Z',
      appleHealthConnected: false,
      subscriptionTier: 'free',
      timezone: 'Europe/London',
      units: 'metric',
    });

    const appRouter = createAppRouter({
      profileRepo,
      planRepo,
      activityRepo,
      integrationTokenRepo,
      stravaClient,
      encryptionKey: 'test-encryption-key',
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });

    caller = appRouter.createCaller({ userId: 'user-1' });
  });

  it('connect exchanges the code, stores encrypted tokens, and updates the profile', async () => {
    const result = await caller.strava.connect({ code: 'oauth-code' });

    expect(result).toEqual({ success: true, athleteId: 'athlete-99' });

    const token = await integrationTokenRepo.get('user-1', 'strava');
    expect(token).not.toBeNull();
    expect(token?.externalAthleteId).toBe('athlete-99');
    expect(token?.encryptedAccessToken).not.toBe('strava-access-token');
    expect(token?.encryptedRefreshToken).not.toBe('strava-refresh-token');
    expect(decrypt(token!.encryptedAccessToken, 'test-encryption-key')).toBe('strava-access-token');
    expect(decrypt(token!.encryptedRefreshToken, 'test-encryption-key')).toBe('strava-refresh-token');

    const profile = await profileRepo.getById('user-1');
    expect(profile?.stravaAthleteId).toBe('athlete-99');
  });

  it('reports status from the stored profile and token state', async () => {
    expect(await caller.strava.status()).toEqual({
      connected: false,
      athleteId: null,
      lastSyncedAt: null,
    });

    await integrationTokenRepo.save({
      id: 'token-1',
      userId: 'user-1',
      provider: 'strava',
      encryptedAccessToken: 'encrypted-access',
      encryptedRefreshToken: 'encrypted-refresh',
      expiresAt: '2026-04-10T12:00:00Z',
      externalAthleteId: 'athlete-99',
      lastSyncedAt: '2026-04-10T10:00:00Z',
      createdAt: '2026-04-10T08:00:00Z',
    });

    await profileRepo.upsert({
      ...(await profileRepo.getById('user-1'))!,
      stravaAthleteId: 'athlete-99',
    });

    await expect(caller.strava.status()).resolves.toEqual({
      connected: true,
      athleteId: 'athlete-99',
      lastSyncedAt: '2026-04-10T10:00:00Z',
    });
  });

  it('sync returns the sync result for authenticated users', async () => {
    await integrationTokenRepo.save({
      id: 'token-1',
      userId: 'user-1',
      provider: 'strava',
      encryptedAccessToken: encrypt('access-token', 'test-encryption-key'),
      encryptedRefreshToken: encrypt('refresh-token', 'test-encryption-key'),
      expiresAt: '2026-04-10T12:00:00Z',
      externalAthleteId: 'athlete-99',
      createdAt: '2026-04-10T08:00:00Z',
    });

    await planRepo.save({
      id: 'plan-1',
      userId: 'user-1',
      createdAt: '2026-04-01T00:00:00Z',
      raceName: 'Half',
      raceDate: '2026-05-20',
      raceDistance: 'Half Marathon',
      targetTime: 'sub-1:40',
      phases: { BASE: 1, BUILD: 1, RECOVERY: 0, PEAK: 0, TAPER: 0 },
      progressionPct: 7,
      templateWeek: [null, null, null, null, null, null, null],
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 8,
          sessions: [
            {
              id: 'session-1',
              type: 'EASY',
              date: '2026-04-08',
              distance: 8,
              pace: '5:00',
            },
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        },
      ],
      activeInjury: null,
    });

    const getActivities = async (): Promise<StravaActivity[]> => ([
      {
        id: 201,
        sport_type: 'Run',
        start_date: '2026-04-08T07:00:00Z',
        distance: 8000,
        moving_time: 2400,
        elapsed_time: 2420,
        splits_metric: [],
      },
    ]);

    stravaClient = { ...stravaClient, getActivities };
    const appRouter = createAppRouter({
      profileRepo,
      planRepo,
      activityRepo,
      integrationTokenRepo,
      stravaClient,
      encryptionKey: 'test-encryption-key',
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });

    await expect(appRouter.createCaller({ userId: 'user-1' }).strava.sync()).resolves.toMatchObject({
      new: 1,
      matched: 1,
    });
  });

  it('refreshActivity updates an existing Strava activity in place and preserves manual fields', async () => {
    await integrationTokenRepo.save({
      id: 'token-1',
      userId: 'user-1',
      provider: 'strava',
      encryptedAccessToken: encrypt('access-token', 'test-encryption-key'),
      encryptedRefreshToken: encrypt('refresh-token', 'test-encryption-key'),
      expiresAt: '2026-04-10T12:00:00Z',
      externalAthleteId: 'athlete-99',
      createdAt: '2026-04-10T08:00:00Z',
    });

    await activityRepo.save({
      id: '7fc54a78-ceb1-433a-8189-958e545060a2',
      userId: 'user-1',
      source: 'strava',
      externalId: '201',
      startTime: '2026-04-08T07:00:00Z',
      distance: 8,
      duration: 2420,
      avgPace: 303,
      splits: [{ km: 1, pace: 303 }],
      matchedSessionId: 'w1d0',
      notes: 'keep this note',
      fuelEvents: [
        {
          id: 'fuel-1',
          minute: 35,
          gel: {
            id: 'precision-fuel-and-hydration-pf-30-gel-original',
            brand: 'Precision Fuel & Hydration',
            name: 'PF 30 Gel',
            flavour: 'Original',
            caloriesKcal: 120,
            carbsG: 30,
            caffeineMg: 0,
            sodiumMg: 0,
            potassiumMg: 0,
            magnesiumMg: 0,
            imageUrl: null,
          },
        },
      ],
    });

    stravaClient = {
      ...stravaClient,
      getActivity: async () => ({
        id: 201,
        sport_type: 'Run',
        start_date: '2026-04-08T07:00:00Z',
        distance: 7605,
        moving_time: 2549,
        elapsed_time: 2549,
        average_heartrate: 162,
        max_heartrate: 200,
        splits_metric: [
          {
            split: 1,
            distance: 1000,
            elapsed_time: 300,
            average_speed: 3.33,
            average_heartrate: 150,
            elevation_difference: 3,
          },
          {
            split: 2,
            distance: 1000,
            elapsed_time: 318,
            average_speed: 3.14,
            average_heartrate: 156,
            elevation_difference: -1,
          },
        ],
        laps: [
          { lap_index: 0, distance: 2000, elapsed_time: 720, average_heartrate: 135, total_elevation_gain: 8 },
          { lap_index: 1, distance: 400, elapsed_time: 88, average_heartrate: 174, total_elevation_gain: 1 },
        ],
      }),
    };

    const appRouter = createAppRouter({
      profileRepo,
      planRepo,
      activityRepo,
      integrationTokenRepo,
      stravaClient,
      encryptionKey: 'test-encryption-key',
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });

    const refreshed = await appRouter.createCaller({ userId: 'user-1' }).strava.refreshActivity({
      activityId: '7fc54a78-ceb1-433a-8189-958e545060a2',
    });

    expect(refreshed).toMatchObject({
      id: '7fc54a78-ceb1-433a-8189-958e545060a2',
      distance: 7.605,
      matchedSessionId: 'w1d0',
      notes: 'keep this note',
      fuelEvents: [{ id: 'fuel-1', minute: 35 }],
    });
    expect(refreshed.splits[0]).toMatchObject({ km: 1, pace: 360, hr: 135, distance: 2, label: '2 km' });
    expect(refreshed.splits[1]).toMatchObject({ km: 2, pace: 220, hr: 174, distance: 0.4, label: '400m' });
  });

  it('rejects unauthenticated requests', async () => {
    const appRouter = createAppRouter({
      profileRepo,
      planRepo: new InMemoryPlanRepo(),
      activityRepo,
      integrationTokenRepo,
      stravaClient,
      encryptionKey: 'test-encryption-key',
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });

    await expect(appRouter.createCaller({ userId: null }).strava.connect({ code: 'oauth-code' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('fails clearly when the Strava dependencies are missing', async () => {
    const appRouter = createAppRouter({
      profileRepo,
      planRepo: new InMemoryPlanRepo(),
      activityRepo,
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });

    await expect(appRouter.createCaller({ userId: 'user-1' }).strava.connect({ code: 'oauth-code' })).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  it('returns not found when the profile does not exist', async () => {
    const missingProfileCaller = createAppRouter({
      profileRepo: new InMemoryProfileRepo(),
      planRepo: new InMemoryPlanRepo(),
      activityRepo,
      integrationTokenRepo,
      stravaClient,
      encryptionKey: 'test-encryption-key',
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    }).createCaller({ userId: 'ghost' });

    await expect(missingProfileCaller.strava.connect({ code: 'oauth-code' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('disconnect deletes the token row, clears the profile, and preserves synced activities', async () => {
    await integrationTokenRepo.save({
      id: 'token-1',
      userId: 'user-1',
      provider: 'strava',
      encryptedAccessToken: 'encrypted-access',
      encryptedRefreshToken: 'encrypted-refresh',
      expiresAt: '2026-04-10T12:00:00Z',
      externalAthleteId: 'athlete-99',
      createdAt: '2026-04-10T08:00:00Z',
    });

    await activityRepo.save({
      id: 'activity-1',
      userId: 'user-1',
      source: 'strava',
      externalId: 'strava-activity-1',
      startTime: '2026-04-09T07:00:00Z',
      distance: 10,
      duration: 3000,
      avgPace: 300,
      splits: [{ km: 1, pace: 300 }],
    });

    await caller.strava.disconnect();

    await expect(integrationTokenRepo.get('user-1', 'strava')).resolves.toBeNull();
    await expect(profileRepo.getById('user-1')).resolves.toMatchObject({ stravaAthleteId: undefined });
    await expect(activityRepo.getByUserId('user-1')).resolves.toHaveLength(1);
  });

  it('disconnect is a no-op when the user is not connected', async () => {
    await expect(caller.strava.disconnect()).resolves.toEqual({ success: true });
    await expect(integrationTokenRepo.get('user-1', 'strava')).resolves.toBeNull();
    await expect(profileRepo.getById('user-1')).resolves.toMatchObject({ stravaAthleteId: undefined });
  });
});
