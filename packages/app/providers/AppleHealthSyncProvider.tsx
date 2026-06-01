import React, { useEffect, useState } from 'react';
import type { ActivityImportResult } from '@steady/types';
import { trpc } from '../lib/trpc';
import { useAuth } from '../lib/auth';
import { isLikelyNetworkError } from '../lib/network-errors';
import { AppleHealthSyncContext, type AppleHealthStatus } from '../hooks/useAppleHealthSync';
import { useToast } from './ToastProvider';
import { isScreenshotDemoMode } from '../demo/screenshot-demo';
import {
  isAppleHealthSupported,
  readAppleHealthRuns,
  requestAppleHealthAuthorization,
} from '../features/apple-health/apple-health-client';

const AUTO_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const INITIAL_SYNC_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const SUBSEQUENT_SYNC_OVERLAP_MS = 7 * 24 * 60 * 60 * 1000;

let lastSyncAt = 0;
let inFlightSync: Promise<ActivityImportResult | null> | null = null;

function syncSinceDate(lastSyncedAt: string | null | undefined): Date {
  const fallback = new Date(Date.now() - INITIAL_SYNC_LOOKBACK_MS);
  if (!lastSyncedAt) return fallback;

  const parsed = new Date(lastSyncedAt);
  if (Number.isNaN(parsed.getTime())) return fallback;

  return new Date(parsed.getTime() - SUBSEQUENT_SYNC_OVERLAP_MS);
}

function buildToastMessage(result: ActivityImportResult): string | null {
  if (result.matchedSessions.length === 1) {
    return 'Matched your Apple Watch run to your plan.';
  }

  if (result.matched > 1) {
    return `Matched ${result.matched} Apple Watch runs to your plan.`;
  }

  const imported = result.imported + result.upgraded;
  if (imported === 1) {
    return 'Synced 1 Apple Watch run.';
  }

  if (imported > 1) {
    return `Synced ${imported} Apple Watch runs.`;
  }

  return null;
}

export function AppleHealthSyncProvider({ children }: React.PropsWithChildren) {
  if (isScreenshotDemoMode()) {
    const status: AppleHealthStatus = {
      connected: false,
      primaryRunSource: null,
      lastSyncedAt: null,
      supported: true,
    };

    return (
      <AppleHealthSyncContext.Provider
        value={{
          status,
          syncing: false,
          lastResult: null,
          syncRevision: 0,
          refreshStatus: async () => status,
          requestAutoSync: async () => null,
          forceSync: async () => null,
          connectAndSync: async () => null,
          disconnect: async () => {},
        }}
      >
        {children}
      </AppleHealthSyncContext.Provider>
    );
  }

  const { session } = useAuth();
  const { showToast } = useToast();
  const [status, setStatus] = useState<AppleHealthStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<ActivityImportResult | null>(null);
  const [syncRevision, setSyncRevision] = useState(0);

  async function refreshStatus(): Promise<AppleHealthStatus | null> {
    if (!session) {
      setStatus(null);
      return null;
    }

    try {
      const [remoteStatus, supported] = await Promise.all([
        trpc.appleHealth.status.query(),
        isAppleHealthSupported(),
      ]);
      const nextStatus: AppleHealthStatus = {
        ...remoteStatus,
        supported,
      };
      setStatus(nextStatus);
      return nextStatus;
    } catch (error) {
      if (!isLikelyNetworkError(error)) {
        console.log('Apple Health status bootstrap failed:', error);
      }
      setStatus(null);
      return null;
    }
  }

  async function runSync(force: boolean): Promise<ActivityImportResult | null> {
    if (!session) return null;

    const currentStatus = force
      ? (await refreshStatus()) ?? status
      : status ?? await refreshStatus();
    if (!currentStatus?.connected || currentStatus.supported === false) return null;

    if (!force && Date.now() - lastSyncAt < AUTO_SYNC_COOLDOWN_MS) {
      return null;
    }

    if (inFlightSync) {
      return inFlightSync;
    }

    setSyncing(true);
    inFlightSync = (async () => {
      try {
        const activities = await readAppleHealthRuns({
          since: syncSinceDate(currentStatus.lastSyncedAt),
        });
        const result = await trpc.appleHealth.sync.mutate({ activities });
        lastSyncAt = Date.now();
        setLastResult(result);
        setSyncRevision((value) => value + 1);
        await refreshStatus();

        const toastMessage = buildToastMessage(result);
        if (toastMessage) {
          showToast(toastMessage, 'success');
        }

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync error';
        if (!message.toLowerCase().includes('not connected')) {
          showToast('Apple Health sync failed — try again later.', 'error');
        }
        return null;
      } finally {
        setSyncing(false);
        inFlightSync = null;
      }
    })();

    return inFlightSync;
  }

  async function connectAndSync(): Promise<ActivityImportResult | null> {
    if (!session) return null;

    const authorized = await requestAppleHealthAuthorization();
    if (!authorized) {
      throw new Error('Apple Health permission was not granted.');
    }

    await trpc.appleHealth.connect.mutate();
    await refreshStatus();
    return runSync(true);
  }

  async function disconnect(): Promise<void> {
    if (!session) return;

    await trpc.appleHealth.disconnect.mutate();
    setLastResult(null);
    setSyncRevision((value) => value + 1);
    await refreshStatus();
  }

  useEffect(() => {
    if (!session) {
      setStatus(null);
      setLastResult(null);
      setSyncRevision(0);
      lastSyncAt = 0;
      return;
    }

    refreshStatus().catch(() => {});
  }, [session]);

  return (
    <AppleHealthSyncContext.Provider
      value={{
        status,
        syncing,
        lastResult,
        syncRevision,
        refreshStatus,
        requestAutoSync: () => runSync(false),
        forceSync: () => runSync(true),
        connectAndSync,
        disconnect,
      }}
    >
      {children}
    </AppleHealthSyncContext.Provider>
  );
}
