import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import {
  buildStravaOAuthRedirectTarget,
  registerStravaOAuthRedirectRoute,
} from '../src/routes/strava-oauth-redirect';

describe('Strava OAuth redirect relay', () => {
  it('forwards Strava response params to an Expo Go return URL', () => {
    const target = buildStravaOAuthRedirectTarget({
      return_to: 'exp://192.168.1.44:8081/--/strava-callback',
      code: 'oauth-code',
      scope: 'read,activity:read_all',
      state: 'settings',
    });

    expect(target).toBe(
      'exp://192.168.1.44:8081/--/strava-callback?code=oauth-code&scope=read%2Cactivity%3Aread_all&state=settings',
    );
  });

  it('allows native Steady schemes', () => {
    expect(buildStravaOAuthRedirectTarget({
      return_to: 'steady://localhost/strava-callback',
      code: 'oauth-code',
    })).toBe('steady://localhost/strava-callback?code=oauth-code');
  });

  it('rejects web redirects so the endpoint cannot be abused as a generic open redirect', () => {
    expect(() => buildStravaOAuthRedirectTarget({
      return_to: 'https://example.com/steal',
      code: 'oauth-code',
    })).toThrow('Unsupported Strava OAuth return target.');
  });

  it('registers a Fastify route that redirects to the app callback', async () => {
    const server = Fastify();
    registerStravaOAuthRedirectRoute(server);

    const response = await server.inject({
      method: 'GET',
      url: '/oauth/strava/callback?return_to=exp%3A%2F%2F192.168.1.44%3A8081%2F--%2Fstrava-callback&code=oauth-code',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      'exp://192.168.1.44:8081/--/strava-callback?code=oauth-code',
    );
  });
});
