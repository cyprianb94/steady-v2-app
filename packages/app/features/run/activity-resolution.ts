import { expectedDistance, type Activity, type PlannedSession } from '@steady/types';

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
      if (activity) {
        const plannedKm = expectedDistance(session);
        if (plannedKm > 0 && Math.abs(activity.distance - plannedKm) / plannedKm > 0.1) {
          return 'off-target';
        }
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
