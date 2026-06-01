import { createContext, useContext } from 'react';
import type { ActivityImportResult, PrimaryRunSource } from '@steady/types';

export interface AppleHealthStatus {
  connected: boolean;
  primaryRunSource: PrimaryRunSource | null;
  lastSyncedAt: string | null;
  supported: boolean | null;
}

export interface AppleHealthSyncContextValue {
  status: AppleHealthStatus | null;
  syncing: boolean;
  lastResult: ActivityImportResult | null;
  syncRevision: number;
  refreshStatus: () => Promise<AppleHealthStatus | null>;
  requestAutoSync: () => Promise<ActivityImportResult | null>;
  forceSync: () => Promise<ActivityImportResult | null>;
  connectAndSync: () => Promise<ActivityImportResult | null>;
  disconnect: () => Promise<void>;
}

export const AppleHealthSyncContext = createContext<AppleHealthSyncContextValue | null>(null);

export function useAppleHealthSync(): AppleHealthSyncContextValue {
  const value = useContext(AppleHealthSyncContext);
  return value ?? {
    status: null,
    syncing: false,
    lastResult: null,
    syncRevision: 0,
    refreshStatus: async () => null,
    requestAutoSync: async () => null,
    forceSync: async () => null,
    connectAndSync: async () => null,
    disconnect: async () => {},
  };
}
