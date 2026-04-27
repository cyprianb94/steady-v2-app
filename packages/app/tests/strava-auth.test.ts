import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateURL = vi.hoisted(() => vi.fn());

vi.mock('expo-linking', () => ({
  createURL: mockCreateURL,
}));

import { getStravaRedirectUri } from '../lib/strava-auth';

const originalCallbackDomain = process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN;
const originalNodeEnv = process.env.NODE_ENV;

describe('getStravaRedirectUri', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    if (originalCallbackDomain === undefined) {
      delete process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN;
    } else {
      process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN = originalCallbackDomain;
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

  it('fails clearly in Expo Go because the localhost redirect cannot return to the project', () => {
    delete process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN;
    process.env.NODE_ENV = 'development';
    mockCreateURL.mockImplementation((path: string) => (
      path ? `exp://10.0.0.1:8081/--/${path}` : 'exp://10.0.0.1:8081/--/'
    ));

    expect(() => getStravaRedirectUri()).toThrow(
      'Strava OAuth cannot complete in Expo Go. Use a development build and set the Strava Authorization Callback Domain to localhost.',
    );
  });

  it('fails clearly for release builds that cannot provide a native app scheme', () => {
    process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN = 'api.steady.test';
    process.env.NODE_ENV = 'production';
    mockCreateURL.mockImplementation((path: string) => (
      path ? `exp://10.0.0.1:8081/--/${path}` : 'exp://10.0.0.1:8081/--/'
    ));

    expect(() => getStravaRedirectUri()).toThrow(
      'Strava OAuth cannot complete in Expo Go.',
    );
  });
});
