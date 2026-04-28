import type { ExpoConfig } from 'expo/config';
import { afterEach, describe, expect, it } from 'vitest';
import appConfig, {
  getAppIdentityForBuildProfile,
  validateApiUrlForBuildProfile,
} from '../app.config';

const originalEnv = {
  EAS_BUILD_PROFILE: process.env.EAS_BUILD_PROFILE,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_STRAVA_OAUTH_RELAY_URL: process.env.EXPO_PUBLIC_STRAVA_OAUTH_RELAY_URL,
};

function restoreEnvValue(name: keyof typeof originalEnv) {
  const value = originalEnv[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function baseConfig(): ExpoConfig {
  return {
    name: 'Steady',
    slug: 'steady',
    scheme: 'steady',
    ios: {
      bundleIdentifier: 'com.cyprianbrytan.steady',
    },
    android: {},
  } as ExpoConfig;
}

afterEach(() => {
  restoreEnvValue('EAS_BUILD_PROFILE');
  restoreEnvValue('EXPO_PUBLIC_API_URL');
  restoreEnvValue('EXPO_PUBLIC_STRAVA_OAUTH_RELAY_URL');
});

describe('app config API URL validation', () => {
  it('allows local API URLs for development builds', () => {
    expect(validateApiUrlForBuildProfile('http://192.168.1.103:3000', 'development')).toBe(
      'http://192.168.1.103:3000',
    );
  });

  it('requires an API URL for preview builds', () => {
    expect(() => validateApiUrlForBuildProfile(undefined, 'preview')).toThrow(
      'EXPO_PUBLIC_API_URL is required for EAS preview builds.',
    );
  });

  it('rejects local API URLs for preview builds', () => {
    expect(() => validateApiUrlForBuildProfile('http://192.168.1.103:3000', 'preview')).toThrow(
      'EXPO_PUBLIC_API_URL must use HTTPS for EAS preview builds: http://192.168.1.103:3000',
    );
  });

  it('rejects private HTTPS API URLs for production builds', () => {
    expect(() => validateApiUrlForBuildProfile('https://10.0.0.8', 'production')).toThrow(
      'EXPO_PUBLIC_API_URL must be public for EAS production builds: https://10.0.0.8',
    );
  });

  it('accepts public HTTPS API URLs for production builds', () => {
    expect(validateApiUrlForBuildProfile('https://api.steady.test', 'production')).toBe(
      'https://api.steady.test',
    );
  });

  it('keeps the current app identity for local development by default', () => {
    expect(getAppIdentityForBuildProfile(undefined)).toEqual({
      name: 'Steady',
      slug: 'steady',
      scheme: 'steady',
      iosBundleIdentifier: 'com.cyprianbrytan.steady',
      androidPackage: 'com.cyprianbrytan.steady',
      appVariant: 'development',
    });
  });

  it('uses the production app identity for production builds', () => {
    expect(getAppIdentityForBuildProfile('production')).toEqual({
      name: 'Steady',
      slug: 'steady',
      scheme: 'steady',
      iosBundleIdentifier: 'com.cyprianbrytan.steady',
      androidPackage: 'com.cyprianbrytan.steady',
      appVariant: 'production',
    });
  });

  it('uses a separate app identity for preview builds', () => {
    expect(getAppIdentityForBuildProfile('preview')).toEqual({
      name: 'Steady Preview',
      slug: 'steady-preview',
      scheme: 'steady-preview',
      iosBundleIdentifier: 'com.cyprianbrytan.steady.preview',
      androidPackage: 'com.cyprianbrytan.steady.preview',
      appVariant: 'preview',
    });
  });

  it('applies the preview app identity only for the preview EAS profile', () => {
    process.env.EAS_BUILD_PROFILE = 'preview';
    process.env.EXPO_PUBLIC_API_URL = 'https://api-preview.steady.test';

    const config = appConfig({ config: baseConfig() });

    expect(config.name).toBe('Steady Preview');
    expect(config.slug).toBe('steady-preview');
    expect(config.scheme).toBe('steady-preview');
    expect(config.ios?.bundleIdentifier).toBe('com.cyprianbrytan.steady.preview');
    expect(config.android?.package).toBe('com.cyprianbrytan.steady.preview');
    expect(config.extra).toMatchObject({
      appVariant: 'preview',
      apiUrl: 'https://api-preview.steady.test',
    });
  });

  it('keeps the current dev identity and allows LAN API URLs outside release builds', () => {
    delete process.env.EAS_BUILD_PROFILE;
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.103:3000';
    process.env.EXPO_PUBLIC_STRAVA_OAUTH_RELAY_URL = 'https://oauth-relay.steady.test';

    const config = appConfig({ config: baseConfig() });

    expect(config.name).toBe('Steady');
    expect(config.slug).toBe('steady');
    expect(config.scheme).toBe('steady');
    expect(config.ios?.bundleIdentifier).toBe('com.cyprianbrytan.steady');
    expect(config.extra).toMatchObject({
      appVariant: 'development',
      apiUrl: 'http://192.168.1.103:3000',
      stravaOAuthRelayUrl: 'https://oauth-relay.steady.test',
    });
  });
});
