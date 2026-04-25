import {
  expectedDistance,
  type Activity,
  type PlannedSession,
  type PlanWeek,
  type SkippedSessionReason,
} from '@steady/types';
import { activityLocalDate } from '../../lib/plan-helpers';
import type { ActivityDayStatus } from '../run/activity-resolution';

export function canOpenResolveSessionSheet(
  session: PlannedSession | null,
  status: ActivityDayStatus,
): session is PlannedSession {
  return Boolean(
    session
    && session.type !== 'REST'
    && status === 'missed'
    && !session.actualActivityId
    && !session.skipped,
  );
}

export function canOpenHomeSessionRow({
  session,
  status,
  hasRunDetail,
}: {
  session: PlannedSession | null;
  status: ActivityDayStatus;
  hasRunDetail: boolean;
}): boolean {
  return hasRunDetail || canOpenResolveSessionSheet(session, status);
}

export function possibleActivityMatchesForSession(
  session: PlannedSession,
  activities: readonly Activity[],
): Activity[] {
  const plannedDistance = session.distance ?? expectedDistance(session);

  return activities
    .filter((activity) => (
      activity.source !== 'manual'
      && !activity.matchedSessionId
      && activityLocalDate(activity.startTime) === session.date
    ))
    .sort((left, right) => {
      const leftDistanceDelta = Math.abs(left.distance - plannedDistance);
      const rightDistanceDelta = Math.abs(right.distance - plannedDistance);
      if (leftDistanceDelta !== rightDistanceDelta) {
        return leftDistanceDelta - rightDistanceDelta;
      }

      return right.startTime.localeCompare(left.startTime);
    });
}

export function markSessionSkippedInWeeks({
  weeks,
  sessionId,
  reason,
  markedAt,
}: {
  weeks: readonly PlanWeek[];
  sessionId: string;
  reason: SkippedSessionReason;
  markedAt: string;
}): PlanWeek[] {
  return weeks.map((week) => ({
    ...week,
    sessions: week.sessions.map((session) => (
      session?.id === sessionId
        ? {
            ...session,
            skipped: {
              reason,
              markedAt,
            },
          }
        : session
    )),
  }));
}
