import { beforeEach, describe, expect, it } from 'vitest';
import type { IntegrationToken } from '@steady/types';
import type { IntegrationTokenRepo } from '../src/repos/integration-token-repo';
import { InMemoryIntegrationTokenRepo } from '../src/repos/integration-token-repo.memory';

function makeToken(userId: string, provider = 'strava', overrides?: Partial<IntegrationToken>): IntegrationToken {
  return {
    id: crypto.randomUUID(),
    userId,
    provider,
    encryptedAccessToken: `enc-access-${crypto.randomUUID().slice(0, 8)}`,
    encryptedRefreshToken: `enc-refresh-${crypto.randomUUID().slice(0, 8)}`,
    expiresAt: '2026-04-10T12:00:00Z',
    createdAt: '2026-04-10T08:00:00Z',
    ...overrides,
  };
}

function runIntegrationTokenRepoTests(name: string, createRepo: () => IntegrationTokenRepo) {
  describe(name, () => {
    let repo: IntegrationTokenRepo;

    beforeEach(() => {
      repo = createRepo();
    });

    it('returns null when no token exists for the provider', async () => {
      expect(await repo.get('user-1', 'strava')).toBeNull();
    });

    it('saves and retrieves a token by user and provider', async () => {
      const token = makeToken('user-1');
      await repo.save(token);

      expect(await repo.get('user-1', 'strava')).toEqual(token);
    });

    it('upserts by user and provider without affecting other providers', async () => {
      await repo.save(makeToken('user-1', 'strava', { encryptedAccessToken: 'old-access' }));
      await repo.save(makeToken('user-1', 'garmin'));

      const replacement = makeToken('user-1', 'strava', { encryptedAccessToken: 'new-access' });
      await repo.save(replacement);

      expect((await repo.get('user-1', 'strava'))?.encryptedAccessToken).toBe('new-access');
      expect(await repo.get('user-1', 'garmin')).not.toBeNull();
    });

    it('updates lastSyncedAt for an existing token', async () => {
      await repo.save(makeToken('user-1'));

      const updated = await repo.updateLastSyncedAt('user-1', 'strava', '2026-04-10T09:30:00Z');
      expect(updated?.lastSyncedAt).toBe('2026-04-10T09:30:00Z');
      expect((await repo.get('user-1', 'strava'))?.lastSyncedAt).toBe('2026-04-10T09:30:00Z');
    });

    it('returns null when updating lastSyncedAt for a missing token', async () => {
      expect(await repo.updateLastSyncedAt('user-1', 'strava', '2026-04-10T09:30:00Z')).toBeNull();
    });

    it('deletes only the targeted provider token', async () => {
      await repo.save(makeToken('user-1', 'strava'));
      await repo.save(makeToken('user-1', 'garmin'));

      await repo.delete('user-1', 'strava');

      expect(await repo.get('user-1', 'strava')).toBeNull();
      expect(await repo.get('user-1', 'garmin')).not.toBeNull();
    });
  });
}

runIntegrationTokenRepoTests('InMemoryIntegrationTokenRepo', () => new InMemoryIntegrationTokenRepo());
