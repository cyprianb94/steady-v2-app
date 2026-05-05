import type { Activity, PlannedSession } from '@steady/types';
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
