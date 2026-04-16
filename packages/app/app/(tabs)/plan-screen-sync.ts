import { useEffect, useRef } from 'react';

interface PlanScreenSyncOptions {
  enabled: boolean;
  isFocused: boolean;
  requestAutoSync?: () => Promise<unknown>;
  refresh: () => Promise<void>;
  syncRevision: number;
  autoSyncErrorMessage: string;
  refreshErrorMessage: string;
}

export function usePlanScreenSync({
  enabled,
  isFocused,
  requestAutoSync,
  refresh,
  syncRevision,
  autoSyncErrorMessage,
  refreshErrorMessage,
}: PlanScreenSyncOptions) {
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
    refresh().catch((error) => {
      console.error(refreshErrorMessage, error);
    });
  }, [enabled, refresh, refreshErrorMessage, syncRevision]);
}
