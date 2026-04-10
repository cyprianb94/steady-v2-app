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
    expect(response.athleteId).toBeUndefined();
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

  it('fetches run activities after a given timestamp and hydrates detail records', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 101, sport_type: 'Run' },
        { id: 102, sport_type: 'Ride' },
      ]), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 101,
        sport_type: 'Run',
        start_date: '2026-04-10T07:00:00Z',
        distance: 10000,
        moving_time: 3000,
        elapsed_time: 3050,
        total_elevation_gain: 42,
        average_heartrate: 151,
        max_heartrate: 172,
        average_speed: 3.33,
        splits_metric: [
          {
            split: 1,
            distance: 1000,
            elapsed_time: 300,
            average_speed: 3.33,
            average_heartrate: 150,
            elevation_difference: 4,
          },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));

    const client = createStravaClient({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetchImpl: fetchImpl as typeof fetch,
    });

    const activities = await client.getActivities('access-token', '2026-04-09T00:00:00Z');

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[0]).toContain('/athlete/activities?');
    expect(fetchImpl.mock.calls[1]?.[0]).toBe('https://www.strava.com/api/v3/activities/101');
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      id: 101,
      sport_type: 'Run',
      distance: 10000,
    });
  });
});
