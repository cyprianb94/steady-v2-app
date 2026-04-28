import { describe, expect, it } from 'vitest';
import type {
  PlannedSession,
  PlanWeek,
  TrainingPaceProfile,
  TrainingPlan,
  TrainingPaceProfileKey,
} from '../src';
import {
  deriveTrainingPaceProfile,
  propagateTrainingPaceProfileUpdate,
  sessionKm,
  trainingPaceBandToIntensityTarget,
} from '../src';

function profile(overrides: Partial<TrainingPaceProfile['bands']> = {}): TrainingPaceProfile {
  const base = deriveTrainingPaceProfile({
    raceDistance: 'Marathon',
    targetTime: 'sub-3:15',
  });

  return {
    ...base,
    bands: {
      ...base.bands,
      ...overrides,
    },
  };
}

function linkedSession(
  id: string,
  date: string,
  profileKey: TrainingPaceProfileKey,
  sourceProfile: TrainingPaceProfile,
  overrides: Partial<PlannedSession> = {},
): PlannedSession {
  const target = trainingPaceBandToIntensityTarget(sourceProfile.bands[profileKey]);

  return {
    id,
    date,
    type: profileKey === 'interval' ? 'INTERVAL' : profileKey === 'threshold' ? 'TEMPO' : 'EASY',
    distance: profileKey === 'interval' ? undefined : 10,
    reps: profileKey === 'interval' ? 5 : undefined,
    repDuration: profileKey === 'interval' ? { unit: 'min', value: 4 } : undefined,
    recovery: profileKey === 'interval' ? { unit: 'min', value: 2 } : undefined,
    pace: target.pace ?? '4:00',
    intensityTarget: target,
    ...overrides,
  };
}

function week(weekNumber: number, sessions: (PlannedSession | null)[]): PlanWeek {
  const fullSessions = Array.from({ length: 7 }, (_, index) => sessions[index] ?? null);
  return {
    weekNumber,
    phase: 'BUILD',
    sessions: fullSessions,
    plannedKm: Math.round(fullSessions.reduce((sum, session) => sum + sessionKm(session), 0)),
  };
}

function planWith(
  trainingPaceProfile: TrainingPaceProfile,
  weeks: PlanWeek[],
): TrainingPlan {
  return {
    id: 'plan-1',
    userId: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    raceName: 'London Marathon',
    raceDate: '2026-10-04',
    raceDistance: 'Marathon',
    targetTime: 'sub-3:15',
    phases: { BASE: 0, BUILD: weeks.length, RECOVERY: 0, PEAK: 0, TAPER: 0 },
    progressionPct: 0,
    templateWeek: [null, null, null, null, null, null, null],
    weeks,
    trainingPaceProfile,
    activeInjury: null,
  };
}

describe('training pace profile propagation', () => {
  it('updates only future sessions linked to the changed profile band', () => {
    const before = profile();
    const after = profile({
      threshold: {
        ...before.bands.threshold,
        paceRange: { min: '4:18', max: '4:28' },
      },
    });
    const completedTempo = linkedSession(
      'completed-threshold',
      '2026-04-23',
      'threshold',
      before,
      { actualActivityId: 'activity-1' },
    );
    const futureTempo = linkedSession('future-threshold', '2026-05-05', 'threshold', before);
    const manualTempo = linkedSession('manual-threshold', '2026-05-06', 'threshold', before, {
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        profileKey: 'threshold',
        pace: '4:08',
      },
      pace: '4:08',
    });
    const legacyTempo = linkedSession('legacy-threshold', '2026-05-07', 'threshold', before, {
      pace: '4:20',
      intensityTarget: undefined,
    });
    const futureEasy = linkedSession('future-easy', '2026-05-08', 'easy', before);

    const result = propagateTrainingPaceProfileUpdate(
      planWith(before, [
        week(1, [completedTempo, futureTempo, manualTempo, legacyTempo, futureEasy]),
      ]),
      after,
      { today: '2026-04-28' },
    );

    expect(result.trainingPaceProfile).toEqual(after);
    expect(result.weeks[0].sessions[0]).toEqual(completedTempo);
    expect(result.weeks[0].sessions[1]).toMatchObject({
      pace: '4:23',
      intensityTarget: {
        source: 'profile',
        profileKey: 'threshold',
        paceRange: { min: '4:18', max: '4:28' },
      },
    });
    expect(result.weeks[0].sessions[2]).toEqual(manualTempo);
    expect(result.weeks[0].sessions[3]).toEqual(legacyTempo);
    expect(result.weeks[0].sessions[4]).toEqual(futureEasy);
  });

  it('preserves matched completed sessions even before actualActivityId reaches the plan', () => {
    const before = profile();
    const after = profile({
      threshold: {
        ...before.bands.threshold,
        paceRange: { min: '4:18', max: '4:28' },
      },
    });
    const matchedTempo = linkedSession('matched-threshold', '2026-05-05', 'threshold', before);

    const result = propagateTrainingPaceProfileUpdate(
      planWith(before, [week(1, [matchedTempo])]),
      after,
      {
        today: '2026-04-28',
        completedSessionIds: ['matched-threshold'],
      },
    );

    expect(result.weeks[0].sessions[0]).toEqual(matchedTempo);
  });

  it('keeps easy and recovery profile links independent', () => {
    const before = profile();
    const after = profile({
      easy: {
        ...before.bands.easy,
        paceRange: { min: '5:20', max: '5:40' },
      },
    });
    const futureEasy = linkedSession('future-easy', '2026-05-05', 'easy', before);
    const futureRecovery = linkedSession('future-recovery', '2026-05-06', 'recovery', before);

    const result = propagateTrainingPaceProfileUpdate(
      planWith(before, [week(1, [futureEasy, futureRecovery])]),
      after,
      { today: '2026-04-28' },
    );

    expect(result.weeks[0].sessions[0]).toMatchObject({
      pace: '5:30',
      intensityTarget: {
        profileKey: 'easy',
        paceRange: { min: '5:20', max: '5:40' },
      },
    });
    expect(result.weeks[0].sessions[1]).toEqual(futureRecovery);
  });

  it('does not destructively rewrite sessions when the profile is cleared', () => {
    const before = profile();
    const futureTempo = linkedSession('future-threshold', '2026-05-05', 'threshold', before);
    const plan = planWith(before, [week(1, [futureTempo])]);

    const result = propagateTrainingPaceProfileUpdate(plan, null, {
      today: '2026-04-28',
    });

    expect(result.trainingPaceProfile).toBeNull();
    expect(result.weeks).toEqual(plan.weeks);
  });

  it('recalculates planned kilometres when a profile pace affects interval duration targets', () => {
    const before = profile();
    const after = profile({
      interval: {
        ...before.bands.interval,
        paceRange: { min: '8:00', max: '8:00' },
      },
    });
    const interval = linkedSession('future-interval', '2026-05-05', 'interval', before);
    const plan = planWith(before, [week(1, [interval])]);

    const result = propagateTrainingPaceProfileUpdate(plan, after, {
      today: '2026-04-28',
    });

    const updatedInterval = result.weeks[0].sessions[0];
    expect(updatedInterval).toMatchObject({
      pace: '8:00',
      intensityTarget: {
        profileKey: 'interval',
        paceRange: { min: '8:00', max: '8:00' },
      },
    });
    expect(result.weeks[0].plannedKm).toBe(Math.round(sessionKm(updatedInterval) * 10) / 10);
    expect(result.weeks[0].plannedKm).not.toBe(plan.weeks[0].plannedKm);
  });
});
