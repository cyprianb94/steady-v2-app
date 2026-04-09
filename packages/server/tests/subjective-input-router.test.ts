import { beforeEach, describe, expect, it } from 'vitest';
import { createAppRouter } from '../src/trpc/router';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';
import type { TrainingPlan } from '@steady/types';

function makePlan(): TrainingPlan {
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
            actualActivityId: 'activity-1',
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

describe('plan subjective input', () => {
  let planRepo: InMemoryPlanRepo;
  let caller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeEach(async () => {
    planRepo = new InMemoryPlanRepo();
    const appRouter = createAppRouter({
      profileRepo: new InMemoryProfileRepo(),
      planRepo,
      activityRepo: new InMemoryActivityRepo(),
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });
    caller = appRouter.createCaller({ userId: 'user-1' });
    await planRepo.save(makePlan());
  });

  it('saves subjective input for a session and returns it from the plan query', async () => {
    await caller.plan.saveSubjectiveInput({
      sessionId: 'session-1',
      input: {
        legs: 'heavy',
        breathing: 'controlled',
        overall: 'done',
      },
    });

    const plan = await caller.plan.get();

    expect(plan?.weeks[0].sessions[0]?.subjectiveInput).toEqual({
      legs: 'heavy',
      breathing: 'controlled',
      overall: 'done',
    });
    expect(plan?.weeks[0].sessions[0]?.subjectiveInputDismissed).toBe(true);
  });

  it('marks subjective input as dismissed without storing ratings', async () => {
    await caller.plan.dismissSubjectiveInput({
      sessionId: 'session-1',
    });

    const plan = await caller.plan.get();

    expect(plan?.weeks[0].sessions[0]?.subjectiveInput).toBeUndefined();
    expect(plan?.weeks[0].sessions[0]?.subjectiveInputDismissed).toBe(true);
  });
});
