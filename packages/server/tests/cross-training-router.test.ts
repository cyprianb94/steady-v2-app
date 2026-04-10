import { beforeEach, describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createAppRouter } from '../src/trpc/router';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';

describe('crossTraining router', () => {
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

    await planRepo.save({
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
      weeks: [],
      activeInjury: null,
    });
  });

  it('logs an entry and retrieves it for the current week', async () => {
    const saved = await caller.crossTraining.log({
      date: '2026-04-08',
      type: 'Cycling',
      durationMinutes: 45,
    });

    const entries = await caller.crossTraining.getForWeek({
      weekStartDate: '2026-04-06',
    });

    expect(saved.id).toBeTruthy();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('Cycling');
  });

  it('retrieves entries across a date range', async () => {
    await caller.crossTraining.log({
      date: '2026-04-08',
      type: 'Cycling',
      durationMinutes: 45,
    });
    await caller.crossTraining.log({
      date: '2026-04-17',
      type: 'Swimming',
      durationMinutes: 30,
    });
    await caller.crossTraining.log({
      date: '2026-04-24',
      type: 'Walking',
      durationMinutes: 60,
    });

    const entries = await caller.crossTraining.getForDateRange({
      startDate: '2026-04-06',
      endDate: '2026-04-20',
    });

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.type)).toEqual(['Cycling', 'Swimming']);
  });

  it('deletes an entry through the router', async () => {
    const saved = await caller.crossTraining.log({
      date: '2026-04-08',
      type: 'Swimming',
      durationMinutes: 30,
    });

    await caller.crossTraining.delete({ id: saved.id });

    const entries = await caller.crossTraining.getForWeek({
      weekStartDate: '2026-04-06',
    });

    expect(entries).toEqual([]);
  });

  it('rejects types outside the allowed preset list', async () => {
    await expect(
      caller.crossTraining.log({
        date: '2026-04-08',
        type: 'Pilates' as any,
        durationMinutes: 30,
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
