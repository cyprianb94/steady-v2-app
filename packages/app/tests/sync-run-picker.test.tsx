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
const mockActivityList = vi.hoisted(() => vi.fn());

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

vi.mock('../lib/trpc', () => ({
  trpc: {
    activity: {
      list: {
        query: mockActivityList,
      },
    },
  },
}));

import SyncRunPickerScreen from '../app/sync-run/index';

function isoDateLocal(value: Date): string {
  const timezoneOffsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

function addDaysIso(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

describe('SyncRunPickerScreen', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockRefreshPlan.mockReset();
    mockRefreshPlan.mockResolvedValue(undefined);
    mockForceSync.mockReset();
    mockForceSync.mockResolvedValue(null);
    mockActivityList.mockReset();
    vi.mocked(router.back).mockReset();
  });

  it('shows a Back CTA when no Strava runs are available to review', async () => {
    mockActivityList.mockResolvedValue([]);

    render(<SyncRunPickerScreen />);

    expect(await screen.findByText('Back')).toBeTruthy();

    expect(screen.queryByText('None of these')).toBeNull();
    expect(mockForceSync).toHaveBeenCalledTimes(1);
    expect(mockRefreshPlan).toHaveBeenCalledTimes(1);
  });

  it('keeps the None of these CTA when candidate runs exist', async () => {
    const now = new Date();
    const today = isoDateLocal(now);

    mockActivityList.mockResolvedValue([
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

  it('keeps an auto-matched same-day run visible when older unmatched runs exist', async () => {
    const today = isoDateLocal(new Date());
    const yesterday = addDaysIso(today, -1);

    mockActivityList.mockResolvedValue([
      {
        id: 'older-unmatched',
        userId: 'runner-1',
        source: 'strava',
        externalId: 'strava-old',
        name: 'Evening Run',
        startTime: `${yesterday}T19:25:00.000Z`,
        distance: 8,
        duration: 2700,
        avgPace: 338,
        avgHR: 146,
        splits: [],
        matchedSessionId: null,
      },
      {
        id: 'today-matched',
        userId: 'runner-1',
        source: 'strava',
        externalId: 'strava-today',
        name: 'Run club',
        startTime: `${today}T09:12:00.000Z`,
        distance: 10.11,
        duration: 3422,
        avgPace: 338,
        avgHR: 159,
        splits: [],
        matchedSessionId: 'today-session',
      },
    ]);

    render(<SyncRunPickerScreen />);

    expect(await screen.findByText('Run club')).toBeTruthy();
    expect(screen.getByText('Evening Run')).toBeTruthy();
    expect(screen.getByText('None of these')).toBeTruthy();
  });

  it('uses the empty-state Back CTA to leave the picker', async () => {
    mockActivityList.mockResolvedValue([]);

    render(<SyncRunPickerScreen />);

    const backButton = await screen.findByText('Back');
    fireEvent.click(backButton);

    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
