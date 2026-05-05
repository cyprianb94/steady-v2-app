import { beforeEach, describe, expect, it } from 'vitest';
import { deriveTrainingPaceProfile, trainingPaceBandToIntensityTarget } from '@steady/types';
import type { Activity, PlannedSession, TrainingPlan, User } from '@steady/types';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';
import {
  createPlanWorkflowService,
  PlanWorkflowError,
  type PlanWorkflowService,
} from '../src/services/plan-workflow-service';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user-1@steady.app',
    createdAt: '2026-01-01T00:00:00Z',
    appleHealthConnected: false,
    subscriptionTier: 'free',
    timezone: 'Europe/London',
    units: 'metric',
    weeklyVolumeMetric: 'distance',
    ...overrides,
  };
}

function makePlan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    id: 'plan-1',
    userId: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    raceName: 'London Marathon',
    raceDate: '2026-10-04',
    raceDistance: 'Marathon',
    targetTime: 'sub-3:30',
    phases: { BASE: 1, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
    progressionPct: 7,
    progressionEveryWeeks: 2,
    templateWeek: [null, null, null, null, null, null, null],
    weeks: [
      {
        weekNumber: 1,
        phase: 'BASE',
        plannedKm: 8,
        sessions: [
          {
            id: 'session-1',
            type: 'EASY',
            date: '2026-04-06',
            distance: 8,
            pace: '5:20',
          },
          null, null, null, null, null, null,
        ],
      },
    ],
    trainingPaceProfile: null,
    activeInjury: null,
    ...overrides,
  };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    userId: 'user-1',
    source: 'strava',
    externalId: 'ext-activity-1',
    startTime: '2099-01-08T07:00:00.000Z',
    distance: 10,
    duration: 3000,
    avgPace: 300,
    splits: [{ km: 1, pace: 300 }],
    ...overrides,
  };
}

describe('plan workflow service', () => {
  let planRepo: InMemoryPlanRepo;
  let profileRepo: InMemoryProfileRepo;
  let activityRepo: InMemoryActivityRepo;
  let workflow: PlanWorkflowService;

  beforeEach(async () => {
    planRepo = new InMemoryPlanRepo();
    profileRepo = new InMemoryProfileRepo();
    activityRepo = new InMemoryActivityRepo();
    workflow = createPlanWorkflowService({
      planRepo,
      profileRepo,
      activityRepo,
      todayForTimezone: () => '2026-04-06',
      createId: () => 'new-plan-id',
      now: () => '2026-04-16T10:00:00.000Z',
    });

    await profileRepo.upsert(makeUser());
  });

  it('loads the active plan with repaired activity links and server annotations', async () => {
    await planRepo.save(makePlan({
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 8,
          sessions: [
            {
              id: 'session-with-orphan',
              type: 'EASY',
              date: '2026-04-06',
              distance: 8,
              pace: '5:20',
              actualActivityId: 'missing-activity',
            },
            null, null, null, null, null, null,
          ],
        },
      ],
    }));

    const plan = await workflow.getActivePlan('user-1');

    expect(plan?.weeks[0].sessions[0]).toMatchObject({
      id: 'w1d0',
      actualActivityId: undefined,
    });
    expect(plan?.todayAnnotation).toBe('First week — keep it controlled and let consistency set the tone.');
    expect(plan?.coachAnnotation).toBeNull();

    const persisted = await planRepo.getActive('user-1');
    expect(persisted?.weeks[0].sessions[0]).toMatchObject({
      id: 'w1d0',
      actualActivityId: undefined,
    });
  });

  it('saves through one workflow boundary while preserving active plan profile and injury state', async () => {
    const profile = deriveTrainingPaceProfile({
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
    });
    await planRepo.save(makePlan({
      trainingPaceProfile: profile,
      activeInjury: {
        name: 'Calf strain',
        markedDate: '2026-04-10',
        rtrStep: 1,
        rtrStepCompletedDates: ['2026-04-12'],
        status: 'returning',
      },
    }));

    const saved = await workflow.savePlan('user-1', {
      raceName: 'Updated marathon',
      raceDate: '2026-10-18',
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
      phases: { BASE: 1, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
      progressionPct: 5,
      templateWeek: [null, null, null, null, null, null, null],
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 8,
          sessions: [
            {
              id: 'temporary-id',
              type: 'EASY',
              date: '2026-04-06',
              distance: 8,
              intensityTarget: {
                source: 'manual',
                mode: 'pace',
                paceRange: { min: '5:45', max: '5:15' },
              },
            },
            null, null, null, null, null, null,
          ],
        },
      ],
    });

    expect(saved).toMatchObject({
      id: 'plan-1',
      createdAt: '2026-01-01T00:00:00Z',
      raceName: 'Updated marathon',
      trainingPaceProfile: profile,
      activeInjury: expect.objectContaining({ name: 'Calf strain' }),
    });
    expect(saved.weeks[0].sessions[0]).toMatchObject({
      id: 'w1d0',
      pace: '5:30',
      intensityTarget: expect.objectContaining({
        paceRange: { min: '5:15', max: '5:45' },
      }),
    });
  });

  it('rejects saves whose phase total does not match the submitted weeks', async () => {
    await expect(workflow.savePlan('user-1', {
      raceName: 'Bad plan',
      raceDate: '2026-10-18',
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
      phases: { BASE: 2, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
      progressionPct: 5,
      templateWeek: [null, null, null, null, null, null, null],
      weeks: makePlan().weeks,
    })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Phase sum (2) does not match week count (1)',
    } satisfies Partial<PlanWorkflowError>);
  });

  it('updates active weeks with server-owned normalization', async () => {
    await planRepo.save(makePlan());

    const updated = await workflow.updateWeeks('user-1', [
      {
        weekNumber: 1,
        phase: 'BASE',
        plannedKm: 10,
        sessions: [
          {
            id: 'client-id',
            type: 'TEMPO',
            date: '2026-04-06',
            distance: 10,
            pace: '4:20',
            warmup: { unit: 'km', value: 2 },
            cooldown: { unit: 'km', value: 1 },
          },
          null, null, null, null, null, null,
        ],
      },
    ]);

    expect(updated?.weeks[0].sessions[0]).toMatchObject({
      id: 'w1d0',
      warmup: { unit: 'km', value: 2 },
      cooldown: { unit: 'km', value: 1 },
    });
  });

  it('marks a planned session skipped with the server timestamp', async () => {
    await planRepo.save(makePlan({
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 14,
          sessions: [
            {
              id: 'client-session-id',
              type: 'EASY',
              date: '2026-04-06',
              distance: 8,
              pace: '5:20',
            },
            {
              id: 'second-session',
              type: 'TEMPO',
              date: '2026-04-07',
              distance: 6,
              pace: '4:30',
            },
            null, null, null, null, null,
          ],
        },
      ],
    }));

    const updated = await workflow.markSessionSkipped('user-1', {
      sessionId: 'w1d0',
      reason: 'busy',
    });

    expect(updated?.weeks[0].sessions[0]).toMatchObject({
      id: 'w1d0',
      distance: 8,
      skipped: {
        reason: 'busy',
        markedAt: '2026-04-16T10:00:00.000Z',
      },
    });
    expect(updated?.weeks[0].sessions[1]).toMatchObject({ id: 'w1d1' });
    expect(updated?.weeks[0].sessions[1]?.skipped).toBeUndefined();

    const persisted = await planRepo.getActive('user-1');
    expect(persisted?.weeks[0].sessions[0]?.skipped).toEqual({
      reason: 'busy',
      markedAt: '2026-04-16T10:00:00.000Z',
    });
  });

  it('clears skipped status without changing the planned session', async () => {
    await planRepo.save(makePlan({
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 8,
          sessions: [
            {
              id: 'client-session-id',
              type: 'EASY',
              date: '2026-04-06',
              distance: 8,
              pace: '5:20',
              skipped: {
                reason: 'tired',
                markedAt: '2026-04-15T07:00:00.000Z',
              },
            },
            null, null, null, null, null, null,
          ],
        },
      ],
    }));

    const updated = await workflow.clearSessionSkipped('user-1', {
      sessionId: 'w1d0',
    });

    expect(updated?.weeks[0].sessions[0]).toMatchObject({
      id: 'w1d0',
      type: 'EASY',
      date: '2026-04-06',
      distance: 8,
      pace: '5:20',
    });
    expect(updated?.weeks[0].sessions[0]?.skipped).toBeUndefined();

    const persisted = await planRepo.getActive('user-1');
    expect(persisted?.weeks[0].sessions[0]?.skipped).toBeUndefined();
  });

  it('rejects skipped-session mutations when the session is not in the active plan', async () => {
    await planRepo.save(makePlan());

    await expect(workflow.markSessionSkipped('user-1', {
      sessionId: 'missing-session',
      reason: 'other',
    })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Session not found in active plan',
    } satisfies Partial<PlanWorkflowError>);
  });

  it('propagates training pace changes without rewriting matched, completed, manual, or legacy sessions', async () => {
    const before = deriveTrainingPaceProfile({
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
    });
    const after = {
      ...before,
      bands: {
        ...before.bands,
        threshold: {
          ...before.bands.threshold,
          paceRange: { min: '4:18', max: '4:28' },
        },
      },
    };
    const thresholdTarget = trainingPaceBandToIntensityTarget(before.bands.threshold);
    const futureProfileLinked: PlannedSession = {
      id: 'future-profile-linked',
      type: 'TEMPO',
      date: '2099-01-05',
      distance: 10,
      pace: '4:27',
      intensityTarget: thresholdTarget,
    };
    const matchedProfileLinked: PlannedSession = {
      ...futureProfileLinked,
      id: 'matched-profile-linked',
      date: '2099-01-06',
    };
    const completedProfileLinked: PlannedSession = {
      ...futureProfileLinked,
      id: 'completed-profile-linked',
      date: '2099-01-07',
      actualActivityId: 'activity-completed',
    };
    const manualSession: PlannedSession = {
      ...futureProfileLinked,
      id: 'manual-threshold',
      date: '2099-01-08',
      pace: '4:05',
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        profileKey: 'threshold',
        pace: '4:05',
      },
    };
    const legacySession: PlannedSession = {
      id: 'legacy-threshold',
      type: 'TEMPO',
      date: '2099-01-09',
      distance: 10,
      pace: '4:22',
    };
    await activityRepo.save(makeActivity({
      id: 'activity-matched',
      matchedSessionId: 'w1d1',
    }));
    await planRepo.save(makePlan({
      trainingPaceProfile: before,
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 50,
          sessions: [
            futureProfileLinked,
            matchedProfileLinked,
            completedProfileLinked,
            manualSession,
            legacySession,
            null,
            null,
          ],
        },
      ],
    }));

    await expect(workflow.updateTrainingPaceProfile('user-1', after)).resolves.toEqual(after);

    const saved = await planRepo.getActive('user-1');
    expect(saved?.weeks[0].sessions[0]).toMatchObject({
      pace: '4:23',
      intensityTarget: expect.objectContaining({
        source: 'profile',
        profileKey: 'threshold',
        paceRange: { min: '4:18', max: '4:28' },
      }),
    });
    expect(saved?.weeks[0].sessions[1]).toMatchObject({
      pace: '4:27',
      intensityTarget: thresholdTarget,
    });
    expect(saved?.weeks[0].sessions[2]).toMatchObject({
      pace: '4:27',
      intensityTarget: thresholdTarget,
      actualActivityId: 'activity-completed',
    });
    expect(saved?.weeks[0].sessions[3]).toMatchObject({
      pace: '4:05',
      intensityTarget: expect.objectContaining({ source: 'manual' }),
    });
    expect(saved?.weeks[0].sessions[4]).toMatchObject({
      pace: '4:22',
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        pace: '4:22',
      },
    });
  });
});
