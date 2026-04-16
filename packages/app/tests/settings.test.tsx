import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { router } from 'expo-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = {
  session: null as any,
  isLoading: false,
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
};

vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}));

const mockPlan = {
  plan: null as any,
  loading: false,
  currentWeekIndex: 0,
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

const mockPreferences = {
  units: 'metric' as 'metric' | 'imperial',
  loading: false,
  updatingUnits: false,
  setUnits: vi.fn(),
};

vi.mock('../providers/preferences-context', () => ({
  usePreferences: () => mockPreferences,
}));

const mockTrpc = vi.hoisted(() => ({
  strava: {
    config: { query: vi.fn() },
    connect: { mutate: vi.fn() },
    disconnect: { mutate: vi.fn() },
  },
  plan: {
    markInjury: { mutate: vi.fn() },
    clearInjury: { mutate: vi.fn() },
  },
}));

vi.mock('../lib/trpc', () => ({
  trpc: mockTrpc,
}));

vi.mock('../lib/resume-week', () => ({
  clearResumeWeekOverride: vi.fn(),
  setResumeWeekOverride: vi.fn(),
}));

vi.mock('../components/recovery/RecoveryFlowModal', () => ({
  RecoveryFlowModal: () => null,
}));

vi.mock('expo-linking', () => ({
  createURL: vi.fn(() => 'steady://strava-callback'),
}));

vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn(),
}));

vi.mock('expo-auth-session/build/QueryParams', () => ({
  getQueryParams: vi.fn(),
}));

import SettingsTab from '../app/(tabs)/settings';

describe('SettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.session = null;
    mockAuth.isLoading = false;
    mockAuth.signInWithGoogle.mockResolvedValue(null);
    mockAuth.signOut.mockResolvedValue(undefined);

    mockPlan.plan = null;
    mockPlan.loading = false;
    mockPlan.currentWeekIndex = 0;
    mockPlan.refresh = vi.fn();

    mockStrava.status = null;
    mockStrava.refreshStatus = vi.fn();
    mockStrava.forceSync = vi.fn();
    mockStrava.syncing = false;

    mockPreferences.units = 'metric';
    mockPreferences.loading = false;
    mockPreferences.updatingUnits = false;
    mockPreferences.setUnits.mockResolvedValue(undefined);
  });

  it('keeps the overview canonical and the sections in the new order', () => {
    mockAuth.session = { user: { email: 'runner@example.com' } };
    mockPlan.plan = {
      id: 'plan-1',
      raceName: 'Valencia Marathon',
      targetTime: '3:15',
      weeks: [{ weekNumber: 1 }, { weekNumber: 2 }, { weekNumber: 3 }],
      activeInjury: null,
    };
    mockPlan.currentWeekIndex = 1;
    mockStrava.status = {
      connected: true,
      athleteId: '12345',
      lastSyncedAt: '2026-04-15T08:30:00.000Z',
    };

    render(<SettingsTab />);

    expect(screen.getAllByText('runner@example.com')).toHaveLength(1);
    expect(screen.getByText('Valencia Marathon · 3:15')).toBeTruthy();
    expect(screen.getByText('Week 2 of 3.')).toBeTruthy();
    expect(screen.getAllByText('Strava')).toHaveLength(1);
    expect(screen.queryByText('Recovery mode')).toBeNull();

    const preferences = screen.getByText('Preferences');
    const training = screen.getByText('Training');
    const connections = screen.getByText('Connections');
    const account = screen.getAllByText('Account').at(-1);

    expect(account).toBeTruthy();
    expect(preferences.compareDocumentPosition(training) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(training.compareDocumentPosition(connections) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(connections.compareDocumentPosition(account!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('updates units from the compact preference rows', async () => {
    mockAuth.session = { user: { email: 'runner@example.com' } };

    render(<SettingsTab />);

    fireEvent.click(screen.getByText('Miles'));

    await waitFor(() => {
      expect(mockPreferences.setUnits).toHaveBeenCalledWith('imperial');
    });
  });

  it('keeps sign out as a separate low-emphasis account action', async () => {
    mockAuth.session = { user: { email: 'runner@example.com' } };

    render(<SettingsTab />);

    fireEvent.click(screen.getByTestId('settings-sign-out'));

    await waitFor(() => {
      expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
    });
    expect(router.push).not.toHaveBeenCalled();
  });
});
