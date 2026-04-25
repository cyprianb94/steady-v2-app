import { useCallback, useEffect, useState } from 'react';
import type { CrossTrainingEntry, Injury, TrainingPlanWithAnnotation } from '@steady/types';
import { trpc } from '../../lib/trpc';
import { logNonNetworkError } from '../../lib/network-errors';
import {
  getScreenshotDemoCrossTrainingEntries,
  isScreenshotDemoMode,
} from '../../demo/screenshot-demo';

export type RecoveryDataScope =
  | { type: 'week'; weekStartDate: string }
  | { type: 'range'; startDate: string; endDate: string };

interface UseRecoveryDataOptions {
  plan: TrainingPlanWithAnnotation | null;
  enabled: boolean;
  isFocused: boolean;
  injury?: Injury | null;
  scope: RecoveryDataScope | null;
  fetchErrorMessage: string;
}

interface UseRecoveryDataResult {
  activeInjury: Injury | null;
  isRecoveryActive: boolean;
  entries: CrossTrainingEntry[];
  isLoadingEntries: boolean;
  refreshEntries: () => Promise<void>;
}

function getActiveInjury(plan: TrainingPlanWithAnnotation | null): Injury | null {
  return plan?.activeInjury && plan.activeInjury.status !== 'resolved' ? plan.activeInjury : null;
}

export function useRecoveryData({
  plan,
  enabled,
  isFocused,
  injury = undefined,
  scope,
  fetchErrorMessage,
}: UseRecoveryDataOptions): UseRecoveryDataResult {
  const activeInjury = getActiveInjury(plan);
  const recoveryInjury = injury === undefined ? activeInjury : injury;
  const visibleActiveInjury =
    recoveryInjury && recoveryInjury.status !== 'resolved' ? recoveryInjury : null;

  if (isScreenshotDemoMode()) {
    return {
      activeInjury: visibleActiveInjury,
      isRecoveryActive: Boolean(visibleActiveInjury),
      entries: getScreenshotDemoCrossTrainingEntries(),
      isLoadingEntries: false,
      refreshEntries: async () => {},
    };
  }

  const [entries, setEntries] = useState<CrossTrainingEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const scopeType = scope?.type ?? null;
  const weekStartDate = scope?.type === 'week' ? scope.weekStartDate : null;
  const startDate = scope?.type === 'range' ? scope.startDate : null;
  const endDate = scope?.type === 'range' ? scope.endDate : null;

  const refreshEntries = useCallback(async () => {
    if (!enabled || !isFocused || !recoveryInjury || !scopeType) {
      setEntries([]);
      setIsLoadingEntries(false);
      return;
    }

    setIsLoadingEntries(true);

    try {
      const nextEntries = scopeType === 'week'
        ? await trpc.crossTraining.getForWeek.query({ weekStartDate: weekStartDate! })
        : await trpc.crossTraining.getForDateRange.query({
          startDate: startDate!,
          endDate: endDate!,
        });

      setEntries(nextEntries);
    } catch (error) {
      logNonNetworkError(fetchErrorMessage, error);
      setEntries([]);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [enabled, endDate, fetchErrorMessage, isFocused, recoveryInjury, scopeType, startDate, weekStartDate]);

  useEffect(() => {
    if (!enabled || !isFocused || !recoveryInjury || !scopeType) {
      setEntries([]);
      setIsLoadingEntries(false);
      return;
    }

    let cancelled = false;

    async function loadEntries() {
      setIsLoadingEntries(true);

      try {
        const nextEntries = scopeType === 'week'
          ? await trpc.crossTraining.getForWeek.query({ weekStartDate: weekStartDate! })
          : await trpc.crossTraining.getForDateRange.query({
            startDate: startDate!,
            endDate: endDate!,
          });

        if (!cancelled) {
          setEntries(nextEntries);
        }
      } catch (error) {
        logNonNetworkError(fetchErrorMessage, error);
        if (!cancelled) {
          setEntries([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingEntries(false);
        }
      }
    }

    loadEntries().catch((error) => {
      logNonNetworkError(fetchErrorMessage, error);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, endDate, fetchErrorMessage, isFocused, recoveryInjury, scopeType, startDate, weekStartDate]);

  return {
    activeInjury: visibleActiveInjury,
    isRecoveryActive: Boolean(visibleActiveInjury),
    entries,
    isLoadingEntries,
    refreshEntries,
  };
}
