import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../src/trpc/router';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';
import { InMemoryShoeRepo } from '../src/repos/shoe-repo.memory';

describe('shoe router', () => {
  let activityRepo: InMemoryActivityRepo;
  let shoeRepo: InMemoryShoeRepo;
  let caller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeEach(() => {
    activityRepo = new InMemoryActivityRepo();
    shoeRepo = new InMemoryShoeRepo(activityRepo);
    const appRouter = createAppRouter({
      profileRepo: new InMemoryProfileRepo(),
      planRepo: new InMemoryPlanRepo(),
      activityRepo,
      shoeRepo,
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });
    caller = appRouter.createCaller({ userId: 'user-1' });
  });

  it('lists shoes for the authenticated user with aggregated lifetime km', async () => {
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

    await activityRepo.save({
      id: 'activity-1',
      userId: 'user-1',
      source: 'strava',
      externalId: 'ext-1',
      startTime: '2026-04-02T07:00:00Z',
      distance: 8.5,
      duration: 2500,
      avgPace: 294,
      splits: [],
      shoeId: 'shoe-1',
    });

    expect(await caller.shoe.list()).toEqual([
      expect.objectContaining({
        id: 'shoe-1',
        totalKm: 8.5,
      }),
    ]);
  });
});
