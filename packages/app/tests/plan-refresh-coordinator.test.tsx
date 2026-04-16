import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanRefreshCoordinator } from '../features/sync/use-plan-refresh-coordinator';

describe('usePlanRefreshCoordinator', () => {
  const requestAutoSync = vi.fn();
  const forceSync = vi.fn();
  const refreshPlan = vi.fn();

  beforeEach(() => {
    requestAutoSync.mockReset();
    requestAutoSync.mockResolvedValue(null);
    forceSync.mockReset();
    forceSync.mockResolvedValue(null);
    refreshPlan.mockReset();
    refreshPlan.mockResolvedValue(undefined);
  });

  it('requests an auto-sync when the screen is focused and enabled', async () => {
    renderHook(() =>
      usePlanRefreshCoordinator({
        enabled: true,
        isFocused: true,
        requestAutoSync,
        forceSync,
        refreshPlan,
        syncRevision: 0,
        autoSyncErrorMessage: 'auto-sync failed',
        syncRefreshErrorMessage: 'sync refresh failed',
        manualRefreshErrorMessage: 'manual refresh failed',
      }),
    );

    await waitFor(() => {
      expect(requestAutoSync).toHaveBeenCalledTimes(1);
    });
    expect(refreshPlan).not.toHaveBeenCalled();
  });

  it('refreshes once for each new sync revision', async () => {
    const { rerender } = renderHook(
      ({ syncRevision }) =>
        usePlanRefreshCoordinator({
          enabled: true,
          isFocused: true,
          requestAutoSync,
          forceSync,
          refreshPlan,
          syncRevision,
          autoSyncErrorMessage: 'auto-sync failed',
          syncRefreshErrorMessage: 'sync refresh failed',
          manualRefreshErrorMessage: 'manual refresh failed',
        }),
      {
        initialProps: { syncRevision: 0 },
      },
    );

    rerender({ syncRevision: 1 });

    await waitFor(() => {
      expect(refreshPlan).toHaveBeenCalledTimes(1);
    });

    rerender({ syncRevision: 1 });
    rerender({ syncRevision: 2 });

    await waitFor(() => {
      expect(refreshPlan).toHaveBeenCalledTimes(2);
    });
  });

  it('runs a manual refresh through sync first and then refreshes the plan', async () => {
    const { result } = renderHook(() =>
      usePlanRefreshCoordinator({
        enabled: true,
        isFocused: true,
        requestAutoSync,
        forceSync,
        refreshPlan,
        syncRevision: 0,
        autoSyncErrorMessage: 'auto-sync failed',
        syncRefreshErrorMessage: 'sync refresh failed',
        manualRefreshErrorMessage: 'manual refresh failed',
      }),
    );

    await act(async () => {
      await result.current.refreshManually();
    });

    expect(forceSync).toHaveBeenCalledTimes(1);
    expect(refreshPlan).toHaveBeenCalledTimes(1);
  });
});
