import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    vi.useRealTimers();
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves subjective input for a session and returns it from the plan query', async () => {
    await caller.plan.saveSubjectiveInput({
      sessionId: 'w1d0',
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
      sessionId: 'w1d0',
    });

    const plan = await caller.plan.get();

    expect(plan?.weeks[0].sessions[0]?.subjectiveInput).toBeUndefined();
    expect(plan?.weeks[0].sessions[0]?.subjectiveInputDismissed).toBe(true);
  });

  it('builds the coach annotation from the weekday slot when session dates are stale', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z')); // Friday
    await planRepo.save({
      ...makePlan(),
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 8,
          sessions: [
            null,
            null,
            null,
            null,
            {
              id: 'friday-session',
              type: 'EASY',
              date: '2026-06-19',
              distance: 8,
              pace: '5:20',
            },
            null,
            null,
          ],
        },
      ],
    });

    const plan = await caller.plan.get();

    expect(plan?.coachAnnotation).toMatch(/first week|consistency/i);
    expect(plan?.coachAnnotation).not.toMatch(/rest day/i);
  });

  it('treats today as rest when another slot carries a stale copy of today’s date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z')); // Friday
    await planRepo.save({
      ...makePlan(),
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 12,
          sessions: [
            null,
            null,
            null,
            null,
            null,
            {
              id: 'saturday-session',
              type: 'EASY',
              date: '2026-04-10',
              distance: 12,
              pace: '5:20',
            },
            null,
          ],
        },
      ],
    });

    const plan = await caller.plan.get();

    expect(plan?.coachAnnotation).toMatch(/rest day/i);
    expect(plan?.coachAnnotation).not.toMatch(/consistency/i);
  });
});
