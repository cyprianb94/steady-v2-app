import { describe, expect, it } from 'vitest';
import { validateApiUrlForBuildProfile } from '../app.config';

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
});
