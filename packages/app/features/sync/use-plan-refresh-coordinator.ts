import { useEffect, useRef } from 'react';
import { logNonNetworkError } from '../../lib/network-errors';

interface UsePlanRefreshCoordinatorOptions {
  enabled: boolean;
  isFocused: boolean;
  forceSync?: () => Promise<unknown>;
  refreshPlan: () => Promise<void>;
  refreshPlanWithIndicator: () => Promise<void>;
  syncRevision: number;
  syncRefreshErrorMessage: string;
  manualRefreshErrorMessage: string;
}

interface UsePlanRefreshCoordinatorResult {
  refreshManually: () => Promise<void>;
}

export function usePlanRefreshCoordinator({
  enabled,
  isFocused,
  forceSync,
  refreshPlan,
  refreshPlanWithIndicator,
  syncRevision,
  syncRefreshErrorMessage,
  manualRefreshErrorMessage,
}: UsePlanRefreshCoordinatorOptions): UsePlanRefreshCoordinatorResult {
  const handledSyncRevisionRef = useRef(syncRevision);

  useEffect(() => {
    if (!enabled || !isFocused || syncRevision === 0 || syncRevision === handledSyncRevisionRef.current) {
      return;
    }

    handledSyncRevisionRef.current = syncRevision;
    refreshPlan().catch((error) => {
      logNonNetworkError(syncRefreshErrorMessage, error);
    });
  }, [enabled, isFocused, refreshPlan, syncRefreshErrorMessage, syncRevision]);

  async function refreshManually() {
    try {
      await forceSync?.();
      await refreshPlanWithIndicator();
    } catch (error) {
      logNonNetworkError(manualRefreshErrorMessage, error);
    }
  }

  return { refreshManually };
}
