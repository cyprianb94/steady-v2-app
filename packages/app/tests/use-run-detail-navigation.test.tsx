import { renderHook, act } from '@testing-library/react';
import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity, PlannedSession } from '@steady/types';

const { mockRouterPush, mockActivityGet } = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockActivityGet: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: {
    push: mockRouterPush,
  },
}));

vi.mock('../lib/trpc', () => ({
  trpc: {
    activity: {
      get: {
        query: mockActivityGet,
      },
    },
  },
}));

const session: PlannedSession = {
  id: 'session-1',
  type: 'EASY',
  date: '2026-04-15',
  distance: 8,
  pace: '5:20',
  actualActivityId: 'activity-1',
};

const activity: Activity = {
  id: 'activity-1',
  userId: 'runner-1',
  source: 'strava',
  externalId: 'strava-1',
  startTime: '2026-04-15T07:00:00.000Z',
  distance: 8.1,
  duration: 2580,
  avgPace: 319,
  splits: [],
  matchedSessionId: 'session-1',
};

describe('useRunDetailNavigation', () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockActivityGet.mockReset();
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('pushes immediately when the activity is already resolved in memory', async () => {
    const { useRunDetailNavigation } = await import('../features/run/use-run-detail-navigation');
    const { result } = renderHook(() => useRunDetailNavigation({
      activityForSession: () => activity,
      activityIdForSession: () => activity.id,
    }));

    await act(async () => {
      await result.current.openRunDetail(session);
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/sync-run/activity-1');
    expect(mockActivityGet).not.toHaveBeenCalled();
  });

  it('preflights unresolved linked activities before routing', async () => {
    mockActivityGet.mockResolvedValue(activity);
    const { useRunDetailNavigation } = await import('../features/run/use-run-detail-navigation');
    const { result } = renderHook(() => useRunDetailNavigation({
      activityForSession: () => undefined,
      activityIdForSession: () => activity.id,
    }));

    await act(async () => {
      await result.current.openRunDetail(session);
    });

    expect(mockActivityGet).toHaveBeenCalledWith({ activityId: 'activity-1' });
    expect(mockRouterPush).toHaveBeenCalledWith('/sync-run/activity-1');
  });

  it('alerts instead of routing when the linked activity no longer exists', async () => {
    mockActivityGet.mockResolvedValue(null);
    const { useRunDetailNavigation } = await import('../features/run/use-run-detail-navigation');
    const { result } = renderHook(() => useRunDetailNavigation({
      activityForSession: () => undefined,
      activityIdForSession: () => activity.id,
    }));

    await act(async () => {
      await result.current.openRunDetail(session);
    });

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Run unavailable',
      'This linked run is no longer available. Pull to refresh if it was just synced.',
    );
  });
});
