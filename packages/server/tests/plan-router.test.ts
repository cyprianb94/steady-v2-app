import { beforeEach, describe, expect, it } from 'vitest';
import { deriveTrainingPaceProfile, trainingPaceBandToIntensityTarget } from '@steady/types';
import type { Activity, PlannedSession, TrainingPlan, User } from '@steady/types';
import { createAppRouter } from '../src/trpc/router';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../src/repos/cross-training-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';

function makePlan(actualActivityId?: string, overrides: Partial<TrainingPlan> = {}): TrainingPlan {
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
    ...overrides,
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
    weeklyVolumeMetric: 'distance',
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

describe('plan router', () => {
  let planRepo: InMemoryPlanRepo;
  let activityRepo: InMemoryActivityRepo;
  let profileRepo: InMemoryProfileRepo;
  let caller: ReturnType<ReturnType<typeof createAppRouter>['createCaller']>;

  beforeEach(async () => {
    planRepo = new InMemoryPlanRepo();
    activityRepo = new InMemoryActivityRepo();
    profileRepo = new InMemoryProfileRepo();
    const appRouter = createAppRouter({
      profileRepo,
      planRepo,
      activityRepo,
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

  it('saves weeks with structured intensity targets through router validation', async () => {
    const saved = await caller.plan.save({
      raceName: 'London Marathon',
      raceDate: '2026-10-04',
      raceDistance: 'Marathon',
      targetTime: 'sub-3:30',
      phases: { BASE: 1, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
      progressionPct: 0,
      templateWeek: [null, null, null, null, null, null, null],
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 10,
          sessions: [
            {
              id: 'session-1',
              type: 'TEMPO',
              date: '2026-04-06',
              distance: 10,
              intensityTarget: {
                source: 'manual',
                mode: 'both',
                profileKey: 'threshold',
                paceRange: { min: '4:25', max: '4:15' },
                effortCue: 'controlled hard',
              },
            },
            null, null, null, null, null, null,
          ],
        },
      ],
    });

    expect(saved.weeks[0].sessions[0]).toMatchObject({
      pace: '4:20',
      intensityTarget: {
        paceRange: { min: '4:15', max: '4:25' },
      },
    });
  });

  it('saves and exposes the active plan training pace profile through stable router APIs', async () => {
    const profile = deriveTrainingPaceProfile({
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
    });

    const saved = await caller.plan.save({
      raceName: 'London Marathon',
      raceDate: '2026-10-04',
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
      phases: { BASE: 1, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
      progressionPct: 0,
      trainingPaceProfile: profile,
      templateWeek: [null, null, null, null, null, null, null],
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 0,
          sessions: [null, null, null, null, null, null, null],
        },
      ],
    });

    expect(saved.trainingPaceProfile).toEqual(profile);
    await expect(caller.plan.getTrainingPaceProfile()).resolves.toEqual(profile);

    const updatedProfile = {
      ...profile,
      bands: {
        ...profile.bands,
        easy: {
          ...profile.bands.easy,
          paceRange: { min: '5:15', max: '5:40' },
        },
      },
    };

    await expect(caller.plan.updateTrainingPaceProfile({
      trainingPaceProfile: updatedProfile,
    })).resolves.toEqual(updatedProfile);

    const plan = await caller.plan.get();
    expect(plan?.trainingPaceProfile?.bands.easy.paceRange).toEqual({
      min: '5:15',
      max: '5:40',
    });
  });

  it('returns null for legacy active plans without a stored training pace profile', async () => {
    await planRepo.save(makePlan());

    await expect(caller.plan.getTrainingPaceProfile()).resolves.toBeNull();
  });

  it('preserves an existing training pace profile when a legacy save omits it', async () => {
    const profile = deriveTrainingPaceProfile({
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
    });

    await planRepo.save(makePlan(undefined, {
      targetTime: 'sub-3:15',
      trainingPaceProfile: profile,
    }));

    const saved = await caller.plan.save({
      raceName: 'London Marathon',
      raceDate: '2026-10-04',
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
      phases: { BASE: 1, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
      progressionPct: 0,
      templateWeek: [null, null, null, null, null, null, null],
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 0,
          sessions: [null, null, null, null, null, null, null],
        },
      ],
    });

    expect(saved.trainingPaceProfile).toEqual(profile);
  });

  it('propagates profile saves to future linked sessions without rewriting fixed sessions', async () => {
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
        easy: {
          ...before.bands.easy,
          paceRange: { min: '5:20', max: '5:40' },
        },
      },
    };
    const thresholdTarget = trainingPaceBandToIntensityTarget(before.bands.threshold);
    const easyTarget = trainingPaceBandToIntensityTarget(before.bands.easy);
    const recoveryTarget = trainingPaceBandToIntensityTarget(before.bands.recovery);
    const fixedManual: PlannedSession = {
      id: 'manual-threshold',
      type: 'TEMPO',
      date: '2099-01-06',
      distance: 10,
      pace: '4:08',
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        profileKey: 'threshold',
        pace: '4:08',
      },
    };
    const fixedLegacy: PlannedSession = {
      id: 'legacy-threshold',
      type: 'TEMPO',
      date: '2099-01-07',
      distance: 10,
      pace: '4:20',
    };
    const matchedTempo: PlannedSession = {
      id: 'matched-threshold',
      type: 'TEMPO',
      date: '2099-01-08',
      distance: 10,
      pace: '4:27',
      intensityTarget: thresholdTarget,
    };
    const completedTempo: PlannedSession = {
      id: 'completed-threshold',
      type: 'TEMPO',
      date: '2099-01-09',
      distance: 10,
      pace: '4:27',
      intensityTarget: thresholdTarget,
      actualActivityId: 'activity-completed',
    };
    await activityRepo.save(makeActivity({
      id: 'activity-matched',
      matchedSessionId: 'w1d3',
    }));
    await planRepo.save(makePlan(undefined, {
      trainingPaceProfile: before,
      phases: { BASE: 1, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 60,
          sessions: [
            {
              id: 'future-threshold',
              type: 'TEMPO',
              date: '2099-01-05',
              distance: 10,
              pace: '4:20',
              intensityTarget: thresholdTarget,
            },
            fixedManual,
            fixedLegacy,
            matchedTempo,
            completedTempo,
            {
              id: 'future-easy',
              type: 'EASY',
              date: '2099-01-10',
              distance: 8,
              pace: '5:20',
              intensityTarget: easyTarget,
            },
            {
              id: 'future-recovery',
              type: 'EASY',
              date: '2099-01-11',
              distance: 5,
              pace: '6:20',
              intensityTarget: recoveryTarget,
            },
          ],
        },
      ],
    }));

    await expect(caller.plan.updateTrainingPaceProfile({
      trainingPaceProfile: after,
    })).resolves.toEqual(after);

    const saved = await planRepo.getActive('user-1');
    expect(saved?.weeks[0].sessions[0]).toMatchObject({
      pace: '4:23',
      intensityTarget: {
        source: 'profile',
        profileKey: 'threshold',
        paceRange: { min: '4:18', max: '4:28' },
      },
    });
    expect(saved?.weeks[0].sessions[1]).toMatchObject({
      pace: '4:08',
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        profileKey: 'threshold',
        pace: '4:08',
      },
    });
    expect(saved?.weeks[0].sessions[2]).toMatchObject({
      pace: '4:20',
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        pace: '4:20',
      },
    });
    expect(saved?.weeks[0].sessions[3]).toMatchObject({
      pace: '4:27',
      intensityTarget: thresholdTarget,
    });
    expect(saved?.weeks[0].sessions[4]).toMatchObject({
      pace: '4:27',
      intensityTarget: thresholdTarget,
      actualActivityId: 'activity-completed',
    });
    expect(saved?.weeks[0].sessions[5]).toMatchObject({
      pace: '5:30',
      intensityTarget: {
        profileKey: 'easy',
        paceRange: { min: '5:20', max: '5:40' },
      },
    });
    expect(saved?.weeks[0].sessions[6]).toMatchObject({
      intensityTarget: recoveryTarget,
    });
  });
});
