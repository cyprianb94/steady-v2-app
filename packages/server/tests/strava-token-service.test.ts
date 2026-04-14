import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encrypt } from '../src/lib/encryption';
import {
  createStravaTokenService,
  StravaAuthRevokedError,
  StravaTokensMissingError,
} from '../src/lib/strava-token-service';
import { StravaInvalidGrantError, type StravaClient } from '../src/lib/strava-client';
import { InMemoryIntegrationTokenRepo } from '../src/repos/integration-token-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';

describe('StravaTokenService', () => {
  let integrationTokenRepo: InMemoryIntegrationTokenRepo;
  let profileRepo: InMemoryProfileRepo;
  let stravaClient: StravaClient;
  const encryptionKey = 'test-encryption-key';

  beforeEach(async () => {
    integrationTokenRepo = new InMemoryIntegrationTokenRepo();
    profileRepo = new InMemoryProfileRepo();
    stravaClient = {
      exchangeCode: async () => {
        throw new Error('not used in this test');
      },
      refreshToken: async () => ({
        accessToken: 'refreshed-access',
        refreshToken: 'refreshed-refresh',
        expiresAt: '2026-04-10T12:30:00Z',
      }),
      getActivities: async () => [],
      getActivity: async () => {
        throw new Error('not used in this test');
      },
      getGear: async () => null,
    };

    await profileRepo.upsert({
      id: 'user-1',
      email: 'user-1@test.com',
      createdAt: '2026-04-10T08:00:00Z',
      stravaAthleteId: 'athlete-42',
      appleHealthConnected: false,
      subscriptionTier: 'free',
      timezone: 'Europe/London',
      units: 'metric',
    });
  });

  it('returns the existing access token when it is not close to expiry', async () => {
    await integrationTokenRepo.save({
      id: 'token-1',
      userId: 'user-1',
      provider: 'strava',
      encryptedAccessToken: encrypt('current-access', encryptionKey),
      encryptedRefreshToken: encrypt('current-refresh', encryptionKey),
      expiresAt: '2026-04-10T12:00:00Z',
      externalAthleteId: 'athlete-42',
      createdAt: '2026-04-10T08:00:00Z',
    });

    const refreshTokenSpy = vi.fn(stravaClient.refreshToken);
    stravaClient = { ...stravaClient, refreshToken: refreshTokenSpy };

    const service = createStravaTokenService({
      integrationTokenRepo,
      profileRepo,
      stravaClient,
      encryptionKey,
      now: () => new Date('2026-04-10T11:00:00Z').getTime(),
    });

    await expect(service.getValidToken('user-1')).resolves.toBe('current-access');
    expect(refreshTokenSpy).not.toHaveBeenCalled();
  });

  it('refreshes the token when it is within the 5 minute expiry buffer', async () => {
    await integrationTokenRepo.save({
      id: 'token-1',
      userId: 'user-1',
      provider: 'strava',
      encryptedAccessToken: encrypt('current-access', encryptionKey),
      encryptedRefreshToken: encrypt('current-refresh', encryptionKey),
      expiresAt: '2026-04-10T11:04:00Z',
      externalAthleteId: 'athlete-42',
      createdAt: '2026-04-10T08:00:00Z',
    });

    const refreshTokenSpy = vi.fn(stravaClient.refreshToken);
    stravaClient = { ...stravaClient, refreshToken: refreshTokenSpy };

    const service = createStravaTokenService({
      integrationTokenRepo,
      profileRepo,
      stravaClient,
      encryptionKey,
      now: () => new Date('2026-04-10T11:00:00Z').getTime(),
    });

    await expect(service.getValidToken('user-1')).resolves.toBe('refreshed-access');
    expect(refreshTokenSpy).toHaveBeenCalledWith('current-refresh');

    const token = await integrationTokenRepo.get('user-1', 'strava');
    expect(token).not.toBeNull();
    expect(token?.expiresAt).toBe('2026-04-10T12:30:00Z');
    expect(token?.encryptedAccessToken).not.toBe('refreshed-access');
    expect(token?.externalAthleteId).toBe('athlete-42');
  });

  it('throws a typed error when no tokens exist for the user', async () => {
    const service = createStravaTokenService({
      integrationTokenRepo,
      profileRepo,
      stravaClient,
      encryptionKey,
    });

    await expect(service.getValidToken('user-1')).rejects.toBeInstanceOf(StravaTokensMissingError);
  });

  it('auto-disconnects and throws a typed error when Strava auth has been revoked', async () => {
    await integrationTokenRepo.save({
      id: 'token-1',
      userId: 'user-1',
      provider: 'strava',
      encryptedAccessToken: encrypt('current-access', encryptionKey),
      encryptedRefreshToken: encrypt('current-refresh', encryptionKey),
      expiresAt: '2026-04-10T11:03:00Z',
      externalAthleteId: 'athlete-42',
      createdAt: '2026-04-10T08:00:00Z',
    });

    stravaClient = {
      ...stravaClient,
      refreshToken: async () => {
        throw new StravaInvalidGrantError();
      },
    };

    const service = createStravaTokenService({
      integrationTokenRepo,
      profileRepo,
      stravaClient,
      encryptionKey,
      now: () => new Date('2026-04-10T11:00:00Z').getTime(),
    });

    await expect(service.getValidToken('user-1')).rejects.toBeInstanceOf(StravaAuthRevokedError);
    await expect(integrationTokenRepo.get('user-1', 'strava')).resolves.toBeNull();
    await expect(profileRepo.getById('user-1')).resolves.toMatchObject({ stravaAthleteId: undefined });
  });

  it('revokeToken deletes the token row and clears the profile athlete id', async () => {
    await integrationTokenRepo.save({
      id: 'token-1',
      userId: 'user-1',
      provider: 'strava',
      encryptedAccessToken: encrypt('current-access', encryptionKey),
      encryptedRefreshToken: encrypt('current-refresh', encryptionKey),
      expiresAt: '2026-04-10T11:03:00Z',
      externalAthleteId: 'athlete-42',
      createdAt: '2026-04-10T08:00:00Z',
    });

    const service = createStravaTokenService({
      integrationTokenRepo,
      profileRepo,
      stravaClient,
      encryptionKey,
    });

    await service.revokeToken('user-1');

    await expect(integrationTokenRepo.get('user-1', 'strava')).resolves.toBeNull();
    await expect(profileRepo.getById('user-1')).resolves.toMatchObject({ stravaAthleteId: undefined });
  });
});
