import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { router } from 'expo-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = {
  session: { user: { id: 'runner-1' } },
  isLoading: false,
};

const mockRefreshPlan = vi.hoisted(() => vi.fn());
const mockForceSync = vi.hoisted(() => vi.fn());
const mockListActivities = vi.hoisted(() => vi.fn());

vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => ({
    currentWeek: {
      weekNumber: 1,
      phase: 'BASE',
      plannedKm: 0,
      sessions: [null, null, null, null, null, null, null],
    },
    refresh: mockRefreshPlan,
  }),
}));

vi.mock('../hooks/useStravaSync', () => ({
  useStravaSync: () => ({
    forceSync: mockForceSync,
    syncing: false,
  }),
}));

vi.mock('../lib/activity-api', () => ({
  listActivities: mockListActivities,
}));

import SyncRunPickerScreen from '../app/sync-run/index';

describe('SyncRunPickerScreen', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockRefreshPlan.mockReset();
    mockRefreshPlan.mockResolvedValue(undefined);
    mockForceSync.mockReset();
    mockForceSync.mockResolvedValue(null);
    mockListActivities.mockReset();
    vi.mocked(router.back).mockReset();
  });

  it('shows a Back CTA when no Strava runs are available to review', async () => {
    mockListActivities.mockResolvedValue([]);

    render(<SyncRunPickerScreen />);

    expect(await screen.findByText('Back')).toBeTruthy();

    expect(screen.queryByText('None of these')).toBeNull();
    expect(mockForceSync).toHaveBeenCalledTimes(1);
    expect(mockRefreshPlan).toHaveBeenCalledTimes(1);
  });

  it('keeps the None of these CTA when candidate runs exist', async () => {
    const now = new Date();
    const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
    const today = new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);

    mockListActivities.mockResolvedValue([
      {
        id: 'activity-1',
        userId: 'runner-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: `${today}T07:15:00.000Z`,
        distance: 8.2,
        duration: 2650,
        avgPace: 323,
        avgHR: 148,
        splits: [],
        matchedSessionId: null,
      },
    ]);

    render(<SyncRunPickerScreen />);

    expect(await screen.findByText('None of these')).toBeTruthy();

    expect(screen.queryByText('Back')).toBeNull();
  });

  it('uses the empty-state Back CTA to leave the picker', async () => {
    mockListActivities.mockResolvedValue([]);

    render(<SyncRunPickerScreen />);

    const backButton = await screen.findByText('Back');
    fireEvent.click(backButton);

    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
