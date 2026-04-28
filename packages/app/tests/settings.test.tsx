import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveTrainingPaceProfile } from '@steady/types';

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
  weeklyVolumeMetric: 'distance' as 'distance' | 'time',
  loading: false,
  updatingUnits: false,
  updatingWeeklyVolumeMetric: false,
  setUnits: vi.fn(),
  setWeeklyVolumeMetric: vi.fn(),
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
  openURL: vi.fn(),
}));

vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn(),
}));

vi.mock('expo-auth-session/build/QueryParams', () => ({
  getQueryParams: vi.fn(),
}));

import SettingsTab from '../app/(tabs)/settings';

const originalStravaCallbackDomain = process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN;
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

describe('SettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (originalStravaCallbackDomain === undefined) {
      delete process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN;
    } else {
      process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN = originalStravaCallbackDomain;
    }
    if (originalApiUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    }
    vi.mocked(Linking.createURL).mockImplementation(() => 'steady://strava-callback');

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
    mockPreferences.weeklyVolumeMetric = 'distance';
    mockPreferences.loading = false;
    mockPreferences.updatingUnits = false;
    mockPreferences.updatingWeeklyVolumeMetric = false;
    mockPreferences.setUnits.mockResolvedValue(undefined);
    mockPreferences.setWeeklyVolumeMetric.mockResolvedValue(undefined);
  });

  it('shows the TestFlight settings hierarchy without future or internal surfaces', () => {
    mockAuth.session = { user: { email: 'runner@example.com' } };
    mockPlan.plan = {
      id: 'plan-1',
      userId: 'user-1',
      createdAt: '2026-04-01T00:00:00.000Z',
      raceName: 'Valencia Marathon',
      raceDate: '2026-12-06',
      raceDistance: 'Marathon',
      targetTime: '3:15',
      phases: { BASE: 1, BUILD: 2, RECOVERY: 0, PEAK: 0, TAPER: 0 },
      progressionPct: 0,
      trainingPaceProfile: deriveTrainingPaceProfile({
        raceDistance: 'Marathon',
        targetTime: '3:15',
      }),
      templateWeek: [],
      weeks: [
        { weekNumber: 1, phase: 'BASE', sessions: [], plannedKm: 40 },
        { weekNumber: 2, phase: 'BUILD', sessions: [], plannedKm: 44 },
        { weekNumber: 3, phase: 'BUILD', sessions: [], plannedKm: 46 },
      ],
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
    expect(screen.getByText('Valencia Marathon')).toBeTruthy();
    expect(screen.getByText('3:15')).toBeTruthy();
    expect(screen.getByText('Training paces')).toBeTruthy();
    expect(screen.getByText('5 training ranges · MP 4:37/km')).toBeTruthy();
    expect(screen.getByTestId('settings-phase-strip')).toBeTruthy();
    expect(screen.getAllByText('Strava')).toHaveLength(1);

    expect(screen.queryByTestId('settings-summary')).toBeNull();
    expect(screen.queryByText('Overview')).toBeNull();
    expect(screen.queryByText('MVP SETUP')).toBeNull();
    expect(screen.queryByText('Recovery mode')).toBeNull();
    expect(screen.queryByText('Steady AI')).toBeNull();
    expect(screen.queryByText('Coach')).toBeNull();
    expect(screen.queryByText('Garmin')).toBeNull();
    expect(screen.queryByText('Apple Health')).toBeNull();
    expect(screen.queryByText('Subscription')).toBeNull();
    expect(screen.queryByText('Preferences')).toBeNull();
    expect(screen.queryByText('Training')).toBeNull();
    expect(screen.queryByText('Connections')).toBeNull();

    const plan = screen.getByText('Plan');
    const activitySync = screen.getByText('Activity sync');
    const units = screen.getByText('Units');
    const weeklyVolume = screen.getByText('Weekly volume');
    const account = screen.getByText('Account');

    expect(plan.compareDocumentPosition(activitySync) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(activitySync.compareDocumentPosition(units) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(units.compareDocumentPosition(weeklyVolume) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(weeklyVolume.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens the Training paces screen from the active plan card', () => {
    mockPlan.plan = {
      id: 'plan-1',
      userId: 'user-1',
      createdAt: '2026-04-01T00:00:00.000Z',
      raceName: 'Valencia Marathon',
      raceDate: '2026-12-06',
      raceDistance: 'Marathon',
      targetTime: '3:15',
      phases: { BASE: 1, BUILD: 2, RECOVERY: 0, PEAK: 0, TAPER: 0 },
      progressionPct: 0,
      trainingPaceProfile: deriveTrainingPaceProfile({
        raceDistance: 'Marathon',
        targetTime: '3:15',
      }),
      templateWeek: [],
      weeks: [
        { weekNumber: 1, phase: 'BASE', sessions: [], plannedKm: 40 },
      ],
      activeInjury: null,
    };

    render(<SettingsTab />);

    fireEvent.click(screen.getByTestId('settings-training-paces'));

    expect(router.push).toHaveBeenCalledWith('/settings/training-paces');
  });

  it('updates units from the segmented unit control without requiring sign in', async () => {
    render(<SettingsTab />);

    fireEvent.click(screen.getByText('Miles'));

    await waitFor(() => {
      expect(mockPreferences.setUnits).toHaveBeenCalledWith('imperial');
    });
  });

  it('updates the weekly volume metric from the segmented control without requiring sign in', async () => {
    render(<SettingsTab />);

    fireEvent.click(screen.getByText('Time on feet'));

    await waitFor(() => {
      expect(mockPreferences.setWeeklyVolumeMetric).toHaveBeenCalledWith('time');
    });
  });

  it('starts Strava OAuth with the callback-domain redirect URI', async () => {
    process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN = 'api.steady.test';
    mockAuth.session = { user: { email: 'runner@example.com' } };
    mockTrpc.strava.config.query.mockResolvedValue({ clientId: 'strava-client-id' });
    vi.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
      type: 'success',
      url: 'steady://api.steady.test/strava-callback?code=oauth-code',
    } as Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>);
    vi.mocked(QueryParams.getQueryParams).mockReturnValue({
      params: { code: 'oauth-code' },
      errorCode: null,
    });
    mockTrpc.strava.connect.mutate.mockResolvedValue(null);
    mockStrava.refreshStatus.mockResolvedValue({ connected: true, athleteId: '12345', lastSyncedAt: null });
    mockStrava.forceSync.mockResolvedValue(null);
    mockPlan.refresh.mockResolvedValue(undefined);

    render(<SettingsTab />);

    fireEvent.click(screen.getByText('Connect Strava'));

    await waitFor(() => {
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledTimes(1);
    });

    const [authorizeUrl, callbackUrl] = vi.mocked(WebBrowser.openAuthSessionAsync).mock.calls[0];
    const parsedAuthorizeUrl = new URL(authorizeUrl);

    expect(callbackUrl).toBe('steady://api.steady.test/strava-callback');
    expect(parsedAuthorizeUrl.origin).toBe('https://www.strava.com');
    expect(parsedAuthorizeUrl.pathname).toBe('/oauth/mobile/authorize');
    expect(parsedAuthorizeUrl.searchParams.get('redirect_uri')).toBe(callbackUrl);
    expect(parsedAuthorizeUrl.searchParams.get('scope')).toBe('read,activity:read_all');
    expect(mockTrpc.strava.connect.mutate).toHaveBeenCalledWith({ code: 'oauth-code' });
  });

  it('uses web Strava OAuth in Expo Go so the installed Strava app does not hijack the auth session', async () => {
    delete process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.steady.test';
    vi.mocked(Linking.createURL).mockImplementation((path = '') => (
      path ? `exp://192.168.1.103:8081/--/${path}` : 'exp://192.168.1.103:8081/--/'
    ));
    mockAuth.session = { user: { email: 'runner@example.com' } };
    mockTrpc.strava.config.query.mockResolvedValue({ clientId: 'strava-client-id' });
    vi.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
      type: 'success',
      url: 'exp://192.168.1.103:8081/--/strava-callback?code=oauth-code',
    } as Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>);
    vi.mocked(QueryParams.getQueryParams).mockReturnValue({
      params: { code: 'oauth-code' },
      errorCode: null,
    });
    mockTrpc.strava.connect.mutate.mockResolvedValue(null);
    mockStrava.refreshStatus.mockResolvedValue({ connected: true, athleteId: '12345', lastSyncedAt: null });
    mockStrava.forceSync.mockResolvedValue(null);
    mockPlan.refresh.mockResolvedValue(undefined);

    render(<SettingsTab />);

    fireEvent.click(screen.getByText('Connect Strava'));

    await waitFor(() => {
      expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledTimes(1);
    });

    const [authorizeUrl, callbackUrl] = vi.mocked(WebBrowser.openAuthSessionAsync).mock.calls[0];
    const parsedAuthorizeUrl = new URL(authorizeUrl);

    expect(callbackUrl).toBe('exp://192.168.1.103:8081/--/strava-callback');
    expect(parsedAuthorizeUrl.origin).toBe('https://www.strava.com');
    expect(parsedAuthorizeUrl.pathname).toBe('/oauth/authorize');
    expect(parsedAuthorizeUrl.searchParams.get('redirect_uri')).toBe(
      'https://api.steady.test/oauth/strava/callback?return_to=exp%3A%2F%2F192.168.1.103%3A8081%2F--%2Fstrava-callback',
    );
    expect(parsedAuthorizeUrl.searchParams.get('scope')).toBe('read,activity:read_all');
    expect(mockTrpc.strava.connect.mutate).toHaveBeenCalledWith({ code: 'oauth-code' });
  });

  it('requires confirmation before signing out', async () => {
    const alertSpy = vi.spyOn(Alert, 'alert');
    mockAuth.session = { user: { email: 'runner@example.com' } };

    render(<SettingsTab />);

    fireEvent.click(screen.getByTestId('settings-sign-out'));

    expect(mockAuth.signOut).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Sign out?',
      expect.any(String),
      expect.any(Array),
    );

    const buttons = alertSpy.mock.calls[0][2] as Array<{ onPress?: () => void }>;
    await act(async () => {
      buttons[1].onPress?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('syncs a connected Strava account from the row action', async () => {
    mockAuth.session = { user: { email: 'runner@example.com' } };
    mockStrava.status = {
      connected: true,
      athleteId: '12345',
      lastSyncedAt: '2026-04-15T08:30:00.000Z',
    };
    mockStrava.forceSync.mockResolvedValue(null);
    mockStrava.refreshStatus.mockResolvedValue(mockStrava.status);
    mockPlan.refresh.mockResolvedValue(undefined);

    render(<SettingsTab />);

    fireEvent.click(screen.getByText('Sync now'));

    await waitFor(() => {
      expect(mockStrava.forceSync).toHaveBeenCalledTimes(1);
    });
    expect(mockStrava.refreshStatus).toHaveBeenCalledTimes(1);
    expect(mockPlan.refresh).toHaveBeenCalledTimes(1);
  });

  it('requires confirmation before disconnecting Strava', async () => {
    const alertSpy = vi.spyOn(Alert, 'alert');
    mockAuth.session = { user: { email: 'runner@example.com' } };
    mockStrava.status = {
      connected: true,
      athleteId: '12345',
      lastSyncedAt: '2026-04-15T08:30:00.000Z',
    };
    mockTrpc.strava.disconnect.mutate.mockResolvedValue(null);
    mockStrava.refreshStatus.mockResolvedValue({ connected: false, athleteId: null, lastSyncedAt: null });
    mockPlan.refresh.mockResolvedValue(undefined);

    render(<SettingsTab />);

    fireEvent.click(screen.getByText('Disconnect Strava'));

    expect(mockTrpc.strava.disconnect.mutate).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Disconnect Strava?',
      expect.any(String),
      expect.any(Array),
    );

    const buttons = alertSpy.mock.calls[0][2] as Array<{ onPress?: () => void }>;
    await act(async () => {
      buttons[1].onPress?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockTrpc.strava.disconnect.mutate).toHaveBeenCalledTimes(1);
    });
    expect(mockStrava.refreshStatus).toHaveBeenCalledTimes(1);
    expect(mockPlan.refresh).toHaveBeenCalledTimes(1);
  });
});
