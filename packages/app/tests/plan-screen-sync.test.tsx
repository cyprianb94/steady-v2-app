import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanScreenSync } from '../app/(tabs)/plan-screen-sync';

describe('usePlanScreenSync', () => {
  const requestAutoSync = vi.fn();
  const refresh = vi.fn();

  beforeEach(() => {
    requestAutoSync.mockReset();
    requestAutoSync.mockResolvedValue(null);
    refresh.mockReset();
    refresh.mockResolvedValue(undefined);
  });

  it('requests an auto-sync when the screen is focused and enabled', async () => {
    renderHook(() =>
      usePlanScreenSync({
        enabled: true,
        isFocused: true,
        requestAutoSync,
        refresh,
        syncRevision: 0,
        autoSyncErrorMessage: 'auto-sync failed',
        refreshErrorMessage: 'refresh failed',
      }),
    );

    await waitFor(() => {
      expect(requestAutoSync).toHaveBeenCalledTimes(1);
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes once for each new sync revision', async () => {
    const { rerender } = renderHook(
      ({ syncRevision }) =>
        usePlanScreenSync({
          enabled: true,
          isFocused: true,
          requestAutoSync,
          refresh,
          syncRevision,
          autoSyncErrorMessage: 'auto-sync failed',
          refreshErrorMessage: 'refresh failed',
        }),
      {
        initialProps: { syncRevision: 0 },
      },
    );

    rerender({ syncRevision: 1 });

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    rerender({ syncRevision: 1 });
    rerender({ syncRevision: 2 });

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
  });
});
