import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { router } from 'expo-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPlan = {
  plan: null as any,
  loading: false,
  refresh: vi.fn(),
};

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => mockPlan,
}));

const mockStrava = {
  status: null as any,
  refreshStatus: vi.fn(),
  forceSync: vi.fn(),
  syncing: false,
};

vi.mock('../hooks/useStravaSync', () => ({
  useStravaSync: () => mockStrava,
}));

const mockConnectStravaAndRefresh = vi.hoisted(() => vi.fn());

vi.mock('../features/strava/strava-connection', () => ({
  connectStravaAndRefresh: mockConnectStravaAndRefresh,
}));

import PlanLiveScreen from '../app/onboarding/plan-live';

describe('PlanLiveScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlan.loading = false;
    mockPlan.refresh = vi.fn();
    mockPlan.plan = {
      id: 'plan-1',
      raceName: 'Manchester Marathon',
      raceDate: '2026-10-11',
      raceDistance: 'Marathon',
      targetTime: '3:30',
      phases: { BASE: 1, BUILD: 2, RECOVERY: 0, PEAK: 1, TAPER: 1 },
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 48,
          sessions: [
            { id: 'mon', type: 'EASY', distance: 8, pace: '5:30' },
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        },
      ],
    };
    mockStrava.status = { connected: false, athleteId: null, lastSyncedAt: null };
    mockStrava.refreshStatus = vi.fn().mockResolvedValue(mockStrava.status);
    mockStrava.forceSync = vi.fn().mockResolvedValue(null);
    mockStrava.syncing = false;
    mockConnectStravaAndRefresh.mockResolvedValue(true);
  });

  it('makes Connect Strava primary and keeps Go to Home secondary after plan save', () => {
    render(<PlanLiveScreen />);

    expect(screen.getByText('Plan is live.')).toBeTruthy();
    expect(screen.getByText('Manchester Marathon')).toBeTruthy();
    expect(screen.getByText('3:30')).toBeTruthy();
    expect(screen.getByText('48km')).toBeTruthy();
    expect(screen.getByText('8km easy at 5:30/km')).toBeTruthy();

    fireEvent.click(screen.getByTestId('plan-live-home'));

    expect(router.replace).toHaveBeenCalledWith('/(tabs)/home');
  });

  it('connects Strava through the shared workflow before entering Home', async () => {
    render(<PlanLiveScreen />);

    fireEvent.click(screen.getByTestId('plan-live-connect-strava'));

    await waitFor(() => {
      expect(mockConnectStravaAndRefresh).toHaveBeenCalledWith({
        refreshStatus: mockStrava.refreshStatus,
        forceSync: mockStrava.forceSync,
        refreshPlan: mockPlan.refresh,
      });
      expect(router.replace).toHaveBeenCalledWith('/(tabs)/home');
    });
  });
});
