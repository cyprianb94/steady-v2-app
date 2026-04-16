import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '../src/trpc/router';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';
import type { TrainingPlan, User } from '@steady/types';

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

describe('subjective input router contract', () => {
  let planRepo: InMemoryPlanRepo;
  let profileRepo: InMemoryProfileRepo;
  let appRouter: ReturnType<typeof createAppRouter>;
  let caller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeEach(async () => {
    vi.useRealTimers();
    planRepo = new InMemoryPlanRepo();
    profileRepo = new InMemoryProfileRepo();
    appRouter = createAppRouter({
      profileRepo,
      planRepo,
      activityRepo: new InMemoryActivityRepo(),
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });
    caller = appRouter.createCaller({ userId: 'user-1' });
    await profileRepo.upsert(makeUser());
    await planRepo.save(makePlan());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not expose the legacy plan subjective-input mutations', async () => {
    const procedures = (appRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def.procedures;
    expect(procedures['plan.saveSubjectiveInput']).toBeUndefined();
    expect(procedures['plan.dismissSubjectiveInput']).toBeUndefined();
  });

  it('does not expose an activity subjective-input tRPC mutation yet', async () => {
    const procedures = (appRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def.procedures;
    expect(procedures['activity.updateSubjectiveInput']).toBeUndefined();
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

  it('uses the profile timezone when local time is still yesterday behind UTC', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T00:30:00Z'));
    await profileRepo.upsert(makeUser({ timezone: 'America/New_York' }));
    await planRepo.save({
      ...makePlan(),
      weeks: [
        {
          weekNumber: 1,
          phase: 'BUILD',
          plannedKm: 20,
          sessions: [
            null,
            null,
            null,
            {
              id: 'thursday-easy',
              type: 'EASY',
              date: '2026-04-09',
              distance: 8,
              pace: '5:20',
            },
            {
              id: 'friday-interval',
              type: 'INTERVAL',
              date: '2026-04-10',
              distance: 10,
              pace: '4:30',
            },
            null,
            null,
          ],
        },
      ],
    });

    const plan = await caller.plan.get();

    expect(plan?.coachAnnotation).toMatch(/conversational|easy/i);
    expect(plan?.coachAnnotation).not.toMatch(/key|adaptation|quality/i);
  });

  it('uses the profile timezone when local time is already tomorrow ahead of UTC', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T23:30:00Z'));
    await profileRepo.upsert(makeUser({ timezone: 'Europe/London' }));
    await planRepo.save({
      ...makePlan(),
      weeks: [
        {
          weekNumber: 1,
          phase: 'BUILD',
          plannedKm: 20,
          sessions: [
            null,
            null,
            null,
            {
              id: 'thursday-easy',
              type: 'EASY',
              date: '2026-04-09',
              distance: 8,
              pace: '5:20',
            },
            {
              id: 'friday-interval',
              type: 'INTERVAL',
              date: '2026-04-10',
              distance: 10,
              pace: '4:30',
            },
            null,
            null,
          ],
        },
      ],
    });

    const plan = await caller.plan.get();

    expect(plan?.coachAnnotation).toMatch(/key|adaptation|quality/i);
    expect(plan?.coachAnnotation).not.toMatch(/conversational|easy/i);
  });
});
