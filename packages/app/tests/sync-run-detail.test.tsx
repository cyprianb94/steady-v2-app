import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRouterBack,
  mockRouterReplace,
  mockUseLocalSearchParams,
  mockActivityList,
  mockSaveRunDetail,
  mockRefreshActivity,
} = vi.hoisted(() => ({
  mockRouterBack: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockUseLocalSearchParams: vi.fn(() => ({ activityId: 'activity-1' })),
  mockActivityList: vi.fn(),
  mockSaveRunDetail: vi.fn(),
  mockRefreshActivity: vi.fn(),
}));

const mockRefreshPlan = vi.hoisted(() => vi.fn());

vi.mock('expo-router', () => ({
  router: {
    back: mockRouterBack,
    replace: mockRouterReplace,
  },
  useLocalSearchParams: mockUseLocalSearchParams,
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => ({
    currentWeek: {
      weekNumber: 1,
      phase: 'BASE',
      plannedKm: 12,
      sessions: [
        null,
        null,
        { id: 'today-session', type: 'EASY', date: '2026-04-15', distance: 8, pace: '5:10' },
        null,
        null,
        null,
        null,
      ],
    },
    refresh: mockRefreshPlan,
  }),
}));

vi.mock('../providers/preferences-context', () => ({
  usePreferences: () => ({ units: 'metric' }),
}));

vi.mock('../lib/trpc', () => ({
  trpc: {
    activity: {
      list: {
        query: mockActivityList,
      },
      saveRunDetail: {
        mutate: mockSaveRunDetail,
      },
    },
    strava: {
      refreshActivity: {
        mutate: mockRefreshActivity,
      },
    },
  },
}));

import SyncRunDetailScreen from '../app/sync-run/[activityId]';

describe('SyncRunDetailScreen', () => {
  beforeEach(() => {
    mockRouterBack.mockReset();
    mockRouterReplace.mockReset();
    mockUseLocalSearchParams.mockReset();
    mockUseLocalSearchParams.mockReturnValue({ activityId: 'activity-1' });
    mockActivityList.mockReset();
    mockSaveRunDetail.mockReset();
    mockRefreshActivity.mockReset();
    mockRefreshPlan.mockReset();
    mockRefreshPlan.mockResolvedValue(undefined);
    mockSaveRunDetail.mockResolvedValue(null);
    mockRefreshActivity.mockResolvedValue(null);
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('surfaces a stale match warning instead of silently keeping a dead selection', async () => {
    mockActivityList.mockResolvedValue([
      {
        id: 'activity-1',
        source: 'strava',
        startTime: '2026-04-14T07:15:00.000Z',
        distance: 8.2,
        duration: 2650,
        avgPace: 323,
        avgHR: 148,
        splits: [],
        matchedSessionId: 'old-session',
      },
    ]);

    render(<SyncRunDetailScreen />);

    expect(await screen.findByText('Previous match needs review')).toBeTruthy();
    expect(screen.getAllByText('Bonus run').length).toBeGreaterThan(0);
  });

  it('navigates home after saving even when the follow-up plan refresh fails', async () => {
    mockActivityList.mockResolvedValue([
      {
        id: 'activity-1',
        source: 'strava',
        startTime: '2026-04-15T07:15:00.000Z',
        distance: 8.2,
        duration: 2650,
        avgPace: 323,
        avgHR: 148,
        splits: [],
        matchedSessionId: null,
      },
    ]);
    mockRefreshPlan.mockRejectedValue(new Error('refresh failed'));

    render(<SyncRunDetailScreen />);

    await screen.findByText('Run detail');

    fireEvent.click(screen.getByText('Fresh'));
    fireEvent.click(screen.getByText('Easy'));
    fireEvent.click(screen.getByText('Could go again'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockSaveRunDetail).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/home');
    });

    expect(Alert.alert).toHaveBeenCalledWith('Run saved', 'We could not refresh the plan yet, but your run was saved.');
  });

  it('offers recovery when the requested run is missing', async () => {
    mockActivityList.mockResolvedValue([]);

    render(<SyncRunDetailScreen />);

    expect(await screen.findByText('This run is no longer available')).toBeTruthy();

    fireEvent.click(screen.getByText('Back to picker'));

    expect(mockRouterReplace).toHaveBeenCalledWith('/sync-run');
  });
});
