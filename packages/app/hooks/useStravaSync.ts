import { createContext, useContext } from 'react';
import type { StravaSyncResult } from '@steady/types';

export interface StravaStatus {
  connected: boolean;
  athleteId: string | null;
  lastSyncedAt: string | null;
}

export interface StravaSyncContextValue {
  status: StravaStatus | null;
  syncing: boolean;
  lastResult: StravaSyncResult | null;
  syncRevision: number;
  refreshStatus: () => Promise<StravaStatus | null>;
  requestAutoSync: () => Promise<StravaSyncResult | null>;
  forceSync: () => Promise<StravaSyncResult | null>;
}

export const StravaSyncContext = createContext<StravaSyncContextValue | null>(null);

export function useStravaSync(): StravaSyncContextValue {
  const value = useContext(StravaSyncContext);
  return value ?? {
    status: null,
    syncing: false,
    lastResult: null,
    syncRevision: 0,
    refreshStatus: async () => null,
    requestAutoSync: async () => null,
    forceSync: async () => null,
  };
}
