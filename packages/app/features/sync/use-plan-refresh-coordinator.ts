import { useEffect, useRef } from 'react';

interface UsePlanRefreshCoordinatorOptions {
  enabled: boolean;
  isFocused: boolean;
  requestAutoSync?: () => Promise<unknown>;
  forceSync?: () => Promise<unknown>;
  refreshPlan: () => Promise<void>;
  syncRevision: number;
  autoSyncErrorMessage: string;
  syncRefreshErrorMessage: string;
  manualRefreshErrorMessage: string;
}

interface UsePlanRefreshCoordinatorResult {
  refreshManually: () => Promise<void>;
}

export function usePlanRefreshCoordinator({
  enabled,
  isFocused,
  requestAutoSync,
  forceSync,
  refreshPlan,
  syncRevision,
  autoSyncErrorMessage,
  syncRefreshErrorMessage,
  manualRefreshErrorMessage,
}: UsePlanRefreshCoordinatorOptions): UsePlanRefreshCoordinatorResult {
  const handledSyncRevisionRef = useRef(syncRevision);

  useEffect(() => {
    if (!enabled || !isFocused || !requestAutoSync) {
      return;
    }

    requestAutoSync().catch((error) => {
      console.error(autoSyncErrorMessage, error);
    });
  }, [autoSyncErrorMessage, enabled, isFocused, requestAutoSync]);

  useEffect(() => {
    if (!enabled || syncRevision === 0 || syncRevision === handledSyncRevisionRef.current) {
      return;
    }

    handledSyncRevisionRef.current = syncRevision;
    refreshPlan().catch((error) => {
      console.error(syncRefreshErrorMessage, error);
    });
  }, [enabled, refreshPlan, syncRefreshErrorMessage, syncRevision]);

  async function refreshManually() {
    try {
      await forceSync?.();
      await refreshPlan();
    } catch (error) {
      console.error(manualRefreshErrorMessage, error);
    }
  }

  return { refreshManually };
}
