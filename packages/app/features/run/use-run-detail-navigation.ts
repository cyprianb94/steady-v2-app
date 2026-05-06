import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import type { Activity, PlannedSession } from '@steady/types';
import { trpc } from '../../lib/trpc';

interface UseRunDetailNavigationOptions {
  activityForSession: (session: PlannedSession | null) => Activity | undefined;
  activityIdForSession: (session: PlannedSession | null) => string | null;
  returnTo?: 'block';
  returnWeekNumber?: number | null;
}

function resolveRunDetailActivityId(
  session: PlannedSession | null,
  activityIdForSession: (session: PlannedSession | null) => string | null,
): string | null {
  if (!session) {
    return null;
  }

  return activityIdForSession(session);
}

export function useRunDetailNavigation({
  activityForSession,
  activityIdForSession,
  returnTo,
  returnWeekNumber,
}: UseRunDetailNavigationOptions) {
  const canOpenRunDetail = useCallback(
    (session: PlannedSession | null) => Boolean(resolveRunDetailActivityId(session, activityIdForSession)),
    [activityIdForSession],
  );

  const pushRunDetail = useCallback(
    (activityId: string) => {
      if (returnTo === 'block') {
        const params = new URLSearchParams({ returnTo: 'block' });
        if (returnWeekNumber != null) {
          params.set('returnWeekNumber', String(returnWeekNumber));
        }
        router.push(`/sync-run/${encodeURIComponent(activityId)}?${params.toString()}`);
        return;
      }

      router.push(`/sync-run/${activityId}`);
    },
    [returnTo, returnWeekNumber],
  );

  const openRunDetail = useCallback(
    async (session: PlannedSession | null) => {
      const activity = activityForSession(session);
      if (activity) {
        pushRunDetail(activity.id);
        return;
      }

      const activityId = resolveRunDetailActivityId(session, activityIdForSession);
      if (!activityId) {
        return;
      }

      try {
        const verifiedActivity = await trpc.activity.get.query({ activityId });
        if (!verifiedActivity) {
          Alert.alert(
            'Run unavailable',
            'This linked run is no longer available. Pull to refresh if it was just synced.',
          );
          return;
        }

        pushRunDetail(verifiedActivity.id);
      } catch (error) {
        console.warn('Failed to preflight run detail activity:', error);
        Alert.alert('Could not open run', 'Please try again in a moment.');
      }
    },
    [activityForSession, activityIdForSession, pushRunDetail],
  );

  return {
    canOpenRunDetail,
    openRunDetail,
  };
}
