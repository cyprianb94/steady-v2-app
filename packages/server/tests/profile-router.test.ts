import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../src/trpc/router';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';

function makeUser(id: string, units: 'metric' | 'imperial' = 'metric') {
  return {
    id,
    email: `${id}@steady.test`,
    createdAt: '2026-01-01T00:00:00Z',
    appleHealthConnected: false,
    subscriptionTier: 'free' as const,
    timezone: 'Europe/London',
    units,
    weeklyVolumeMetric: 'distance' as const,
  };
}

describe('profile router', () => {
  let profileRepo: InMemoryProfileRepo;
  let caller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeEach(async () => {
    profileRepo = new InMemoryProfileRepo();
    await profileRepo.upsert(makeUser('user-1'));

    const appRouter = createAppRouter({
      profileRepo,
      planRepo: new InMemoryPlanRepo(),
      activityRepo: new InMemoryActivityRepo(),
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });

    caller = appRouter.createCaller({ userId: 'user-1' });
  });

  it('returns the signed-in user profile', async () => {
    await expect(caller.profile.me()).resolves.toMatchObject({
      id: 'user-1',
      email: 'user-1@steady.test',
      units: 'metric',
      weeklyVolumeMetric: 'distance',
    });
  });

  it('updates units through preferences', async () => {
    await expect(caller.profile.updatePreferences({ units: 'imperial' })).resolves.toMatchObject({
      units: 'imperial',
    });

    await expect(profileRepo.getById('user-1')).resolves.toMatchObject({
      units: 'imperial',
      weeklyVolumeMetric: 'distance',
    });
  });

  it('updates weekly volume metric without changing units', async () => {
    await expect(caller.profile.updatePreferences({ weeklyVolumeMetric: 'time' })).resolves.toMatchObject({
      units: 'metric',
      weeklyVolumeMetric: 'time',
    });

    await expect(profileRepo.getById('user-1')).resolves.toMatchObject({
      units: 'metric',
      weeklyVolumeMetric: 'time',
    });
  });

  it('updates units and weekly volume metric together', async () => {
    await expect(
      caller.profile.updatePreferences({ units: 'imperial', weeklyVolumeMetric: 'time' }),
    ).resolves.toMatchObject({
      units: 'imperial',
      weeklyVolumeMetric: 'time',
    });
  });

  it('falls back to a default metric profile when the row is missing', async () => {
    const appRouter = createAppRouter({
      profileRepo: new InMemoryProfileRepo(),
      planRepo: new InMemoryPlanRepo(),
      activityRepo: new InMemoryActivityRepo(),
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });

    await expect(appRouter.createCaller({ userId: 'ghost' }).profile.me()).resolves.toMatchObject({
      id: 'ghost',
      units: 'metric',
      weeklyVolumeMetric: 'distance',
    });
  });
});
