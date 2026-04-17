import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanRefreshCoordinator } from '../features/sync/use-plan-refresh-coordinator';

describe('usePlanRefreshCoordinator', () => {
  const forceSync = vi.fn();
  const refreshPlan = vi.fn();
  const refreshPlanWithIndicator = vi.fn();

  beforeEach(() => {
    forceSync.mockReset();
    forceSync.mockResolvedValue(null);
    refreshPlan.mockReset();
    refreshPlan.mockResolvedValue(undefined);
    refreshPlanWithIndicator.mockReset();
    refreshPlanWithIndicator.mockResolvedValue(undefined);
  });

  it('refreshes when a new sync revision arrives on the focused screen', async () => {
    const { rerender } = renderHook(
      ({ isFocused, syncRevision }) =>
        usePlanRefreshCoordinator({
          enabled: true,
          isFocused,
          forceSync,
          refreshPlan,
          refreshPlanWithIndicator,
          syncRevision,
          syncRefreshErrorMessage: 'sync refresh failed',
          manualRefreshErrorMessage: 'manual refresh failed',
        }),
      {
        initialProps: { isFocused: false, syncRevision: 0 },
      },
    );

    rerender({ isFocused: false, syncRevision: 1 });

    expect(refreshPlan).not.toHaveBeenCalled();

    rerender({ isFocused: true, syncRevision: 1 });

    await waitFor(() => {
      expect(refreshPlan).toHaveBeenCalledTimes(1);
    });

    rerender({ isFocused: true, syncRevision: 1 });
    rerender({ isFocused: true, syncRevision: 2 });

    await waitFor(() => {
      expect(refreshPlan).toHaveBeenCalledTimes(2);
    });
    expect(refreshPlanWithIndicator).not.toHaveBeenCalled();
  });

  it('runs a manual refresh through sync first and then refreshes the plan', async () => {
    const { result } = renderHook(() =>
      usePlanRefreshCoordinator({
        enabled: true,
        isFocused: true,
        forceSync,
        refreshPlan,
        refreshPlanWithIndicator,
        syncRevision: 0,
        syncRefreshErrorMessage: 'sync refresh failed',
        manualRefreshErrorMessage: 'manual refresh failed',
      }),
    );

    await act(async () => {
      await result.current.refreshManually();
    });

    expect(forceSync).toHaveBeenCalledTimes(1);
    expect(refreshPlan).not.toHaveBeenCalled();
    expect(refreshPlanWithIndicator).toHaveBeenCalledTimes(1);
  });

  it('suppresses expected network errors during manual refresh', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    refreshPlanWithIndicator.mockRejectedValueOnce(new Error('Network request failed'));

    try {
      const { result } = renderHook(() =>
        usePlanRefreshCoordinator({
          enabled: true,
          isFocused: true,
          forceSync,
          refreshPlan,
          refreshPlanWithIndicator,
          syncRevision: 0,
          syncRefreshErrorMessage: 'sync refresh failed',
          manualRefreshErrorMessage: 'manual refresh failed',
        }),
      );

      await act(async () => {
        await result.current.refreshManually();
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    }
  });
});
