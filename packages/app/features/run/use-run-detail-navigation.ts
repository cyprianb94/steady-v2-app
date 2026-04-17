import { useCallback } from 'react';
import { router } from 'expo-router';
import type { Activity, PlannedSession } from '@steady/types';

interface UseRunDetailNavigationOptions {
  activityForSession: (session: PlannedSession | null) => Activity | undefined;
}

function resolveRunDetailActivityId(
  session: PlannedSession | null,
  activityForSession: (session: PlannedSession | null) => Activity | undefined,
): string | null {
  if (!session) {
    return null;
  }

  return session.actualActivityId ?? activityForSession(session)?.id ?? null;
}

export function useRunDetailNavigation({ activityForSession }: UseRunDetailNavigationOptions) {
  const canOpenRunDetail = useCallback(
    (session: PlannedSession | null) => Boolean(resolveRunDetailActivityId(session, activityForSession)),
    [activityForSession],
  );

  const openRunDetail = useCallback(
    (session: PlannedSession | null) => {
      const activityId = resolveRunDetailActivityId(session, activityForSession);
      if (!activityId) {
        return;
      }

      router.push(`/sync-run/${activityId}`);
    },
    [activityForSession],
  );

  return {
    canOpenRunDetail,
    openRunDetail,
  };
}
