import { beforeEach, describe, expect, it } from 'vitest';
import type { Activity } from '@steady/types';
import { createAppRouter } from '../src/trpc/router';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';

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

describe('activity router', () => {
  let activityRepo: InMemoryActivityRepo;
  let caller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeEach(() => {
    activityRepo = new InMemoryActivityRepo();
    const appRouter = createAppRouter({
      profileRepo: new InMemoryProfileRepo(),
      planRepo: new InMemoryPlanRepo(),
      activityRepo,
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });
    caller = appRouter.createCaller({ userId: 'user-1' });
  });

  it('lists activities for the authenticated user only', async () => {
    await activityRepo.save(makeActivity('user-1', { distance: 8, startTime: '2026-04-02T07:00:00Z' }));
    await activityRepo.save(makeActivity('user-2', { distance: 20, startTime: '2026-04-03T07:00:00Z' }));
    await activityRepo.save(makeActivity('user-1', { distance: 15, startTime: '2026-04-04T07:00:00Z' }));

    const activities = await caller.activity.list();

    expect(activities).toHaveLength(2);
    expect(activities.map((activity) => activity.distance)).toEqual([15, 8]);
  });
});
