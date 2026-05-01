import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity } from '@steady/types';
import { trpc } from '../../lib/trpc';
import { logNonNetworkError } from '../../lib/network-errors';
import { createActivityResolution, type ActivityResolution } from './activity-resolution';
import {
  getScreenshotDemoActivities,
  isScreenshotDemoMode,
} from '../../demo/screenshot-demo';

interface UseActivityResolutionOptions {
  enabled: boolean;
  isFocused: boolean;
  planId?: string | null;
  syncRevision: number;
  today: string;
  fetchErrorMessage: string;
}

export function useActivityResolution({
  enabled,
  isFocused,
  planId,
  syncRevision,
  today,
  fetchErrorMessage,
}: UseActivityResolutionOptions): ActivityResolution {
  if (isScreenshotDemoMode()) {
    return createActivityResolution(getScreenshotDemoActivities(), { today });
  }

  const [activities, setActivities] = useState<Activity[]>([]);
  const activePlanIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      activePlanIdRef.current = null;
      setActivities([]);
      return;
    }

    if (!planId) {
      activePlanIdRef.current = null;
      setActivities([]);
      return;
    }

    const resolvedPlanId = planId;
    if (activePlanIdRef.current !== resolvedPlanId) {
      activePlanIdRef.current = resolvedPlanId;
      setActivities([]);
    }

    if (!isFocused) {
      return;
    }

    let cancelled = false;

    async function loadActivities() {
      try {
        const nextActivities = await trpc.activity.list.query();
        if (!cancelled) {
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

  return useMemo(() => createActivityResolution(activities, { today }), [activities, today]);
}
