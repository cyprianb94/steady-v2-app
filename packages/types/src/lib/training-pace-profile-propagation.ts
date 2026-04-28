import type { PlannedSession, TrainingPaceProfileKey } from '../session';
import type { PlanWeek, TrainingPlan } from '../plan';
import {
  normalizeIntensityTarget,
  normalizeSessionIntensityTarget,
} from './intensity-targets';
import { sessionKm } from './session-km';
import {
  TRAINING_PACE_PROFILE_BAND_ORDER,
  normalizeTrainingPaceProfile,
  trainingPaceBandToIntensityTarget,
  type TrainingPaceProfile,
} from './training-pace-profile';

export interface PropagateTrainingPaceProfileUpdateOptions {
  today: string;
  completedSessionIds?: Iterable<string>;
}

function targetFingerprint(
  profile: TrainingPaceProfile,
  profileKey: TrainingPaceProfileKey,
): string {
  return JSON.stringify(trainingPaceBandToIntensityTarget(profile.bands[profileKey]));
}

function changedProfileKeys(
  previousProfile: TrainingPaceProfile | null,
  nextProfile: TrainingPaceProfile | null,
): Set<TrainingPaceProfileKey> {
  if (!nextProfile) {
    return new Set();
  }

  if (!previousProfile) {
    return new Set(TRAINING_PACE_PROFILE_BAND_ORDER);
  }

  return new Set(
    TRAINING_PACE_PROFILE_BAND_ORDER.filter((profileKey) => (
      targetFingerprint(previousProfile, profileKey) !== targetFingerprint(nextProfile, profileKey)
    )),
  );
}

function shouldUpdateSession(
  session: PlannedSession,
  changedKeys: Set<TrainingPaceProfileKey>,
  completedSessionIds: Set<string>,
  today: string,
): TrainingPaceProfileKey | null {
  if (session.date <= today || session.actualActivityId || completedSessionIds.has(session.id)) {
    return null;
  }

  const target = normalizeIntensityTarget(session.intensityTarget);
  if (target?.source !== 'profile' || !target.profileKey || !changedKeys.has(target.profileKey)) {
    return null;
  }

  return target.profileKey;
}

function applyProfileTargetToSession(
  session: PlannedSession,
  nextProfile: TrainingPaceProfile,
  profileKey: TrainingPaceProfileKey,
): PlannedSession {
  const band = nextProfile.bands[profileKey];
  if (!band) {
    return session;
  }

  return normalizeSessionIntensityTarget({
    ...session,
    intensityTarget: trainingPaceBandToIntensityTarget(band),
  });
}

function recalculatePlannedKm(sessions: readonly (PlannedSession | null)[]): number {
  return Math.round(sessions.reduce((sum, session) => sum + sessionKm(session), 0) * 10) / 10;
}

function propagateWeeks(
  weeks: PlanWeek[],
  nextProfile: TrainingPaceProfile | null,
  changedKeys: Set<TrainingPaceProfileKey>,
  options: PropagateTrainingPaceProfileUpdateOptions,
): PlanWeek[] {
  if (!nextProfile || changedKeys.size === 0) {
    return weeks;
  }

  const completedSessionIds = new Set(options.completedSessionIds ?? []);

  return weeks.map((week) => {
    let changed = false;
    const sessions = week.sessions.map((session) => {
      if (!session || session.type === 'REST') {
        return session;
      }

      const profileKey = shouldUpdateSession(
        session,
        changedKeys,
        completedSessionIds,
        options.today,
      );
      if (!profileKey) {
        return session;
      }

      changed = true;
      return applyProfileTargetToSession(session, nextProfile, profileKey);
    });

    return changed
      ? { ...week, sessions, plannedKm: recalculatePlannedKm(sessions) }
      : week;
  });
}

export function propagateTrainingPaceProfileUpdate(
  plan: TrainingPlan,
  trainingPaceProfile: TrainingPaceProfile | null,
  options: PropagateTrainingPaceProfileUpdateOptions,
): TrainingPlan {
  const previousProfile = normalizeTrainingPaceProfile(plan.trainingPaceProfile);
  const nextProfile = normalizeTrainingPaceProfile(trainingPaceProfile);
  const changedKeys = changedProfileKeys(previousProfile, nextProfile);

  return {
    ...plan,
    trainingPaceProfile: nextProfile,
    weeks: propagateWeeks(plan.weeks, nextProfile, changedKeys, options),
  };
}
