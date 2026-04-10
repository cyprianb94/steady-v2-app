export interface StravaTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  athleteId: string;
}

export class StravaInvalidGrantError extends Error {
  constructor(message = 'Strava refresh token is invalid') {
    super(message);
    this.name = 'StravaInvalidGrantError';
  }
}

export interface StravaClient {
  exchangeCode(code: string): Promise<StravaTokenResponse>;
  refreshToken(refreshToken: string): Promise<StravaTokenResponse>;
}

interface CreateStravaClientOptions {
  clientId?: string;
  clientSecret?: string;
  fetchImpl?: typeof fetch;
}

function requireEnv(name: 'STRAVA_CLIENT_ID' | 'STRAVA_CLIENT_SECRET'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Strava OAuth`);
  }
  return value;
}

async function parseTokenResponse(response: Response): Promise<StravaTokenResponse> {
  const payload = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    if (payload.error === 'invalid_grant') {
      throw new StravaInvalidGrantError();
    }

    const message = typeof payload.message === 'string'
      ? payload.message
      : `Strava token exchange failed with status ${response.status}`;
    throw new Error(message);
  }

  const athlete = payload.athlete as Record<string, unknown> | undefined;
  const athleteId = athlete?.id;
  const expiresAt = payload.expires_at;

  if (
    typeof payload.access_token !== 'string'
    || typeof payload.refresh_token !== 'string'
    || typeof expiresAt !== 'number'
    || (typeof athleteId !== 'number' && typeof athleteId !== 'string')
  ) {
    throw new Error('Strava token exchange returned an unexpected payload');
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    athleteId: String(athleteId),
  };
}

export function createStravaClient(options: CreateStravaClientOptions = {}): StravaClient {
  const clientId = options.clientId ?? requireEnv('STRAVA_CLIENT_ID');
  const clientSecret = options.clientSecret ?? requireEnv('STRAVA_CLIENT_SECRET');
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async exchangeCode(code: string): Promise<StravaTokenResponse> {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      });

      const response = await fetchImpl('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      return parseTokenResponse(response);
    },

    async refreshToken(refreshToken: string): Promise<StravaTokenResponse> {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await fetchImpl('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      return parseTokenResponse(response);
    },
  };
}
