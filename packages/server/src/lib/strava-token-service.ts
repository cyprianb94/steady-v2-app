import { decrypt, encrypt } from './encryption';
import { StravaInvalidGrantError, type StravaClient } from './strava-client';
import type { IntegrationTokenRepo } from '../repos/integration-token-repo';
import type { ProfileRepo } from '../repos/profile-repo';

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export class StravaTokensMissingError extends Error {
  constructor() {
    super('No Strava tokens stored for this user');
    this.name = 'StravaTokensMissingError';
  }
}

export class StravaAuthRevokedError extends Error {
  constructor() {
    super('Strava access has been revoked');
    this.name = 'StravaAuthRevokedError';
  }
}

export interface StravaTokenService {
  getValidToken(userId: string): Promise<string>;
  revokeToken(userId: string): Promise<void>;
}

interface CreateStravaTokenServiceOptions {
  integrationTokenRepo: IntegrationTokenRepo;
  profileRepo: ProfileRepo;
  stravaClient: StravaClient;
  encryptionKey: string;
  now?: () => number;
}

function isWithinRefreshBuffer(expiresAt: string, now: number): boolean {
  return new Date(expiresAt).getTime() - now <= REFRESH_BUFFER_MS;
}

export async function revokeStravaTokenAccess(
  profileRepo: ProfileRepo,
  integrationTokenRepo: IntegrationTokenRepo,
  userId: string,
): Promise<void> {
  await integrationTokenRepo.delete(userId, 'strava');

  const profile = await profileRepo.getById(userId);
  if (!profile) return;

  await profileRepo.upsert({
    ...profile,
    stravaAthleteId: undefined,
  });
}

export function createStravaTokenService(options: CreateStravaTokenServiceOptions): StravaTokenService {
  const now = options.now ?? Date.now;

  return {
    async getValidToken(userId: string): Promise<string> {
      const token = await options.integrationTokenRepo.get(userId, 'strava');
      if (!token) {
        throw new StravaTokensMissingError();
      }

      if (!isWithinRefreshBuffer(token.expiresAt, now())) {
        return decrypt(token.encryptedAccessToken, options.encryptionKey);
      }

      const refreshToken = decrypt(token.encryptedRefreshToken, options.encryptionKey);

      try {
        const refreshed = await options.stravaClient.refreshToken(refreshToken);

        await options.integrationTokenRepo.save({
          ...token,
          encryptedAccessToken: encrypt(refreshed.accessToken, options.encryptionKey),
          encryptedRefreshToken: encrypt(refreshed.refreshToken, options.encryptionKey),
          expiresAt: refreshed.expiresAt,
          externalAthleteId: refreshed.athleteId,
        });

        return refreshed.accessToken;
      } catch (error) {
        if (error instanceof StravaInvalidGrantError) {
          await revokeStravaTokenAccess(options.profileRepo, options.integrationTokenRepo, userId);
          throw new StravaAuthRevokedError();
        }
        throw error;
      }
    },

    async revokeToken(userId: string): Promise<void> {
      await revokeStravaTokenAccess(options.profileRepo, options.integrationTokenRepo, userId);
    },
  };
}
