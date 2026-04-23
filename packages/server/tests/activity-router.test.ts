import { beforeEach, describe, expect, it } from 'vitest';
import type { Activity, PlannedSession, Shoe, TrainingPlan } from '@steady/types';
import { createAppRouter } from '../src/trpc/router';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';
import { InMemoryNiggleRepo } from '../src/repos/niggle-repo.memory';
import type { NiggleInput, NiggleRepo } from '../src/repos/niggle-repo';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';
import { InMemoryShoeRepo } from '../src/repos/shoe-repo.memory';

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

function makeShoe(userId: string, overrides: Partial<Shoe> = {}): Omit<Shoe, 'totalKm'> & { totalKm?: number } {
  return {
    id: crypto.randomUUID(),
    userId,
    brand: 'Nike',
    model: 'Pegasus 41',
    retired: false,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

function makeSession(id: string, overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id,
    type: 'EASY',
    date: '2026-04-05',
    distance: 8,
    pace: '5:20',
    ...overrides,
  };
}

function makePlan(sessionAActivityId?: string, sessionBActivityId?: string): TrainingPlan {
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
        plannedKm: 16,
        sessions: [
          makeSession('session-a', { actualActivityId: sessionAActivityId }),
          makeSession('session-b', { date: '2026-04-06', actualActivityId: sessionBActivityId }),
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

class FlakyNiggleRepo extends InMemoryNiggleRepo {
  private shouldFail = false;

  constructor(activityRepo: InMemoryActivityRepo) {
    super(activityRepo);
  }

  armFailure() {
    this.shouldFail = true;
  }

  override async setForActivity(activityId: string, niggles: NiggleInput[]) {
    if (this.shouldFail) {
      this.shouldFail = false;
      throw new Error('simulated niggle persistence failure');
    }

    return super.setForActivity(activityId, niggles);
  }
}

describe('activity router', () => {
  let activityRepo: InMemoryActivityRepo;
  let planRepo: InMemoryPlanRepo;
  let niggleRepo: NiggleRepo;
  let shoeRepo: InMemoryShoeRepo;
  let caller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeEach(() => {
    activityRepo = new InMemoryActivityRepo();
    planRepo = new InMemoryPlanRepo();
    niggleRepo = new InMemoryNiggleRepo(activityRepo);
    shoeRepo = new InMemoryShoeRepo(activityRepo);
    const appRouter = createAppRouter({
      profileRepo: new InMemoryProfileRepo(),
      planRepo,
      activityRepo,
      niggleRepo,
      shoeRepo,
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

  it('includes persisted niggles when listing activities', async () => {
    const activity = await activityRepo.save(makeActivity('user-1'));
    await niggleRepo.setForActivity(activity.id, [
      { bodyPart: 'hamstring', side: 'left', severity: 'mild', when: 'during' },
    ]);

    const [listedActivity] = await caller.activity.list();

    expect(listedActivity).toMatchObject({
      id: activity.id,
      niggles: [
        { bodyPart: 'hamstring', side: 'left', severity: 'mild', when: 'during' },
      ],
    });
  });

  it('loads a single activity with its niggles for the authenticated user', async () => {
    const activity = await activityRepo.save(makeActivity('user-1'));
    await niggleRepo.setForActivity(activity.id, [
      { bodyPart: 'hamstring', side: 'left', severity: 'mild', when: 'during' },
    ]);
    await activityRepo.save(makeActivity('user-2'));

    await expect(caller.activity.get({ activityId: activity.id })).resolves.toMatchObject({
      id: activity.id,
      niggles: [
        { bodyPart: 'hamstring', side: 'left', severity: 'mild', when: 'during' },
      ],
    });
  });

  it('clears orphaned plan links when the linked activity no longer exists', async () => {
    await planRepo.save(makePlan('missing-activity'));

    await expect(caller.activity.get({ activityId: 'missing-activity' })).resolves.toBeNull();

    const plan = await planRepo.getActive('user-1');
    expect(plan?.weeks[0].sessions[0]).toMatchObject({
      id: 'w1d0',
      actualActivityId: undefined,
    });
  });

  it('saveRunDetail persists subjective input, niggles, notes, and shoeId in one call', async () => {
    const activity = await activityRepo.save(makeActivity('user-1', { matchedSessionId: 'w1d0' }));
    await planRepo.save(makePlan(activity.id));
    const shoe = await shoeRepo.save(makeShoe('user-1'));

    await caller.activity.saveRunDetail({
      activityId: activity.id,
      subjectiveInput: { legs: 'normal', breathing: 'controlled', overall: 'done' },
      niggles: [
        { bodyPart: 'calf', side: 'left', severity: 'mild', when: 'during' },
        { bodyPart: 'hamstring', side: 'right', severity: 'niggle', when: 'after' },
      ],
      notes: 'Felt smooth after 5k',
      shoeId: shoe.id,
    });

    expect(await activityRepo.getById(activity.id)).toMatchObject({
      subjectiveInput: { legs: 'normal', breathing: 'controlled', overall: 'done' },
      notes: 'Felt smooth after 5k',
      shoeId: shoe.id,
      matchedSessionId: 'w1d0',
    });
    expect(await niggleRepo.listByActivity(activity.id)).toMatchObject([
      { bodyPart: 'calf', side: 'left', severity: 'mild', when: 'during' },
      { bodyPart: 'hamstring', side: 'right', severity: 'niggle', when: 'after' },
    ]);
  });

  it('replaces the niggle set on each save', async () => {
    const activity = await activityRepo.save(makeActivity('user-1'));

    await niggleRepo.setForActivity(activity.id, [
      { bodyPart: 'calf', side: 'left', severity: 'mild', when: 'during' },
    ]);

    await caller.activity.saveRunDetail({
      activityId: activity.id,
      subjectiveInput: { legs: 'fresh', breathing: 'easy', overall: 'could-go-again' },
      niggles: [
        { bodyPart: 'ankle', side: null, severity: 'moderate', when: 'after' },
      ],
      notes: 'Rolled through it',
    });

    const niggles = await niggleRepo.listByActivity(activity.id);
    expect(niggles).toHaveLength(1);
    expect(niggles[0]).toMatchObject({
      bodyPart: 'ankle',
      side: null,
      severity: 'moderate',
      when: 'after',
    });
  });

  it('handles bonus to matched transitions atomically', async () => {
    const activity = await activityRepo.save(makeActivity('user-1'));
    await planRepo.save(makePlan());

    await caller.activity.saveRunDetail({
      activityId: activity.id,
      subjectiveInput: { legs: 'normal', breathing: 'controlled', overall: 'done' },
      niggles: [],
      matchedSessionId: 'w1d0',
    });

    expect(await activityRepo.getById(activity.id)).toMatchObject({ matchedSessionId: 'w1d0' });
    const plan = await planRepo.getActive('user-1');
    expect(plan?.weeks[0].sessions[0]).toMatchObject({ id: 'w1d0', actualActivityId: activity.id });
  });

  it('repairs orphaned target-session links before rematching a run', async () => {
    const activity = await activityRepo.save(makeActivity('user-1'));
    await planRepo.save(makePlan('missing-activity'));

    await caller.activity.saveRunDetail({
      activityId: activity.id,
      subjectiveInput: { legs: 'normal', breathing: 'controlled', overall: 'done' },
      niggles: [],
      matchedSessionId: 'w1d0',
    });

    expect(await activityRepo.getById(activity.id)).toMatchObject({ matchedSessionId: 'w1d0' });
    const plan = await planRepo.getActive('user-1');
    expect(plan?.weeks[0].sessions[0]).toMatchObject({ id: 'w1d0', actualActivityId: activity.id });
  });

  it('handles matched A to matched B transitions atomically', async () => {
    const activity = await activityRepo.save(makeActivity('user-1', { matchedSessionId: 'w1d0' }));
    await planRepo.save(makePlan(activity.id));

    await caller.activity.saveRunDetail({
      activityId: activity.id,
      subjectiveInput: { legs: 'heavy', breathing: 'labored', overall: 'done' },
      niggles: [],
      matchedSessionId: 'w1d1',
    });

    expect(await activityRepo.getById(activity.id)).toMatchObject({ matchedSessionId: 'w1d1' });
    const plan = await planRepo.getActive('user-1');
    expect(plan?.weeks[0].sessions[0]).toMatchObject({ id: 'w1d0', actualActivityId: undefined });
    expect(plan?.weeks[0].sessions[1]).toMatchObject({ id: 'w1d1', actualActivityId: activity.id });
  });

  it('handles matched to bonus transitions atomically', async () => {
    const activity = await activityRepo.save(makeActivity('user-1', { matchedSessionId: 'w1d0' }));
    await planRepo.save(makePlan(activity.id));

    await caller.activity.saveRunDetail({
      activityId: activity.id,
      subjectiveInput: { legs: 'dead', breathing: 'labored', overall: 'shattered' },
      niggles: [],
      matchedSessionId: null,
    });

    expect(await activityRepo.getById(activity.id)).toMatchObject({ matchedSessionId: undefined });
    const plan = await planRepo.getActive('user-1');
    expect(plan?.weeks[0].sessions[0]).toMatchObject({ id: 'w1d0', actualActivityId: undefined });
  });

  it('does not change the current match when matchedSessionId is omitted', async () => {
    const activity = await activityRepo.save(makeActivity('user-1', { matchedSessionId: 'w1d0' }));
    await planRepo.save(makePlan(activity.id));

    await caller.activity.saveRunDetail({
      activityId: activity.id,
      subjectiveInput: { legs: 'normal', breathing: 'controlled', overall: 'done' },
      niggles: [],
      notes: 'Still the same run',
    });

    expect(await activityRepo.getById(activity.id)).toMatchObject({ matchedSessionId: 'w1d0' });
    const plan = await planRepo.getActive('user-1');
    expect(plan?.weeks[0].sessions[0]).toMatchObject({ id: 'w1d0', actualActivityId: activity.id });
  });

  it('rolls back activity, niggles, and match changes if any sub-write fails', async () => {
    const failingNiggleRepo = new FlakyNiggleRepo(activityRepo);
    const rollbackRouter = createAppRouter({
      profileRepo: new InMemoryProfileRepo(),
      planRepo,
      activityRepo,
      niggleRepo: failingNiggleRepo,
      shoeRepo,
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    });
    const rollbackCaller = rollbackRouter.createCaller({ userId: 'user-1' });

    const beforeShoe = await shoeRepo.save(makeShoe('user-1', { id: 'shoe-before' }));
    const afterShoe = await shoeRepo.save(makeShoe('user-1', { id: 'shoe-after', model: 'Alphafly' }));
    const activity = await activityRepo.save(makeActivity('user-1', {
      matchedSessionId: 'w1d0',
      subjectiveInput: { legs: 'fresh', breathing: 'easy', overall: 'could-go-again' },
      notes: 'before',
      shoeId: beforeShoe.id,
    }));
    await planRepo.save(makePlan(activity.id));
    await failingNiggleRepo.setForActivity(activity.id, [
      { bodyPart: 'calf', side: 'left', severity: 'mild', when: 'during' },
    ]);
    failingNiggleRepo.armFailure();

    await expect(
      rollbackCaller.activity.saveRunDetail({
        activityId: activity.id,
        subjectiveInput: { legs: 'dead', breathing: 'labored', overall: 'shattered' },
        niggles: [{ bodyPart: 'ankle', side: null, severity: 'stop', when: 'after' }],
        notes: 'after',
        shoeId: afterShoe.id,
        matchedSessionId: 'w1d1',
      }),
    ).rejects.toThrow(/simulated niggle persistence failure/i);

    expect(await activityRepo.getById(activity.id)).toMatchObject({
      matchedSessionId: 'w1d0',
      subjectiveInput: { legs: 'fresh', breathing: 'easy', overall: 'could-go-again' },
      notes: 'before',
      shoeId: beforeShoe.id,
    });
    expect(await failingNiggleRepo.listByActivity(activity.id)).toMatchObject([
      { bodyPart: 'calf', side: 'left', severity: 'mild', when: 'during' },
    ]);
    const plan = await planRepo.getActive('user-1');
    expect(plan?.weeks[0].sessions[0]).toMatchObject({ id: 'w1d0', actualActivityId: activity.id });
    expect(plan?.weeks[0].sessions[1]).toMatchObject({ id: 'w1d1', actualActivityId: undefined });
  });
});
