import { beforeEach, describe, expect, it } from 'vitest';
import type { StravaClient } from '../src/lib/strava-client';
import { encrypt } from '../src/lib/encryption';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryIntegrationTokenRepo } from '../src/repos/integration-token-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';
import { InMemoryShoeRepo } from '../src/repos/shoe-repo.memory';
import { createStravaWorkflowService } from '../src/services/strava-workflow-service';

class FlakyPlanRepo extends InMemoryPlanRepo {
  private shouldFail = false;

  armFailure() {
    this.shouldFail = true;
  }

  override async updateWeeks(planId: string, weeks: Parameters<InMemoryPlanRepo['updateWeeks']>[1]) {
    if (this.shouldFail) {
      this.shouldFail = false;
      return null;
    }

    return super.updateWeeks(planId, weeks);
  }
}

describe('strava workflow service', () => {
  let profileRepo: InMemoryProfileRepo;
  let integrationTokenRepo: InMemoryIntegrationTokenRepo;
  let activityRepo: InMemoryActivityRepo;
  let planRepo: FlakyPlanRepo;
  let shoeRepo: InMemoryShoeRepo;
  let stravaClient: StravaClient;

  beforeEach(async () => {
    profileRepo = new InMemoryProfileRepo();
    integrationTokenRepo = new InMemoryIntegrationTokenRepo();
    activityRepo = new InMemoryActivityRepo();
    planRepo = new FlakyPlanRepo();
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
      weeklyVolumeMetric: 'distance',
    });

    await integrationTokenRepo.save({
      id: 'token-1',
      userId: 'user-1',
      provider: 'strava',
      encryptedAccessToken: encrypt('current-access', 'test-encryption-key'),
      encryptedRefreshToken: encrypt('current-refresh', 'test-encryption-key'),
      expiresAt: '2026-04-10T12:00:00Z',
      externalAthleteId: 'athlete-42',
      createdAt: '2026-04-10T08:00:00Z',
    });

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

    stravaClient = {
      exchangeCode: async () => {
        throw new Error('not used');
      },
      refreshToken: async () => ({
        accessToken: 'refreshed-access',
        refreshToken: 'refreshed-refresh',
        expiresAt: '2026-04-10T15:00:00Z',
      }),
      getActivities: async () => [
        {
          id: 101,
          sport_type: 'Run',
          start_date: '2026-04-08T07:00:00Z',
          distance: 10000,
          moving_time: 3000,
          elapsed_time: 3030,
          splits_metric: [],
        },
      ],
      getActivity: async () => {
        throw new Error('not used');
      },
      getGear: async () => null,
    };
  });

  it('rolls back a newly saved activity when the matched-plan write fails', async () => {
    planRepo.armFailure();
    const workflow = createStravaWorkflowService({
      profileRepo,
      planRepo,
      activityRepo,
      integrationTokenRepo,
      shoeRepo,
      stravaClient,
      encryptionKey: 'test-encryption-key',
      now: () => new Date('2026-04-10T12:05:00Z'),
    });

    await expect(workflow.sync('user-1')).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update plan match state during Strava sync',
    });

    await expect(activityRepo.getByUserId('user-1')).resolves.toHaveLength(0);

    const plan = await planRepo.getActive('user-1');
    expect(plan?.weeks[0].sessions[0]).toMatchObject({ id: 'w1d0' });
    expect(plan?.weeks[0].sessions[0]).not.toHaveProperty('actualActivityId');

    const token = await integrationTokenRepo.get('user-1', 'strava');
    expect(token?.lastSyncedAt).toBeUndefined();
  });
});
