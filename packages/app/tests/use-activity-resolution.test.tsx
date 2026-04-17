import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity } from '@steady/types';

const mockActivityList = vi.hoisted(() => vi.fn());

vi.mock('../lib/trpc', () => ({
  trpc: {
    activity: {
      list: {
        query: mockActivityList,
      },
    },
  },
}));

const planId = 'plan-1';
const weekSessions = [
  {
    id: 'session-1',
    type: 'EASY' as const,
    date: '2026-04-15',
    distance: 8,
    pace: '5:20',
    actualActivityId: 'activity-1',
  },
];
const activities: Activity[] = [
  {
    id: 'activity-1',
    userId: 'user-1',
    source: 'strava',
    externalId: 'strava-1',
    startTime: '2026-04-15T07:15:00.000Z',
    distance: 8.2,
    duration: 2620,
    avgPace: 317,
    splits: [],
    matchedSessionId: 'session-1',
  },
];

describe('useActivityResolution', () => {
  beforeEach(() => {
    vi.resetModules();
    mockActivityList.mockReset();
  });

  it('hydrates a remounted screen from the last successful activity snapshot while the next fetch is in flight', async () => {
    mockActivityList.mockResolvedValueOnce(activities);
    const { useActivityResolution } = await import('../features/run/use-activity-resolution');

    const first = renderHook((props) => useActivityResolution(props), {
      initialProps: {
        enabled: true,
        isFocused: true,
        planId,
        syncRevision: 0,
        fetchErrorMessage: 'Failed to fetch activities:',
      },
    });

    await waitFor(() => expect(first.result.current.weekActualKm(weekSessions)).toBe(8.2));
    first.unmount();

    let resolveSecondFetch: ((value: Activity[]) => void) | null = null;
    mockActivityList.mockImplementationOnce(
      () => new Promise<Activity[]>((resolve) => {
        resolveSecondFetch = resolve;
      }),
    );

    const second = renderHook((props) => useActivityResolution(props), {
      initialProps: {
        enabled: true,
        isFocused: true,
        planId,
        syncRevision: 1,
        fetchErrorMessage: 'Failed to fetch activities:',
      },
    });

    expect(second.result.current.weekActualKm(weekSessions)).toBe(8.2);

    if (!resolveSecondFetch) {
      throw new Error('Expected the second activity fetch to be pending.');
    }

    (resolveSecondFetch as (value: Activity[]) => void)(activities);
    await waitFor(() => expect(second.result.current.weekActualKm(weekSessions)).toBe(8.2));
  });

  it('keeps the last successful activity snapshot visible across blur and refocus', async () => {
    mockActivityList.mockResolvedValueOnce(activities);
    const { useActivityResolution } = await import('../features/run/use-activity-resolution');

    const hook = renderHook((props) => useActivityResolution(props), {
      initialProps: {
        enabled: true,
        isFocused: true,
        planId,
        syncRevision: 0,
        fetchErrorMessage: 'Failed to fetch activities:',
      },
    });

    await waitFor(() => expect(hook.result.current.weekActualKm(weekSessions)).toBe(8.2));

    hook.rerender({
      enabled: true,
      isFocused: false,
      planId,
      syncRevision: 0,
      fetchErrorMessage: 'Failed to fetch activities:',
    });

    expect(hook.result.current.weekActualKm(weekSessions)).toBe(8.2);

    let resolveRefetch: ((value: Activity[]) => void) | null = null;
    mockActivityList.mockImplementationOnce(
      () => new Promise<Activity[]>((resolve) => {
        resolveRefetch = resolve;
      }),
    );

    hook.rerender({
      enabled: true,
      isFocused: true,
      planId,
      syncRevision: 1,
      fetchErrorMessage: 'Failed to fetch activities:',
    });

    expect(hook.result.current.weekActualKm(weekSessions)).toBe(8.2);

    if (!resolveRefetch) {
      throw new Error('Expected the refetch to be pending.');
    }

    (resolveRefetch as (value: Activity[]) => void)(activities);
    await waitFor(() => expect(hook.result.current.weekActualKm(weekSessions)).toBe(8.2));
  });

  it('suppresses expected network errors so the app does not redbox on entry', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockActivityList.mockRejectedValueOnce(
      new Error('Network request failed while calling http://192.168.1.103:3000.'),
    );

    try {
      const { useActivityResolution } = await import('../features/run/use-activity-resolution');

      renderHook((props) => useActivityResolution(props), {
        initialProps: {
          enabled: true,
          isFocused: true,
          planId,
          syncRevision: 0,
          fetchErrorMessage: 'Failed to fetch activities:',
        },
      });

      await waitFor(() => {
        expect(mockActivityList).toHaveBeenCalledTimes(1);
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    }
  });
});
