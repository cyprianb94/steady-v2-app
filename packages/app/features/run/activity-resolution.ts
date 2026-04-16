import {
  DISTANCE_TOLERANCE_PCT,
  expectedDistance,
  type Activity,
  type PlannedSession,
} from '@steady/types';

export type ActivityDayStatus = 'completed' | 'off-target' | 'missed' | 'today' | 'upcoming' | 'rest';

interface SessionRef {
  id: string;
  actualActivityId?: string;
}

export interface ActivityResolution {
  activities: Activity[];
  activityById: Map<string, Activity>;
  activityByMatchedSessionId: Map<string, Activity>;
  activityForSession: (session: SessionRef | PlannedSession | null) => Activity | undefined;
  statusForDay: (
    session: PlannedSession | null,
    dayIndex: number,
    todayIndex: number,
  ) => ActivityDayStatus;
  weekActualKm: (sessions: readonly (PlannedSession | null)[]) => number;
}

function paceToSeconds(pace: string | undefined): number | null {
  if (!pace) {
    return null;
  }

  const [minutes, seconds] = pace.split(':').map(Number);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  return (minutes * 60) + seconds;
}

function isOffTarget(session: PlannedSession, activity: Activity): boolean {
  const plannedKm = expectedDistance(session);
  const distanceRatio = plannedKm > 0
    ? Number((Math.abs(activity.distance - plannedKm) / plannedKm).toFixed(4))
    : 0;
  const plannedPaceSeconds = paceToSeconds(session.pace);
  const paceRatio = plannedPaceSeconds && plannedPaceSeconds > 0
    ? Number((Math.abs(activity.avgPace - plannedPaceSeconds) / plannedPaceSeconds).toFixed(4))
    : 0;

  return distanceRatio > DISTANCE_TOLERANCE_PCT || paceRatio > DISTANCE_TOLERANCE_PCT;
}

export function createActivityResolution(activities: readonly Activity[]): ActivityResolution {
  const activityById = new Map(activities.map((activity) => [activity.id, activity] as const));
  const activityByMatchedSessionId = new Map(
    activities
      .filter((activity) => Boolean(activity.matchedSessionId))
      .map((activity) => [activity.matchedSessionId!, activity] as const),
  );

  function activityForSession(session: SessionRef | PlannedSession | null): Activity | undefined {
    if (!session) {
      return undefined;
    }

    if (session.actualActivityId) {
      return activityById.get(session.actualActivityId) ?? activityByMatchedSessionId.get(session.id);
    }

    return activityByMatchedSessionId.get(session.id);
  }

  function statusForDay(
    session: PlannedSession | null,
    dayIndex: number,
    todayIndex: number,
  ): ActivityDayStatus {
    if (!session || session.type === 'REST') {
      return 'rest';
    }

    if (session.actualActivityId) {
      const activity = activityForSession(session);
      if (activity && isOffTarget(session, activity)) {
        return 'off-target';
      }

      return 'completed';
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
    const total = sessions.reduce((sum, session) => sum + (activityForSession(session)?.distance ?? 0), 0);
    return Number(total.toFixed(1));
  }

  return {
    activities: [...activities],
    activityById,
    activityByMatchedSessionId,
    activityForSession,
    statusForDay,
    weekActualKm,
  };
}
