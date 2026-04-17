import { useEffect, useMemo, useState } from 'react';
import type { Activity } from '@steady/types';
import { trpc } from '../../lib/trpc';
import { logNonNetworkError } from '../../lib/network-errors';
import { createActivityResolution, type ActivityResolution } from './activity-resolution';

interface UseActivityResolutionOptions {
  enabled: boolean;
  isFocused: boolean;
  planId?: string | null;
  syncRevision: number;
  fetchErrorMessage: string;
}

const activitySnapshotCache = new Map<string, Activity[]>();

function readCachedActivities(planId?: string | null): Activity[] {
  return planId ? (activitySnapshotCache.get(planId) ?? []) : [];
}

export function useActivityResolution({
  enabled,
  isFocused,
  planId,
  syncRevision,
  fetchErrorMessage,
}: UseActivityResolutionOptions): ActivityResolution {
  const [activities, setActivities] = useState<Activity[]>(() => readCachedActivities(planId));

  useEffect(() => {
    if (!enabled) {
      activitySnapshotCache.clear();
      setActivities([]);
      return;
    }

    if (!planId) {
      setActivities([]);
      return;
    }

    const resolvedPlanId = planId;
    setActivities(readCachedActivities(resolvedPlanId));

    if (!isFocused) {
      return;
    }

    let cancelled = false;

    async function loadActivities() {
      try {
        const nextActivities = await trpc.activity.list.query();
        if (!cancelled) {
          activitySnapshotCache.set(resolvedPlanId, nextActivities);
          setActivities(nextActivities);
        }
      } catch (error) {
        logNonNetworkError(fetchErrorMessage, error);
      }
    }

    loadActivities().catch((error) => {
      logNonNetworkError(fetchErrorMessage, error);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, fetchErrorMessage, isFocused, planId, syncRevision]);

  return useMemo(() => createActivityResolution(activities), [activities]);
}
