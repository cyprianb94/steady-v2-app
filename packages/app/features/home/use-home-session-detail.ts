import { useCallback, useMemo, useState } from 'react';
import type { Activity, PlannedSession } from '@steady/types';

interface UseHomeSessionDetailOptions {
  activityForSession: (session: PlannedSession | null) => Activity | undefined;
}

export function useHomeSessionDetail({ activityForSession }: UseHomeSessionDetailOptions) {
  const [selectedSession, setSelectedSession] = useState<PlannedSession | null>(null);

  const selectedActivity = useMemo(
    () => (selectedSession ? activityForSession(selectedSession) ?? null : null),
    [activityForSession, selectedSession],
  );

  const canOpenSessionDetail = useCallback(
    (session: PlannedSession | null) => Boolean(session && activityForSession(session)),
    [activityForSession],
  );

  const openSessionDetail = useCallback(
    (session: PlannedSession | null) => {
      if (!session) {
        return;
      }

      if (!activityForSession(session)) {
        return;
      }

      setSelectedSession(session);
    },
    [activityForSession],
  );

  const closeSessionDetail = useCallback(() => {
    setSelectedSession(null);
  }, []);

  return {
    selectedSession,
    selectedActivity,
    canOpenSessionDetail,
    openSessionDetail,
    closeSessionDetail,
  };
}
