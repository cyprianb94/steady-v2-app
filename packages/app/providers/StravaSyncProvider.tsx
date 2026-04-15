import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { StravaSyncResult } from '@steady/types';
import { trpc } from '../lib/trpc';
import { useAuth } from '../lib/auth';
import { isLikelyNetworkError } from '../lib/network-errors';
import { StravaSyncContext, type StravaStatus } from '../hooks/useStravaSync';
import { useToast } from './ToastProvider';

const AUTO_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

let lastSyncAt = 0;
let inFlightSync: Promise<StravaSyncResult | null> | null = null;

function weekdayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'long' });
}

function sessionLabel(sessionType: string): string {
  return `${sessionType.slice(0, 1)}${sessionType.slice(1).toLowerCase()}`;
}

function buildToastMessage(result: StravaSyncResult): string | null {
  if (result.matchedSessions.length === 1) {
    const session = result.matchedSessions[0];
    return `Matched your run to ${weekdayLabel(session.sessionDate)}'s ${sessionLabel(session.sessionType)}.`;
  }

  if (result.matched > 1) {
    return `Matched ${result.matched} activities to your plan.`;
  }

  if (result.new === 1) {
    return 'Synced 1 new activity.';
  }

  if (result.new > 1) {
    return `Synced ${result.new} new activities.`;
  }

  return null;
}

export function StravaSyncProvider({ children }: React.PropsWithChildren) {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<StravaSyncResult | null>(null);
  const [syncRevision, setSyncRevision] = useState(0);

  async function refreshStatus(): Promise<StravaStatus | null> {
    if (!session) {
      setStatus(null);
      return null;
    }

    try {
      const nextStatus = await trpc.strava.status.query();
      setStatus(nextStatus);
      return nextStatus;
    } catch (error) {
      if (!isLikelyNetworkError(error)) {
        console.log('Strava status bootstrap failed:', error);
      }
      setStatus(null);
      return null;
    }
  }

  async function runSync(force: boolean): Promise<StravaSyncResult | null> {
    if (!session) return null;

    const currentStatus = status ?? await refreshStatus();
    if (!currentStatus?.connected) return null;

    if (!force && Date.now() - lastSyncAt < AUTO_SYNC_COOLDOWN_MS) {
      return null;
    }

    if (inFlightSync) {
      return inFlightSync;
    }

    setSyncing(true);
    inFlightSync = (async () => {
      try {
        const result = await trpc.strava.sync.mutate();
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
        if (message.toLowerCase().includes('revoked')) {
          await refreshStatus();
          showToast('Strava disconnected — reconnect in Settings.', 'error');
        } else if (!message.toLowerCase().includes('not connected')) {
          showToast('Sync failed — try again later.', 'error');
        }
        return null;
      } finally {
        setSyncing(false);
        inFlightSync = null;
      }
    })();

    return inFlightSync;
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        runSync(false).catch((error) => {
          if (!isLikelyNetworkError(error)) {
            console.log('Strava foreground sync failed:', error);
          }
        });
      }
    });

    return () => subscription.remove();
  }, [session, status?.connected]);

  return (
    <StravaSyncContext.Provider
      value={{
        status,
        syncing,
        lastResult,
        syncRevision,
        refreshStatus,
        requestAutoSync: () => runSync(false),
        forceSync: () => runSync(true),
      }}
    >
      {children}
    </StravaSyncContext.Provider>
  );
}
