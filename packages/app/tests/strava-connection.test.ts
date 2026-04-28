import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTrpc = vi.hoisted(() => ({
  strava: {
    config: { query: vi.fn() },
    connect: { mutate: vi.fn() },
  },
}));

const mockGetStravaOAuthRedirects = vi.hoisted(() => vi.fn());

vi.mock('../lib/trpc', () => ({
  trpc: mockTrpc,
}));

vi.mock('../lib/strava-auth', () => ({
  getStravaOAuthRedirects: mockGetStravaOAuthRedirects,
}));

import {
  connectStravaAndRefresh,
  getStravaAuthorizeUrl,
} from '../features/strava/strava-connection';

describe('Strava connection workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrpc.strava.config.query.mockResolvedValue({ clientId: 'strava-client-id' });
    mockTrpc.strava.connect.mutate.mockResolvedValue(null);
    mockGetStravaOAuthRedirects.mockReturnValue({
      authorizationRedirectUri: 'steady://api.steady.test/strava-callback',
      authSessionCallbackUri: 'steady://strava-callback',
    });
    vi.mocked(QueryParams.getQueryParams).mockReturnValue({
      params: { code: 'oauth-code' },
      errorCode: null,
    });
    vi.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
      type: 'success',
      url: 'steady://strava-callback?code=oauth-code',
    });
  });

  it('uses web OAuth for Expo Go callback URLs and mobile OAuth for native callback URLs', () => {
    expect(getStravaAuthorizeUrl('exp://192.168.1.103:8081/--/strava-callback')).toBe(
      'https://www.strava.com/oauth/authorize',
    );
    expect(getStravaAuthorizeUrl('steady://strava-callback')).toBe(
      'https://www.strava.com/oauth/mobile/authorize',
    );
  });

  it('connects Strava, refreshes status, syncs, and refreshes the plan', async () => {
    const refreshStatus = vi.fn().mockResolvedValue({
      connected: true,
      athleteId: '12345',
      lastSyncedAt: null,
    });
    const forceSync = vi.fn().mockResolvedValue(null);
    const refreshPlan = vi.fn().mockResolvedValue(undefined);

    const connected = await connectStravaAndRefresh({
      refreshStatus,
      forceSync,
      refreshPlan,
    });

    expect(connected).toBe(true);
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledTimes(1);
    const [authorizeUrl, callbackUrl] = vi.mocked(WebBrowser.openAuthSessionAsync).mock.calls[0];
    const parsedAuthorizeUrl = new URL(authorizeUrl as string);
    expect(callbackUrl).toBe('steady://strava-callback');
    expect(parsedAuthorizeUrl.origin).toBe('https://www.strava.com');
    expect(parsedAuthorizeUrl.pathname).toBe('/oauth/mobile/authorize');
    expect(parsedAuthorizeUrl.searchParams.get('client_id')).toBe('strava-client-id');
    expect(parsedAuthorizeUrl.searchParams.get('redirect_uri')).toBe(
      'steady://api.steady.test/strava-callback',
    );
    expect(parsedAuthorizeUrl.searchParams.get('scope')).toBe('read,activity:read_all');
    expect(mockTrpc.strava.connect.mutate).toHaveBeenCalledWith({ code: 'oauth-code' });
    expect(refreshStatus).toHaveBeenCalledTimes(1);
    expect(forceSync).toHaveBeenCalledTimes(1);
    expect(refreshPlan).toHaveBeenCalledTimes(1);
  });

  it('leaves app state untouched when the OAuth browser is dismissed', async () => {
    vi.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({ type: 'dismiss' } as any);
    const refreshStatus = vi.fn();
    const forceSync = vi.fn();
    const refreshPlan = vi.fn();

    const connected = await connectStravaAndRefresh({
      refreshStatus,
      forceSync,
      refreshPlan,
    });

    expect(connected).toBe(false);
    expect(mockTrpc.strava.connect.mutate).not.toHaveBeenCalled();
    expect(refreshStatus).not.toHaveBeenCalled();
    expect(forceSync).not.toHaveBeenCalled();
    expect(refreshPlan).not.toHaveBeenCalled();
  });
});
