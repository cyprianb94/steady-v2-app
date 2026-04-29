import {
  expectedDistance,
  summariseVsPlan,
  type Activity,
  type PlannedSession,
} from '@steady/types';
import { activityLocalDate } from '../../lib/plan-helpers';

export type ActivityDayStatus = 'completed' | 'off-target' | 'missed' | 'skipped' | 'today' | 'upcoming' | 'rest';
export type ActivityCompletionStatus = Extract<ActivityDayStatus, 'completed' | 'off-target'>;

interface SessionRef {
  id: string;
  date?: string;
  actualActivityId?: string;
}

interface CreateActivityResolutionOptions {
  today?: string;
}

export interface ActivityResolution {
  activities: Activity[];
  activityById: Map<string, Activity>;
  activityByMatchedSessionId: Map<string, Activity>;
  activityForSession: (session: SessionRef | PlannedSession | null) => Activity | undefined;
  activityIdForSession: (session: SessionRef | PlannedSession | null) => string | null;
  isSessionComplete: (session: SessionRef | PlannedSession | null) => boolean;
  completionStatusForSession: (session: PlannedSession | null) => ActivityCompletionStatus | null;
  statusForDay: (
    session: PlannedSession | null,
    dayIndex: number,
    todayIndex: number,
  ) => ActivityDayStatus;
  weekActualKm: (sessions: readonly (PlannedSession | null)[]) => number;
}

function isOffTarget(session: PlannedSession, activity: Activity): boolean {
  return summariseVsPlan(session, activity).headline !== 'on-target';
}

function isActivityCompatibleWithSession(
  session: SessionRef | PlannedSession,
  activity: Activity,
): boolean {
  return 'date' in session ? activityLocalDate(activity.startTime) === session.date : true;
}

function isFutureSession(
  session: SessionRef | PlannedSession | null,
  today?: string,
): boolean {
  if (!today || !session?.date) {
    return false;
  }

  return session.date > today;
}

function roundDistanceKm(value: number): number {
  return Math.round(value * 10) / 10;
}

export function createActivityResolution(
  activities: readonly Activity[],
  options: CreateActivityResolutionOptions = {},
): ActivityResolution {
  const { today } = options;
  const activityById = new Map(activities.map((activity) => [activity.id, activity] as const));
  const activityByMatchedSessionId = new Map(
    activities
      .filter((activity) => Boolean(activity.matchedSessionId))
      .map((activity) => [activity.matchedSessionId!, activity] as const),
  );

  function matchedActivityForSession(session: SessionRef | PlannedSession | null): Activity | undefined {
    if (!session) {
      return undefined;
    }

    const matchedActivity = activityByMatchedSessionId.get(session.id);
    if (!matchedActivity || !isActivityCompatibleWithSession(session, matchedActivity)) {
      return undefined;
    }

    return matchedActivity;
  }

  function activityForSession(session: SessionRef | PlannedSession | null): Activity | undefined {
    if (!session) {
      return undefined;
    }

    if (session.actualActivityId) {
      const linkedActivity = activityById.get(session.actualActivityId);
      if (linkedActivity) {
        return isActivityCompatibleWithSession(session, linkedActivity)
          ? linkedActivity
          : undefined;
      }
    }

    return matchedActivityForSession(session);
  }

  function activityIdForSession(session: SessionRef | PlannedSession | null): string | null {
    if (!session) {
      return null;
    }

    if (session.actualActivityId) {
      const linkedActivity = activityById.get(session.actualActivityId);
      if (linkedActivity) {
        return isActivityCompatibleWithSession(session, linkedActivity)
          ? linkedActivity.id
          : null;
      }
      return isFutureSession(session, today) ? null : session.actualActivityId;
    }

    return matchedActivityForSession(session)?.id ?? null;
  }

  function isSessionComplete(session: SessionRef | PlannedSession | null): boolean {
    if (!session) {
      return false;
    }

    if (session.actualActivityId) {
      const linkedActivity = activityById.get(session.actualActivityId);
      if (linkedActivity) {
        return isActivityCompatibleWithSession(session, linkedActivity);
      }
      return !isFutureSession(session, today);
    }

    return Boolean(matchedActivityForSession(session));
  }

  function completionStatusForSession(session: PlannedSession | null): ActivityCompletionStatus | null {
    if (!session || session.type === 'REST') {
      return null;
    }

    const activity = activityForSession(session);
    if (!activity) {
      if (!session.actualActivityId) {
        return null;
      }

      const linkedActivity = activityById.get(session.actualActivityId);
      if (linkedActivity) {
        return null;
      }

      return isFutureSession(session, today) ? null : 'completed';
    }

    return isOffTarget(session, activity) ? 'off-target' : 'completed';
  }

  function statusForDay(
    session: PlannedSession | null,
    dayIndex: number,
    todayIndex: number,
  ): ActivityDayStatus {
    if (!session || session.type === 'REST') {
      return 'rest';
    }

    const completionStatus = completionStatusForSession(session);
    if (completionStatus) {
      return completionStatus;
    }

    if (session.skipped) {
      return 'skipped';
    }

    if (dayIndex < todayIndex) {
      return 'missed';
    }

    if (dayIndex === todayIndex) {
      return 'today';
    }

    return 'upcoming';
  }

  function weekActualKm(sessions: readonly (PlannedSession | null)[]): number {
    const total = sessions.reduce((sum, session) => {
      if (!session || session.type === 'REST') {
        return sum;
      }

      const actualDistance = activityForSession(session)?.distance;
      if (typeof actualDistance === 'number') {
        return sum + roundDistanceKm(actualDistance);
      }

      if (!session.actualActivityId) {
        return sum;
      }

      const linkedActivity = activityById.get(session.actualActivityId);
      if (linkedActivity || isFutureSession(session, today)) {
        return sum;
      }

      return sum + roundDistanceKm(expectedDistance(session));
    }, 0);
    return roundDistanceKm(total);
  }

  return {
    activities: [...activities],
    activityById,
    activityByMatchedSessionId,
    activityForSession,
    activityIdForSession,
    isSessionComplete,
    completionStatusForSession,
    statusForDay,
    weekActualKm,
  };
}
