import { beforeEach, describe, expect, it } from 'vitest';
import type { TrainingPlan, User } from '@steady/types';
import { createAppRouter } from '../src/trpc/router';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';

function makePlan(actualActivityId?: string): TrainingPlan {
  return {
    id: 'plan-1',
    userId: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    raceName: 'London Marathon',
    raceDate: '2026-10-04',
    raceDistance: 'Marathon',
    targetTime: 'sub-3:30',
    phases: { BASE: 3, BUILD: 8, RECOVERY: 2, PEAK: 1, TAPER: 2 },
    progressionPct: 7,
    templateWeek: [],
    weeks: [
      {
        weekNumber: 1,
        phase: 'BUILD',
        plannedKm: 8,
        sessions: [
          {
            id: 'session-1',
            type: 'EASY',
            date: '2026-04-09',
            distance: 8,
            pace: '5:20',
            actualActivityId,
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
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user-1@steady.app',
    createdAt: '2026-01-01T00:00:00Z',
    appleHealthConnected: false,
    subscriptionTier: 'free',
    timezone: 'UTC',
    units: 'metric',
    ...overrides,
  };
}

describe('plan router', () => {
  let planRepo: InMemoryPlanRepo;
  let profileRepo: InMemoryProfileRepo;
  let caller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeEach(async () => {
    planRepo = new InMemoryPlanRepo();
    profileRepo = new InMemoryProfileRepo();
    const appRouter = createAppRouter({
      profileRepo,
      planRepo,
      activityRepo: new InMemoryActivityRepo(),
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });
    caller = appRouter.createCaller({ userId: 'user-1' });

    await profileRepo.upsert(makeUser());
  });

  it('repairs orphaned actualActivityId links when loading the active plan', async () => {
    await planRepo.save(makePlan('missing-activity'));

    const plan = await caller.plan.get();

    expect(plan?.weeks[0].sessions[0]).toMatchObject({
      id: 'w1d0',
      actualActivityId: undefined,
    });

    const persistedPlan = await planRepo.getActive('user-1');
    expect(persistedPlan?.weeks[0].sessions[0]).toMatchObject({
      id: 'w1d0',
      actualActivityId: undefined,
    });
  });
});
