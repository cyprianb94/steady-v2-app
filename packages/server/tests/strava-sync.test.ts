import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StravaClient } from '../src/lib/strava-client';
import { createStravaTokenService } from '../src/lib/strava-token-service';
import { syncStravaActivities } from '../src/lib/strava-sync';
import { encrypt } from '../src/lib/encryption';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryIntegrationTokenRepo } from '../src/repos/integration-token-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';
import { InMemoryShoeRepo } from '../src/repos/shoe-repo.memory';

describe('syncStravaActivities', () => {
  let activityRepo: InMemoryActivityRepo;
  let integrationTokenRepo: InMemoryIntegrationTokenRepo;
  let planRepo: InMemoryPlanRepo;
  let profileRepo: InMemoryProfileRepo;
  let shoeRepo: InMemoryShoeRepo;
  let stravaClient: StravaClient;
  const encryptionKey = 'test-encryption-key';

  beforeEach(async () => {
    activityRepo = new InMemoryActivityRepo();
    integrationTokenRepo = new InMemoryIntegrationTokenRepo();
    planRepo = new InMemoryPlanRepo();
    profileRepo = new InMemoryProfileRepo();
    shoeRepo = new InMemoryShoeRepo(activityRepo);

    await profileRepo.upsert({
      id: 'user-1',
      email: 'user-1@test.com',
      createdAt: '2026-04-01T00:00:00Z',
      stravaAthleteId: 'athlete-42',
      appleHealthConnected: false,
      subscriptionTier: 'free',
      timezone: 'Europe/London',
      units: 'metric',
    });

    await integrationTokenRepo.save({
      id: 'token-1',
      userId: 'user-1',
      provider: 'strava',
      encryptedAccessToken: encrypt('current-access', encryptionKey),
      encryptedRefreshToken: encrypt('current-refresh', encryptionKey),
      expiresAt: '2026-04-10T12:00:00Z',
      externalAthleteId: 'athlete-42',
      createdAt: '2026-04-10T08:00:00Z',
    });

    stravaClient = {
      exchangeCode: async () => {
        throw new Error('not used');
      },
      refreshToken: async () => ({
        accessToken: 'refreshed-access',
        refreshToken: 'refreshed-refresh',
        expiresAt: '2026-04-10T15:00:00Z',
      }),
      getActivities: async () => [],
      getActivity: async () => {
        throw new Error('not used');
      },
      getGear: async () => null,
    };
  });

  it('uses plan start date for initial sync, maps new activities, matches sessions, and updates lastSyncedAt', async () => {
    await planRepo.save({
      id: 'plan-1',
      userId: 'user-1',
      createdAt: '2026-04-01T00:00:00Z',
      raceName: 'Spring Half',
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
          plannedKm: 10,
          sessions: [
            {
              id: 'session-1',
              type: 'EASY',
              date: '2026-04-08',
              distance: 10,
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

    let afterArg: string | null = null;
    stravaClient = {
      ...stravaClient,
      getActivities: async (_token, after) => {
        afterArg = after;
        return [
          {
            id: 101,
            sport_type: 'Run',
            start_date: '2026-04-08T07:00:00Z',
            distance: 10000,
            moving_time: 3000,
            elapsed_time: 3030,
            total_elevation_gain: 45,
            average_heartrate: 150,
            max_heartrate: 170,
            average_speed: 3.33,
            splits_metric: [
              {
                split: 1,
                distance: 1000,
                elapsed_time: 300,
                average_speed: 3.33,
                average_heartrate: 148,
                elevation_difference: 5,
              },
            ],
            laps: [
              {
                lap_index: 0,
                distance: 2000,
                elapsed_time: 720,
                average_speed: 2.78,
                average_heartrate: 135,
                total_elevation_gain: 8,
              },
              {
                lap_index: 1,
                distance: 400,
                elapsed_time: 88,
                average_speed: 4.54,
                average_heartrate: 174,
                total_elevation_gain: 1,
              },
              {
                lap_index: 2,
                distance: 200,
                elapsed_time: 90,
                average_speed: 2.22,
                average_heartrate: 152,
                total_elevation_gain: 0,
              },
            ],
          },
          {
            id: 102,
            sport_type: 'Ride',
            start_date: '2026-04-08T09:00:00Z',
            distance: 20000,
            elapsed_time: 3600,
          },
        ];
      },
    };

    const tokenService = createStravaTokenService({
      integrationTokenRepo,
      profileRepo,
      stravaClient,
      encryptionKey,
      now: () => new Date('2026-04-10T11:00:00Z').getTime(),
    });

    const result = await syncStravaActivities('user-1', {
      activityRepo,
      integrationTokenRepo,
      planRepo,
      shoeRepo,
      stravaClient,
      tokenService,
      now: () => new Date('2026-04-10T11:05:00Z'),
    });

    expect(afterArg).toBe('2026-04-08T00:00:00.000Z');
    expect(result).toEqual({
      new: 1,
      skipped: 0,
      matched: 1,
      matchedSessions: [
        {
          sessionId: 'w1d0',
          sessionType: 'EASY',
          sessionDate: '2026-04-08',
        },
      ],
    });

    const activities = await activityRepo.getByUserId('user-1');
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      source: 'strava',
      externalId: '101',
      distance: 10,
      matchedSessionId: 'w1d0',
      avgPace: 300,
    });
    expect(activities[0].splits[0]).toMatchObject({
      km: 1,
      pace: 360,
      hr: 135,
      elevation: 8,
      label: '2.0 km',
      distance: 2,
    });
    expect(activities[0].splits[1]).toMatchObject({
      km: 2,
      pace: 220,
      hr: 174,
      elevation: 1,
      label: '400m',
      distance: 0.4,
    });

    const plan = await planRepo.getActive('user-1');
    expect(plan?.weeks[0].sessions[0]).toMatchObject({
      actualActivityId: activities[0].id,
    });

    const token = await integrationTokenRepo.get('user-1', 'strava');
    expect(token?.lastSyncedAt).toBe('2026-04-10T11:05:00.000Z');
  });

  it('uses lastSyncedAt on subsequent syncs and skips duplicate external ids', async () => {
    await integrationTokenRepo.updateLastSyncedAt('user-1', 'strava', '2026-04-09T12:00:00Z');
    await activityRepo.save({
      id: 'activity-1',
      userId: 'user-1',
      source: 'strava',
      externalId: '101',
      startTime: '2026-04-09T07:00:00Z',
      distance: 8,
      duration: 2400,
      avgPace: 300,
      splits: [],
    });

    let afterArg: string | null = null;
    stravaClient = {
      ...stravaClient,
      getActivities: async (_token, after) => {
        afterArg = after;
        return [
          {
            id: 101,
            sport_type: 'Run',
            start_date: '2026-04-09T07:00:00Z',
            distance: 8000,
            elapsed_time: 2400,
          },
        ];
      },
    };

    const tokenService = createStravaTokenService({
      integrationTokenRepo,
      profileRepo,
      stravaClient,
      encryptionKey,
    });

    const result = await syncStravaActivities('user-1', {
      activityRepo,
      integrationTokenRepo,
      planRepo,
      shoeRepo,
      stravaClient,
      tokenService,
      now: () => new Date('2026-04-10T12:05:00Z'),
    });

    expect(afterArg).toBe('2026-04-09T12:00:00Z');
    expect(result.new).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('falls back to 30 days ago for initial sync when there is no plan', async () => {
    let afterArg: string | null = null;
    stravaClient = {
      ...stravaClient,
      getActivities: async (_token, after) => {
        afterArg = after;
        return [];
      },
    };

    const tokenService = createStravaTokenService({
      integrationTokenRepo,
      profileRepo,
      stravaClient,
      encryptionKey,
    });

    await syncStravaActivities('user-1', {
      activityRepo,
      integrationTokenRepo,
      planRepo,
      shoeRepo,
      stravaClient,
      tokenService,
      now: () => new Date('2026-04-10T12:00:00Z'),
    });

    expect(afterArg).toBe('2026-03-11T12:00:00.000Z');
  });

  it('upserts shoes, caches repeated gear lookups, and stamps shoe ids on synced activities', async () => {
    const getGear = vi.fn(async () => ({
      id: 'gear-1',
      brand: 'Nike',
      model: 'Pegasus',
      name: 'Daily',
      retired: false,
    }));

    stravaClient = {
      ...stravaClient,
      getActivities: async () => [
        {
          id: 101,
          sport_type: 'Run',
          start_date: '2026-04-08T07:00:00Z',
          distance: 10000,
          moving_time: 3000,
          elapsed_time: 3030,
          gear_id: 'gear-1',
        },
        {
          id: 102,
          sport_type: 'Run',
          start_date: '2026-04-08T09:00:00Z',
          distance: 8000,
          moving_time: 2400,
          elapsed_time: 2400,
          gear_id: 'gear-1',
        },
      ],
      getGear,
    };

    const tokenService = createStravaTokenService({
      integrationTokenRepo,
      profileRepo,
      stravaClient,
      encryptionKey,
    });

    await syncStravaActivities('user-1', {
      activityRepo,
      integrationTokenRepo,
      planRepo,
      shoeRepo,
      stravaClient,
      tokenService,
      now: () => new Date('2026-04-10T12:05:00Z'),
    });

    expect(getGear).toHaveBeenCalledTimes(1);

    const shoes = await shoeRepo.listByUserId('user-1');
    expect(shoes).toEqual([
      expect.objectContaining({
        stravaGearId: 'gear-1',
        brand: 'Nike',
        model: 'Pegasus',
        nickname: 'Daily',
        totalKm: 18,
      }),
    ]);

    const activities = await activityRepo.getByUserId('user-1');
    expect(activities.map((activity) => activity.shoeId)).toEqual([shoes[0].id, shoes[0].id]);
  });

  it('logs and skips shoe stamping when gear lookup fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    stravaClient = {
      ...stravaClient,
      getActivities: async () => [
        {
          id: 101,
          sport_type: 'Run',
          start_date: '2026-04-08T07:00:00Z',
          distance: 10000,
          moving_time: 3000,
          elapsed_time: 3030,
          gear_id: 'gear-404',
        },
      ],
      getGear: async () => {
        throw new Error('gear fetch failed with status 503');
      },
    };

    const tokenService = createStravaTokenService({
      integrationTokenRepo,
      profileRepo,
      stravaClient,
      encryptionKey,
    });

    await syncStravaActivities('user-1', {
      activityRepo,
      integrationTokenRepo,
      planRepo,
      shoeRepo,
      stravaClient,
      tokenService,
      now: () => new Date('2026-04-10T12:05:00Z'),
    });

    const activities = await activityRepo.getByUserId('user-1');
    expect(activities[0]?.shoeId).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      '[strava.sync.gear_lookup_failed]',
      expect.objectContaining({
        userId: 'user-1',
        gearId: 'gear-404',
      }),
    );

    warnSpy.mockRestore();
  });
});
