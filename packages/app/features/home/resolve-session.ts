import type { Activity, PlannedSession, PlanWeek, SkippedSessionReason } from '@steady/types';
import { candidateActivitiesForSession } from '../run/session-activity-candidates';
import type { ActivityDayStatus } from '../run/activity-resolution';

export function canOpenResolveSessionSheet(
  session: PlannedSession | null,
  status: ActivityDayStatus,
): session is PlannedSession {
  const isInspectablePlannedStatus =
    status === 'missed'
    || status === 'today'
    || status === 'upcoming'
    || status === 'skipped';

  return Boolean(
    session
    && session.type !== 'REST'
    && isInspectablePlannedStatus
    && !session.actualActivityId
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
  return candidateActivitiesForSession(session, activities);
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

export function clearSessionSkippedInWeeks({
  weeks,
  sessionId,
}: {
  weeks: readonly PlanWeek[];
  sessionId: string;
}): PlanWeek[] {
  return weeks.map((week) => ({
    ...week,
    sessions: week.sessions.map((session) => {
      if (session?.id !== sessionId) {
        return session;
      }

      const { skipped: _skipped, ...sessionWithoutSkipped } = session;
      return sessionWithoutSkipped;
    }),
  }));
}
