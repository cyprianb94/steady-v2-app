import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRouterBack,
  mockRouterReplace,
  mockUseLocalSearchParams,
  mockActivityList,
  mockShoeList,
  mockSaveRunDetail,
  mockRefreshActivity,
} = vi.hoisted(() => ({
  mockRouterBack: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockUseLocalSearchParams: vi.fn(() => ({ activityId: 'activity-1' })),
  mockActivityList: vi.fn(),
  mockShoeList: vi.fn(),
  mockSaveRunDetail: vi.fn(),
  mockRefreshActivity: vi.fn(),
}));

const mockRefreshPlan = vi.hoisted(() => vi.fn());
const mockPlanState = vi.hoisted(() => ({
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
}));

vi.mock('expo-router', () => ({
  router: {
    back: mockRouterBack,
    replace: mockRouterReplace,
  },
  useLocalSearchParams: mockUseLocalSearchParams,
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => ({
    currentWeek: mockPlanState.currentWeek,
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
    shoe: {
      list: {
        query: mockShoeList,
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
    mockShoeList.mockReset();
    mockSaveRunDetail.mockReset();
    mockRefreshActivity.mockReset();
    mockPlanState.currentWeek = {
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
    };
    mockRefreshPlan.mockReset();
    mockRefreshPlan.mockResolvedValue(undefined);
    mockShoeList.mockResolvedValue([]);
    mockSaveRunDetail.mockResolvedValue({
      activity: {
        id: 'activity-1',
        source: 'strava',
        startTime: '2026-04-15T07:15:00.000Z',
        distance: 8.2,
        duration: 2650,
        avgPace: 323,
        avgHR: 148,
        splits: [],
      },
      niggles: [],
    });
    mockRefreshActivity.mockResolvedValue({
      id: 'activity-1',
      source: 'strava',
      startTime: '2026-04-15T07:15:00.000Z',
      distance: 8.2,
      duration: 2650,
      avgPace: 323,
      avgHR: 148,
      splits: [],
    });
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('defaults a same-day partial run to today’s planned session', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const sessions = [null, null, null, null, null, null, null] as any[];
    const day = new Date(`${today}T00:00:00Z`).getUTCDay();
    const index = day === 0 ? 6 : day - 1;
    sessions[index] = { id: 'today-session', type: 'EASY', date: today, distance: 8, pace: '5:10' };
    mockPlanState.currentWeek = {
      weekNumber: 1,
      phase: 'BASE',
      plannedKm: 12,
      sessions,
    };
    mockActivityList.mockResolvedValue([
      {
        id: 'activity-1',
        source: 'strava',
        startTime: `${today}T07:15:00.000Z`,
        distance: 12.01,
        duration: 4300,
        avgPace: 358,
        avgHR: 148,
        splits: [],
        matchedSessionId: null,
      },
    ]);

    render(<SyncRunDetailScreen />);

    expect(await screen.findByText('EASY · MATCHED TO TODAY')).toBeTruthy();
    expect(screen.getByText('8km Easy Run')).toBeTruthy();
  });

  it('saves the staged shoe and niggles from the modal pickers', async () => {
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
        niggles: [],
      },
    ]);
    mockShoeList.mockResolvedValue([
      {
        id: 'shoe-1',
        userId: 'runner-1',
        brand: 'Nike',
        model: 'Pegasus 40',
        stravaGearId: 'gear-1',
        retired: false,
        retireAtKm: 800,
        totalKm: 312,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    ]);

    render(<SyncRunDetailScreen />);

    await screen.findByText('Run detail');

    fireEvent.click(screen.getByText('Change ›'));
    fireEvent.click(await screen.findByText('Nike Pegasus 40'));
    fireEvent.click((await screen.findAllByText('Done')).at(-1)!);

    fireEvent.click(screen.getByText('Flag a niggle'));
    fireEvent.click(await screen.findByText('Hamstring'));
    fireEvent.click(screen.getByText('Left'));
    fireEvent.click(screen.getByText('Mild'));
    fireEvent.click(screen.getByText('During'));
    fireEvent.click(screen.getByText('Add niggle'));

    fireEvent.click(screen.getByText('Fresh'));
    fireEvent.click(screen.getByText('Easy'));
    fireEvent.click(screen.getByText('Could go again'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockSaveRunDetail).toHaveBeenCalledWith(expect.objectContaining({
        shoeId: 'shoe-1',
        niggles: [
          { bodyPart: 'hamstring', side: 'left', severity: 'mild', when: 'during' },
        ],
      }));
    });
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
