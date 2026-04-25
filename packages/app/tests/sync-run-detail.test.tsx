import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDaysIso, dayIndexForIsoDate, startOfWeekIso, todayIsoLocal } from '../lib/plan-helpers';

const {
  mockRouterBack,
  mockRouterReplace,
  mockUseLocalSearchParams,
  mockActivityGet,
  mockShoeList,
  mockSaveRunDetail,
  mockRefreshActivity,
} = vi.hoisted(() => ({
  mockRouterBack: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockUseLocalSearchParams: vi.fn<() => { activityId: string | string[] }>(() => ({ activityId: 'activity-1' })),
  mockActivityGet: vi.fn(),
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
      get: {
        query: mockActivityGet,
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
    mockActivityGet.mockReset();
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
    mockActivityGet.mockResolvedValue({
      id: 'activity-1',
      source: 'strava',
      startTime: '2026-04-15T07:15:00.000Z',
      distance: 8.2,
      duration: 2650,
      avgPace: 323,
      avgHR: 148,
      splits: [],
      matchedSessionId: null,
    });
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
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes array route params and loads the requested run once', async () => {
    mockUseLocalSearchParams.mockImplementation(() => ({ activityId: ['activity-1'] }));
    mockActivityGet.mockResolvedValue({
      id: 'activity-1',
      source: 'strava',
      startTime: '2026-04-15T07:15:00.000Z',
      distance: 8.2,
      duration: 2650,
      avgPace: 323,
      avgHR: 148,
      splits: [],
      matchedSessionId: null,
    });

    render(<SyncRunDetailScreen />);

    expect(await screen.findByText('Run detail')).toBeTruthy();
    await waitFor(() => {
      expect(mockActivityGet).toHaveBeenCalledTimes(1);
      expect(mockShoeList).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('This run is no longer available')).toBeNull();
  });

  it('fails out of the loading state when the run fetch hangs', async () => {
    vi.useFakeTimers();
    mockActivityGet.mockImplementation(() => new Promise(() => {}));

    render(<SyncRunDetailScreen />);

    await act(async () => {
      vi.advanceTimersByTime(8000);
      await Promise.resolve();
    });

    expect(screen.getByText('This run is no longer available')).toBeTruthy();
    expect(screen.getByText('We could not refresh this run. Try again or go back to the picker.')).toBeTruthy();
  });

  it('still renders the run when shoe loading fails', async () => {
    mockActivityGet.mockResolvedValue({
      id: 'activity-1',
      source: 'strava',
      startTime: '2026-04-15T07:15:00.000Z',
      distance: 8.2,
      duration: 2650,
      avgPace: 323,
      avgHR: 148,
      splits: [],
      matchedSessionId: null,
      shoeId: 'shoe-1',
    });
    mockShoeList.mockRejectedValue(new Error('shoe list failed'));

    render(<SyncRunDetailScreen />);

    expect(await screen.findByText('Run detail')).toBeTruthy();
    expect(screen.getByText('Not tracked')).toBeTruthy();
    expect(screen.queryByText('This run is no longer available')).toBeNull();
  });

  it('surfaces a stale match warning instead of silently keeping a dead selection', async () => {
    mockActivityGet.mockResolvedValue({
      id: 'activity-1',
      source: 'strava',
      startTime: '2026-04-14T07:15:00.000Z',
      distance: 8.2,
      duration: 2650,
      avgPace: 323,
      avgHR: 148,
      splits: [],
      matchedSessionId: 'old-session',
    });

    render(<SyncRunDetailScreen />);

    expect(await screen.findByText('Previous match needs review')).toBeTruthy();
    expect(screen.getAllByText('Bonus run').length).toBeGreaterThan(0);
  });

  it('defaults a same-day partial run to today’s planned session', async () => {
    const today = todayIsoLocal();
    const sessions = [null, null, null, null, null, null, null] as any[];
    const index = dayIndexForIsoDate(today);
    sessions[index] = { id: 'today-session', type: 'EASY', date: today, distance: 8, pace: '5:10' };
    mockPlanState.currentWeek = {
      weekNumber: 1,
      phase: 'BASE',
      plannedKm: 12,
      sessions,
    };
    mockActivityGet.mockResolvedValue({
      id: 'activity-1',
      source: 'strava',
      startTime: `${today}T07:15:00.000Z`,
      distance: 12.01,
      duration: 4300,
      avgPace: 358,
      avgHR: 148,
      splits: [],
      matchedSessionId: null,
    });

    render(<SyncRunDetailScreen />);

    expect(await screen.findByText('EASY · MATCHED TO TODAY')).toBeTruthy();
    expect(screen.getByText('8km Easy Run')).toBeTruthy();
  });

  it('treats a just-after-midnight local run as today even when its UTC date is still yesterday', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T23:30:00Z'));
    const timezoneOffsetSpy = vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-60);

    try {
      const today = todayIsoLocal();
      const sessions = [null, null, null, null, null, null, null] as any[];
      const index = dayIndexForIsoDate(today);
      sessions[index] = { id: 'today-session', type: 'EASY', date: today, distance: 8, pace: '5:10' };
      mockPlanState.currentWeek = {
        weekNumber: 1,
        phase: 'BASE',
        plannedKm: 12,
        sessions,
      };
      mockActivityGet.mockResolvedValue({
        id: 'activity-1',
        source: 'strava',
        startTime: '2026-04-19T23:15:00.000Z',
        distance: 12.01,
        duration: 4300,
        avgPace: 358,
        avgHR: 148,
        splits: [],
        matchedSessionId: null,
      });

      render(<SyncRunDetailScreen />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText('EASY · MATCHED TO TODAY')).toBeTruthy();
      expect(screen.getByText('8km Easy Run')).toBeTruthy();
    } finally {
      timezoneOffsetSpy.mockRestore();
    }
  });

  it('does not auto-match to today when that session is already linked to another run', async () => {
    const today = todayIsoLocal();
    const sessions = [null, null, null, null, null, null, null] as any[];
    const index = dayIndexForIsoDate(today);
    sessions[index] = {
      id: 'today-session',
      type: 'EASY',
      date: today,
      distance: 8,
      pace: '5:10',
      actualActivityId: 'other-activity',
    };
    mockPlanState.currentWeek = {
      weekNumber: 1,
      phase: 'BASE',
      plannedKm: 12,
      sessions,
    };
    mockActivityGet.mockResolvedValue({
      id: 'activity-1',
      source: 'strava',
      startTime: `${today}T07:15:00.000Z`,
      distance: 12.01,
      duration: 4300,
      avgPace: 358,
      avgHR: 148,
      splits: [],
      matchedSessionId: null,
    });

    render(<SyncRunDetailScreen />);

    expect(await screen.findByText('UNMATCHED · BONUS RUN')).toBeTruthy();
    expect(screen.getByText("Didn't match a planned session")).toBeTruthy();
  });

  it('shows the slot-corrected weekday for stale session dates in the match picker', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T12:00:00.000Z'));
    const timezoneOffsetSpy = vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0);
    const today = todayIsoLocal();
    const todayIndex = dayIndexForIsoDate(today);
    const weekStart = startOfWeekIso(today);
    const targetIndex = todayIndex === 5 ? 4 : 5;
    const expectedDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][targetIndex];
    const staleDate = addDaysIso(weekStart, todayIndex === 0 ? 1 : 0);
    const staleDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIndexForIsoDate(staleDate)];
    const sessions = [null, null, null, null, null, null, null] as any[];

    sessions[todayIndex] = { id: 'today-long', type: 'LONG', date: staleDate, distance: 20, pace: '5:10' };
    sessions[targetIndex] = { id: 'target-tempo', type: 'TEMPO', date: staleDate, distance: 10, pace: '4:20' };

    mockPlanState.currentWeek = {
      weekNumber: 1,
      phase: 'BASE',
      plannedKm: 30,
      sessions,
    };
    mockActivityGet.mockResolvedValue({
      id: 'activity-1',
      source: 'strava',
      startTime: `${today}T07:15:00.000Z`,
      distance: 13.5,
      duration: 4300,
      avgPace: 318,
      avgHR: 148,
      splits: [],
      matchedSessionId: null,
    });

    try {
      render(<SyncRunDetailScreen />);

      await act(async () => {
        await Promise.resolve();
      });

      fireEvent.click(screen.getByText('LONG · MATCHED TO TODAY'));

      expect(screen.getByText(`${expectedDay} · 10km Tempo`)).toBeTruthy();
      expect(screen.queryByText(`${staleDay} · 10km Tempo`)).toBeNull();
    } finally {
      timezoneOffsetSpy.mockRestore();
    }
  });

  it('does not offer future planned sessions when matching a completed run', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T12:00:00.000Z'));
    const timezoneOffsetSpy = vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0);

    try {
      mockPlanState.currentWeek = {
        weekNumber: 1,
        phase: 'BASE',
        plannedKm: 64,
        sessions: [
          { id: 'mon', type: 'EASY', date: '2026-04-20', distance: 8, pace: '5:20' },
          { id: 'tue', type: 'TEMPO', date: '2026-04-21', distance: 10, pace: '4:20' },
          null,
          { id: 'thu', type: 'INTERVAL', date: '2026-04-23', reps: 5, repDist: 800, pace: '4:00' },
          { id: 'fri', type: 'EASY', date: '2026-04-24', distance: 8, pace: '6:00' },
          { id: 'sat', type: 'EASY', date: '2026-04-25', distance: 10, pace: '5:20' },
          { id: 'sun', type: 'LONG', date: '2026-04-26', distance: 20, pace: '5:10' },
        ] as any[],
      };
      mockActivityGet.mockResolvedValue({
        id: 'activity-1',
        source: 'strava',
        startTime: '2026-04-24T07:15:00.000Z',
        distance: 10.3,
        duration: 3529,
        avgPace: 343,
        avgHR: 147,
        splits: [],
        matchedSessionId: null,
      });

      render(<SyncRunDetailScreen />);

      await act(async () => {
        await Promise.resolve();
      });

      fireEvent.click(screen.getByText('EASY · MATCHED TO TODAY'));

      expect(screen.getByText('Today · 8km Easy Run')).toBeTruthy();
      expect(screen.getByText('Mon · 8km Easy Run')).toBeTruthy();
      expect(screen.getByText('Thu · 5×800m Intervals')).toBeTruthy();
      expect(screen.queryByText('Sat · 10km Easy Run')).toBeNull();
      expect(screen.queryByText('Sun · 20km Long Run')).toBeNull();
    } finally {
      timezoneOffsetSpy.mockRestore();
    }
  });

  it('keeps shoe selection below feel, removes the placeholder shoe art, and hides manual Strava re-sync', async () => {
    mockActivityGet.mockResolvedValue({
      id: 'activity-1',
      source: 'strava',
      startTime: '2026-04-15T07:15:00.000Z',
      distance: 8.2,
      duration: 2650,
      avgPace: 323,
      avgHR: 148,
      splits: [],
      matchedSessionId: null,
      shoeId: 'shoe-1',
    });
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

    const bodyText = document.body.textContent ?? '';
    expect(bodyText.indexOf('How did it feel?')).toBeLessThan(bodyText.indexOf('Shoe'));
    expect(bodyText.indexOf('Shoe')).toBeLessThan(bodyText.indexOf('Notes'));
    expect(screen.queryByText('Re-sync from Strava')).toBeNull();
    expect(screen.queryByText('👟')).toBeNull();

    fireEvent.click(screen.getByText('Change ›'));

    expect(await screen.findByText('Which shoe?')).toBeTruthy();
    expect(screen.queryByText('👟')).toBeNull();
  });

  it('saves the staged shoe and niggles from the modal pickers', async () => {
    mockActivityGet.mockResolvedValue({
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
    });
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
    fireEvent.click(await screen.findByText('Save run'));

    await waitFor(() => {
      expect(mockSaveRunDetail).toHaveBeenCalledWith(expect.objectContaining({
        shoeId: 'shoe-1',
        niggles: [
          { bodyPart: 'hamstring', side: 'left', severity: 'mild', when: 'during' },
        ],
      }));
    });
  });

  it('requires custom text for Other niggles and saves it once provided', async () => {
    mockActivityGet.mockResolvedValue({
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
    });

    render(<SyncRunDetailScreen />);

    await screen.findByText('Run detail');

    fireEvent.click(screen.getByText('Flag a niggle'));
    fireEvent.click(await screen.findByText('Other'));

    expect(screen.getByPlaceholderText('e.g. Groin or upper calf')).toBeTruthy();

    fireEvent.click(screen.getByText('Left'));
    fireEvent.click(screen.getByText('Mild'));
    fireEvent.click(screen.getByText('During'));
    fireEvent.click(screen.getByText('Add niggle'));

    expect(screen.getByPlaceholderText('e.g. Groin or upper calf')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('e.g. Groin or upper calf'), {
      target: { value: 'Upper calf' },
    });
    fireEvent.click(screen.getByText('Add niggle'));

    fireEvent.click(screen.getByText('Fresh'));
    fireEvent.click(screen.getByText('Easy'));
    fireEvent.click(screen.getByText('Could go again'));
    fireEvent.click(await screen.findByText('Save run'));

    await waitFor(() => {
      expect(mockSaveRunDetail).toHaveBeenCalledWith(expect.objectContaining({
        niggles: [
          {
            bodyPart: 'other',
            bodyPartOtherText: 'Upper calf',
            side: 'left',
            severity: 'mild',
            when: 'during',
          },
        ],
      }));
    });
  });

  it('navigates home after saving even when the follow-up plan refresh fails', async () => {
    mockActivityGet.mockResolvedValue({
      id: 'activity-1',
      source: 'strava',
      startTime: '2026-04-15T07:15:00.000Z',
      distance: 8.2,
      duration: 2650,
      avgPace: 323,
      avgHR: 148,
      splits: [],
      matchedSessionId: null,
    });
    mockRefreshPlan.mockRejectedValue(new Error('refresh failed'));

    render(<SyncRunDetailScreen />);

    await screen.findByText('Run detail');

    fireEvent.click(screen.getByText('Fresh'));
    fireEvent.click(screen.getByText('Easy'));
    fireEvent.click(screen.getByText('Could go again'));
    fireEvent.click(await screen.findByText('Save run'));

    await waitFor(() => {
      expect(mockSaveRunDetail).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/home');
    });

    expect(Alert.alert).toHaveBeenCalledWith('Run saved', 'We could not refresh the plan yet, but your run was saved.');
  });

  it('offers recovery when the requested run is missing', async () => {
    mockActivityGet.mockResolvedValue(null);

    render(<SyncRunDetailScreen />);

    expect(await screen.findByText('This run is no longer available')).toBeTruthy();

    fireEvent.click(screen.getByText('Back to picker'));

    expect(mockRouterReplace).toHaveBeenCalledWith('/sync-run');
  });
});
