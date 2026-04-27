import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.hoisted(() => ({
  session: { user: { id: 'user-1' } },
}));

const mockTrpc = vi.hoisted(() => ({
  profile: {
    me: { query: vi.fn() },
    updatePreferences: { mutate: vi.fn() },
  },
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../lib/trpc', () => ({
  trpc: mockTrpc,
}));

import { PreferencesProvider } from '../providers/PreferencesProvider';
import { usePreferences } from '../providers/preferences-context';

const WEEKLY_VOLUME_METRIC_STORAGE_KEY = 'steady.preferences.weeklyVolumeMetric';

function wrapper({ children }: React.PropsWithChildren) {
  return <PreferencesProvider>{children}</PreferencesProvider>;
}

describe('PreferencesProvider', () => {
  beforeEach(() => {
    mockAuth.session = { user: { id: 'user-1' } };
    mockTrpc.profile.me.query.mockReset();
    mockTrpc.profile.me.query.mockResolvedValue({
      units: 'metric',
      weeklyVolumeMetric: 'distance',
    });
    mockTrpc.profile.updatePreferences.mutate.mockReset();
    mockTrpc.profile.updatePreferences.mutate.mockResolvedValue({
      units: 'metric',
      weeklyVolumeMetric: 'time',
    });
  });

  it('loads cached weekly volume metric before the network profile resolves', async () => {
    mockTrpc.profile.me.query.mockReturnValue(new Promise(() => {}));
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => (
      key === WEEKLY_VOLUME_METRIC_STORAGE_KEY ? 'time' : 'metric'
    ));

    const { result } = renderHook(() => usePreferences(), { wrapper });

    await waitFor(() => {
      expect(result.current.weeklyVolumeMetric).toBe('time');
    });
  });

  it('persists weekly volume metric locally and through profile preferences', async () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.setWeeklyVolumeMetric('time');
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(WEEKLY_VOLUME_METRIC_STORAGE_KEY, 'time');
    expect(mockTrpc.profile.updatePreferences.mutate).toHaveBeenCalledWith({
      weeklyVolumeMetric: 'time',
    });
    expect(result.current.weeklyVolumeMetric).toBe('time');
  });
});
