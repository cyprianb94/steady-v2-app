export interface StravaTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  athleteId?: string;
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
  getActivities(accessToken: string, after: string): Promise<StravaActivity[]>;
  getActivity(accessToken: string, activityId: number): Promise<StravaActivity>;
  getGear(accessToken: string, gearId: string): Promise<StravaGear | null>;
}

export interface StravaActivitySplit {
  split: number;
  distance: number;
  elapsed_time: number;
  average_speed?: number;
  average_heartrate?: number;
  elevation_difference?: number;
}

export interface StravaActivityLap {
  lap_index: number;
  distance: number;
  elapsed_time: number;
  moving_time?: number;
  average_speed?: number;
  average_heartrate?: number;
  total_elevation_gain?: number;
  name?: string;
}

export interface StravaActivity {
  id: number;
  name?: string;
  type?: string;
  sport_type?: string;
  gear_id?: string;
  start_date: string;
  distance: number;
  moving_time?: number;
  elapsed_time: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  splits_metric?: StravaActivitySplit[];
  laps?: StravaActivityLap[];
}

export interface StravaGear {
  id: string;
  brand: string;
  model: string;
  name?: string;
  retired: boolean;
}

interface CreateStravaClientOptions {
  clientId?: string;
  clientSecret?: string;
  fetchImpl?: typeof fetch;
}

function mapLap(lap: Record<string, unknown>): StravaActivityLap {
  return {
    lap_index: typeof lap.lap_index === 'number' ? lap.lap_index : 0,
    distance: typeof lap.distance === 'number' ? lap.distance : 0,
    elapsed_time: typeof lap.elapsed_time === 'number' ? lap.elapsed_time : 0,
    moving_time: typeof lap.moving_time === 'number' ? lap.moving_time : undefined,
    average_speed: typeof lap.average_speed === 'number' ? lap.average_speed : undefined,
    average_heartrate:
      typeof lap.average_heartrate === 'number' ? lap.average_heartrate : undefined,
    total_elevation_gain:
      typeof lap.total_elevation_gain === 'number' ? lap.total_elevation_gain : undefined,
    name: typeof lap.name === 'string' ? lap.name : undefined,
  };
}

function mapDetailedActivity(detail: Record<string, unknown>, lapsOverride?: StravaActivityLap[]): StravaActivity {
  if (typeof detail.id !== 'number' || typeof detail.start_date !== 'string') {
    throw new Error('Strava activity detail returned an unexpected payload');
  }

  return {
    id: detail.id,
    name: typeof detail.name === 'string' ? detail.name : undefined,
    type: typeof detail.type === 'string' ? detail.type : undefined,
    sport_type: typeof detail.sport_type === 'string' ? detail.sport_type : undefined,
    gear_id: typeof detail.gear_id === 'string' ? detail.gear_id : undefined,
    start_date: detail.start_date,
    distance: typeof detail.distance === 'number' ? detail.distance : 0,
    moving_time: typeof detail.moving_time === 'number' ? detail.moving_time : undefined,
    elapsed_time: typeof detail.elapsed_time === 'number' ? detail.elapsed_time : 0,
    total_elevation_gain:
      typeof detail.total_elevation_gain === 'number' ? detail.total_elevation_gain : undefined,
    average_heartrate:
      typeof detail.average_heartrate === 'number' ? detail.average_heartrate : undefined,
    max_heartrate: typeof detail.max_heartrate === 'number' ? detail.max_heartrate : undefined,
    average_speed: typeof detail.average_speed === 'number' ? detail.average_speed : undefined,
    splits_metric: Array.isArray(detail.splits_metric)
      ? detail.splits_metric
        .filter((split): split is Record<string, unknown> => Boolean(split) && typeof split === 'object')
        .map((split) => ({
          split: typeof split.split === 'number' ? split.split : 0,
          distance: typeof split.distance === 'number' ? split.distance : 0,
          elapsed_time: typeof split.elapsed_time === 'number' ? split.elapsed_time : 0,
          average_speed: typeof split.average_speed === 'number' ? split.average_speed : undefined,
          average_heartrate:
            typeof split.average_heartrate === 'number' ? split.average_heartrate : undefined,
          elevation_difference:
            typeof split.elevation_difference === 'number' ? split.elevation_difference : undefined,
        }))
      : [],
    laps: lapsOverride ?? (
      Array.isArray(detail.laps)
        ? detail.laps
          .filter((lap): lap is Record<string, unknown> => Boolean(lap) && typeof lap === 'object')
          .map(mapLap)
        : []
    ),
  };
}

function requireEnv(name: 'STRAVA_CLIENT_ID' | 'STRAVA_CLIENT_SECRET'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Strava OAuth`);
  }
  return value;
}

async function parseTokenResponse(
  response: Response,
  options: { requireAthlete: boolean },
): Promise<StravaTokenResponse> {
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
    || (options.requireAthlete && typeof athleteId !== 'number' && typeof athleteId !== 'string')
  ) {
    throw new Error('Strava token exchange returned an unexpected payload');
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    athleteId: athleteId == null ? undefined : String(athleteId),
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

      return parseTokenResponse(response, { requireAthlete: true });
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

      return parseTokenResponse(response, { requireAthlete: false });
    },

    async getActivities(accessToken: string, after: string): Promise<StravaActivity[]> {
      const afterEpoch = Math.floor(new Date(after).getTime() / 1000);
      const summaries: Array<Pick<StravaActivity, 'id' | 'type' | 'sport_type'>> = [];

      for (let page = 1; ; page += 1) {
        const query = new URLSearchParams({
          after: String(afterEpoch),
          page: String(page),
          per_page: '200',
        });
        const summaryResponse = await fetchImpl(
          `https://www.strava.com/api/v3/athlete/activities?${query.toString()}`,
          {
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!summaryResponse.ok) {
          throw new Error(`Strava activities fetch failed with status ${summaryResponse.status}`);
        }

        const pageItems = await summaryResponse.json() as Array<Record<string, unknown>>;
        if (!Array.isArray(pageItems) || pageItems.length === 0) {
          break;
        }

        for (const item of pageItems) {
          if (typeof item.id !== 'number') continue;
          summaries.push({
            id: item.id,
            type: typeof item.type === 'string' ? item.type : undefined,
            sport_type: typeof item.sport_type === 'string' ? item.sport_type : undefined,
          });
        }

        if (pageItems.length < 200) break;
      }

      const details: StravaActivity[] = [];

      for (const summary of summaries) {
        const sportType = summary.sport_type ?? summary.type;
        if (sportType !== 'Run' && sportType !== 'TrailRun') {
          continue;
        }

        details.push(await this.getActivity(accessToken, summary.id));
      }

      return details;
    },

    async getActivity(accessToken: string, activityId: number): Promise<StravaActivity> {
      const detailResponse = await fetchImpl(
        `https://www.strava.com/api/v3/activities/${activityId}`,
        {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!detailResponse.ok) {
        throw new Error(`Strava activity detail fetch failed with status ${detailResponse.status}`);
      }

      const detail = await detailResponse.json() as Record<string, unknown>;
      const detailLaps = Array.isArray(detail.laps)
        ? detail.laps
          .filter((lap): lap is Record<string, unknown> => Boolean(lap) && typeof lap === 'object')
          .map(mapLap)
        : [];

      if (detailLaps.length > 0) {
        return mapDetailedActivity(detail, detailLaps);
      }

      const lapsResponse = await fetchImpl(
        `https://www.strava.com/api/v3/activities/${activityId}/laps`,
        {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!lapsResponse.ok) {
        throw new Error(`Strava activity laps fetch failed with status ${lapsResponse.status}`);
      }

      const lapsPayload = await lapsResponse.json() as unknown;
      const laps = Array.isArray(lapsPayload)
        ? lapsPayload
          .filter((lap): lap is Record<string, unknown> => Boolean(lap) && typeof lap === 'object')
          .map(mapLap)
        : [];

      return mapDetailedActivity(detail, laps);
    },

    async getGear(accessToken: string, gearId: string): Promise<StravaGear | null> {
      const response = await fetchImpl(
        `https://www.strava.com/api/v3/gear/${gearId}`,
        {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Strava gear fetch failed with status ${response.status}`);
      }

      const payload = await response.json() as Record<string, unknown>;
      if (
        typeof payload.id !== 'string'
        || typeof payload.brand_name !== 'string'
        || typeof payload.model_name !== 'string'
      ) {
        throw new Error('Strava gear detail returned an unexpected payload');
      }

      return {
        id: payload.id,
        brand: payload.brand_name,
        model: payload.model_name,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        retired: Boolean(payload.retired),
      };
    },
  };
}
