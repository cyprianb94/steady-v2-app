import { useEffect, useMemo, useState } from 'react';
import type { Activity } from '@steady/types';
import { trpc } from '../../lib/trpc';
import { createActivityResolution, type ActivityResolution } from './activity-resolution';

interface UseActivityResolutionOptions {
  enabled: boolean;
  isFocused: boolean;
  planId?: string | null;
  syncRevision: number;
  fetchErrorMessage: string;
}

export function useActivityResolution({
  enabled,
  isFocused,
  planId,
  syncRevision,
  fetchErrorMessage,
}: UseActivityResolutionOptions): ActivityResolution {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (!enabled || !isFocused || !planId) {
      setActivities([]);
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
        console.error(fetchErrorMessage, error);
        if (!cancelled) {
          setActivities([]);
        }
      }
    }

    loadActivities().catch((error) => {
      console.error(fetchErrorMessage, error);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, fetchErrorMessage, isFocused, planId, syncRevision]);

  return useMemo(() => createActivityResolution(activities), [activities]);
}
