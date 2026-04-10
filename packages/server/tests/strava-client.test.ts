import { describe, expect, it, vi } from 'vitest';
import { createStravaClient, StravaInvalidGrantError } from '../src/lib/strava-client';

describe('StravaClient', () => {
  it('exchanges an authorization code using the Strava token endpoint', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'access-123',
      refresh_token: 'refresh-456',
      expires_at: 1_776_000_000,
      athlete: { id: 4242 },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const client = createStravaClient({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetchImpl: fetchImpl as typeof fetch,
    });

    const response = await client.exchangeCode('oauth-code');

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.strava.com/oauth/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      }),
    );

    const body = fetchImpl.mock.calls[0]?.[1]?.body;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect((body as URLSearchParams).get('client_id')).toBe('client-id');
    expect((body as URLSearchParams).get('client_secret')).toBe('client-secret');
    expect((body as URLSearchParams).get('code')).toBe('oauth-code');
    expect((body as URLSearchParams).get('grant_type')).toBe('authorization_code');

    expect(response).toEqual({
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      expiresAt: new Date(1_776_000_000 * 1000).toISOString(),
      athleteId: '4242',
    });
  });

  it('refreshes a token using the refresh_token grant', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'access-789',
      refresh_token: 'refresh-999',
      expires_at: 1_776_003_600,
      athlete: { id: 4242 },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const client = createStravaClient({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetchImpl: fetchImpl as typeof fetch,
    });

    const response = await client.refreshToken('refresh-token-value');
    const body = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;

    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh-token-value');
    expect(response.accessToken).toBe('access-789');
  });

  it('throws a typed invalid-grant error when Strava rejects the refresh token', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      error: 'invalid_grant',
      message: 'Bad Request',
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }));

    const client = createStravaClient({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(client.refreshToken('stale-refresh-token')).rejects.toBeInstanceOf(StravaInvalidGrantError);
  });
});
