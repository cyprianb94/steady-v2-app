import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateURL = vi.hoisted(() => vi.fn());

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: { extra: {} },
    manifest: { extra: {} },
    manifest2: { extra: {} },
  },
}));

vi.mock('expo-linking', () => ({
  createURL: mockCreateURL,
}));

import { getStravaOAuthRedirects, getStravaRedirectUri } from '../lib/strava-auth';

const originalCallbackDomain = process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN;
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalStravaOAuthRelayUrl = process.env.EXPO_PUBLIC_STRAVA_OAUTH_RELAY_URL;
const originalNodeEnv = process.env.NODE_ENV;

describe('getStravaRedirectUri', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    if (originalCallbackDomain === undefined) {
      delete process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN;
    } else {
      process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN = originalCallbackDomain;
    }

    if (originalApiUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    }

    if (originalStravaOAuthRelayUrl === undefined) {
      delete process.env.EXPO_PUBLIC_STRAVA_OAUTH_RELAY_URL;
    } else {
      process.env.EXPO_PUBLIC_STRAVA_OAUTH_RELAY_URL = originalStravaOAuthRelayUrl;
    }

    if (originalNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, 'NODE_ENV');
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('uses the production app scheme with the Strava callback domain', () => {
    process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN = 'api.steady.test';
    mockCreateURL.mockImplementation((path: string) => (path ? `steady://${path}` : 'steady://'));

    expect(getStravaRedirectUri()).toBe('steady://api.steady.test/strava-callback');
  });

  it('uses the preview app scheme with the same callback domain', () => {
    process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN = 'api.steady.test';
    mockCreateURL.mockImplementation((path: string) => (
      path ? `steady-preview://${path}` : 'steady-preview://'
    ));

    expect(getStravaRedirectUri()).toBe('steady-preview://api.steady.test/strava-callback');
  });

  it('allows the callback domain to be configured for another Strava app', () => {
    process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN = 'https://connect.steady.test/';
    mockCreateURL.mockImplementation((path: string) => (path ? `steady://${path}` : 'steady://'));

    expect(getStravaRedirectUri()).toBe('steady://connect.steady.test/strava-callback');
  });

  it('uses Strava localhost callback domain for local native development', () => {
    delete process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN;
    process.env.NODE_ENV = 'development';
    mockCreateURL.mockImplementation((path: string) => (path ? `steady://${path}` : 'steady://'));

    expect(getStravaRedirectUri()).toBe('steady://localhost/strava-callback');
  });

  it('fails clearly for production native builds without a configured callback domain', () => {
    delete process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN;
    process.env.NODE_ENV = 'production';
    mockCreateURL.mockImplementation((path: string) => (path ? `steady://${path}` : 'steady://'));

    expect(() => getStravaRedirectUri()).toThrow(
      'EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN is not configured for Strava OAuth.',
    );
  });

  it('uses the Strava OAuth relay so Expo Go can keep its real return URL while API calls stay on LAN', () => {
    delete process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN;
    process.env.EXPO_PUBLIC_API_URL = 'http://10.0.0.1:3000';
    process.env.EXPO_PUBLIC_STRAVA_OAUTH_RELAY_URL = 'https://oauth-relay.steady.test';
    process.env.NODE_ENV = 'development';
    mockCreateURL.mockImplementation((path: string) => (
      path ? `exp://10.0.0.1:8081/--/${path}` : 'exp://10.0.0.1:8081/--/'
    ));

    expect(getStravaOAuthRedirects()).toEqual({
      authorizationRedirectUri: 'https://oauth-relay.steady.test/oauth/strava/callback?return_to=exp%3A%2F%2F10.0.0.1%3A8081%2F--%2Fstrava-callback',
      authSessionCallbackUri: 'exp://10.0.0.1:8081/--/strava-callback',
    });
  });

  it('falls back to a public HTTPS API URL for legacy Expo Go relay config', () => {
    delete process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN;
    process.env.EXPO_PUBLIC_API_URL = 'https://api.steady.test';
    process.env.NODE_ENV = 'development';
    mockCreateURL.mockImplementation((path: string) => (
      path ? `exp://10.0.0.1:8081/--/${path}` : 'exp://10.0.0.1:8081/--/'
    ));

    expect(getStravaOAuthRedirects()).toEqual({
      authorizationRedirectUri: 'https://api.steady.test/oauth/strava/callback?return_to=exp%3A%2F%2F10.0.0.1%3A8081%2F--%2Fstrava-callback',
      authSessionCallbackUri: 'exp://10.0.0.1:8081/--/strava-callback',
    });
  });

  it('requires a public HTTPS OAuth relay for Expo Go relay redirects', () => {
    delete process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN;
    process.env.EXPO_PUBLIC_API_URL = 'http://10.0.0.1:3000';
    process.env.NODE_ENV = 'development';
    mockCreateURL.mockImplementation((path: string) => (
      path ? `exp://10.0.0.1:8081/--/${path}` : 'exp://10.0.0.1:8081/--/'
    ));

    expect(() => getStravaRedirectUri()).toThrow(
      'Expo Go Strava OAuth needs EXPO_PUBLIC_STRAVA_OAUTH_RELAY_URL set to a public HTTPS API relay URL.',
    );
  });
});
