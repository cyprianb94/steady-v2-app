import { expectedDistance, type Activity, type PlannedSession } from '@steady/types';
import { activityLocalDate } from '../../lib/plan-helpers';

interface SessionActivityCandidateOptions {
  allowMatchedToSession?: boolean;
  windowDays?: number;
}

export function daysBetweenIsoDates(left: string, right: string): number {
  const leftTime = new Date(`${left}T00:00:00.000Z`).getTime();
  const rightTime = new Date(`${right}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round((leftTime - rightTime) / (24 * 60 * 60 * 1000));
}

export function isActivityWithinSessionWindow(
  activity: Activity,
  session: PlannedSession,
  windowDays = 1,
): boolean {
  return Math.abs(daysBetweenIsoDates(activityLocalDate(activity.startTime), session.date)) <= windowDays;
}

function isSyncedRunCandidate(
  session: PlannedSession,
  activity: Activity,
  { allowMatchedToSession = false, windowDays = 1 }: SessionActivityCandidateOptions,
): boolean {
  if (activity.source === 'manual') {
    return false;
  }

  if (activity.matchedSessionId && (!allowMatchedToSession || activity.matchedSessionId !== session.id)) {
    return false;
  }

  return isActivityWithinSessionWindow(activity, session, windowDays);
}

export function candidateActivitiesForSession(
  session: PlannedSession,
  activities: readonly Activity[],
  options: SessionActivityCandidateOptions = {},
): Activity[] {
  const plannedDistance = session.distance ?? expectedDistance(session);

  return activities
    .filter((activity) => isSyncedRunCandidate(session, activity, options))
    .sort((left, right) => {
      const leftDistanceDelta = Math.abs(left.distance - plannedDistance);
      const rightDistanceDelta = Math.abs(right.distance - plannedDistance);
      if (leftDistanceDelta !== rightDistanceDelta) {
        return leftDistanceDelta - rightDistanceDelta;
      }

      const leftDateDelta = Math.abs(daysBetweenIsoDates(activityLocalDate(left.startTime), session.date));
      const rightDateDelta = Math.abs(daysBetweenIsoDates(activityLocalDate(right.startTime), session.date));
      if (leftDateDelta !== rightDateDelta) {
        return leftDateDelta - rightDateDelta;
      }

      return right.startTime.localeCompare(left.startTime);
    });
}
