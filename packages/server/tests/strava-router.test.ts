import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../src/trpc/router';
import { decrypt } from '../src/lib/encryption';
import type { StravaClient } from '../src/lib/strava-client';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';
import { InMemoryIntegrationTokenRepo } from '../src/repos/integration-token-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';

describe('strava router', () => {
  let profileRepo: InMemoryProfileRepo;
  let integrationTokenRepo: InMemoryIntegrationTokenRepo;
  let activityRepo: InMemoryActivityRepo;
  let stravaClient: StravaClient;
  let caller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeEach(async () => {
    profileRepo = new InMemoryProfileRepo();
    integrationTokenRepo = new InMemoryIntegrationTokenRepo();
    activityRepo = new InMemoryActivityRepo();
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
      planRepo: new InMemoryPlanRepo(),
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
