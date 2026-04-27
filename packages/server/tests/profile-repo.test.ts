import { describe, it, expect, beforeEach } from 'vitest';
import type { User } from '@steady/types';
import type { ProfileRepo } from '../src/repos/profile-repo';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';

function makeUser(id: string, overrides?: Partial<User>): User {
  return {
    id,
    email: `${id}@test.com`,
    createdAt: '2026-01-01T00:00:00Z',
    appleHealthConnected: false,
    subscriptionTier: 'free',
    timezone: 'Europe/London',
    units: 'metric',
    weeklyVolumeMetric: 'distance',
    ...overrides,
  };
}

function runProfileRepoTests(name: string, createRepo: () => ProfileRepo) {
  describe(name, () => {
    let repo: ProfileRepo;

    beforeEach(() => {
      repo = createRepo();
    });

    it('returns null for nonexistent profile', async () => {
      expect(await repo.getById('nonexistent')).toBeNull();
    });

    it('creates a profile via upsert and retrieves it', async () => {
      const user = makeUser('user-1');
      const saved = await repo.upsert(user);

      expect(saved.id).toBe('user-1');
      expect(saved.email).toBe('user-1@test.com');

      const retrieved = await repo.getById('user-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.email).toBe('user-1@test.com');
      expect(retrieved!.subscriptionTier).toBe('free');
      expect(retrieved!.timezone).toBe('Europe/London');
      expect(retrieved!.weeklyVolumeMetric).toBe('distance');
    });

    it('updates an existing profile via upsert', async () => {
      await repo.upsert(makeUser('user-1', { timezone: 'Europe/London' }));
      await repo.upsert(makeUser('user-1', {
        timezone: 'America/New_York',
        units: 'imperial',
        weeklyVolumeMetric: 'time',
      }));

      const retrieved = await repo.getById('user-1');
      expect(retrieved!.timezone).toBe('America/New_York');
      expect(retrieved!.units).toBe('imperial');
      expect(retrieved!.weeklyVolumeMetric).toBe('time');
    });

    it('updates subscription tier and expiry', async () => {
      await repo.upsert(makeUser('user-1'));

      const updated = await repo.updateSubscription('user-1', 'pro', '2027-01-01T00:00:00Z');
      expect(updated).not.toBeNull();
      expect(updated!.subscriptionTier).toBe('pro');
      expect(updated!.subscriptionExpiresAt).toBe('2027-01-01T00:00:00Z');

      // Persisted
      const retrieved = await repo.getById('user-1');
      expect(retrieved!.subscriptionTier).toBe('pro');
    });

    it('returns null when updating subscription for nonexistent user', async () => {
      expect(await repo.updateSubscription('ghost', 'pro')).toBeNull();
    });

    it('isolates profiles between users', async () => {
      await repo.upsert(makeUser('user-1', { email: 'a@test.com' }));
      await repo.upsert(makeUser('user-2', { email: 'b@test.com' }));

      expect((await repo.getById('user-1'))!.email).toBe('a@test.com');
      expect((await repo.getById('user-2'))!.email).toBe('b@test.com');
    });
  });
}

runProfileRepoTests('InMemoryProfileRepo', () => new InMemoryProfileRepo());
