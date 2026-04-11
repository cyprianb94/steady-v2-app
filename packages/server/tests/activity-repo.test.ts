import { describe, it, expect, beforeEach } from 'vitest';
import type { Activity, SubjectiveInput } from '@steady/types';
import type { ActivityRepo } from '../src/repos/activity-repo';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';

function makeActivity(userId: string, overrides?: Partial<Activity>): Activity {
  return {
    id: crypto.randomUUID(),
    userId,
    source: 'strava',
    externalId: `ext-${crypto.randomUUID().slice(0, 8)}`,
    startTime: '2026-03-23T07:00:00Z',
    distance: 10,
    duration: 3000,
    avgPace: 300,
    splits: [{ km: 1, pace: 300 }, { km: 2, pace: 295 }],
    ...overrides,
  };
}

function runActivityRepoTests(name: string, createRepo: () => ActivityRepo) {
  describe(name, () => {
    let repo: ActivityRepo;

    beforeEach(() => {
      repo = createRepo();
    });

    it('returns empty array for user with no activities', async () => {
      expect(await repo.getByUserId('nonexistent')).toEqual([]);
    });

    it('saves and retrieves activities by userId', async () => {
      const a1 = makeActivity('user-1');
      const a2 = makeActivity('user-1');
      await repo.save(a1);
      await repo.save(a2);

      const activities = await repo.getByUserId('user-1');
      expect(activities).toHaveLength(2);
    });

    it('finds activity by external id and source', async () => {
      const activity = makeActivity('user-1', { source: 'strava', externalId: 'strava-123' });
      await repo.save(activity);

      const found = await repo.getByExternalId('user-1', 'strava', 'strava-123');
      expect(found).not.toBeNull();
      expect(found!.id).toBe(activity.id);

      // Different source returns null
      expect(await repo.getByExternalId('user-1', 'garmin', 'strava-123')).toBeNull();
    });

    it('gets an activity by id and supports deleting it', async () => {
      const activity = makeActivity('user-1');
      await repo.save(activity);

      expect(await repo.getById(activity.id)).toMatchObject({ id: activity.id });

      await repo.delete(activity.id);

      expect(await repo.getById(activity.id)).toBeNull();
    });

    it('updates subjective input on an activity', async () => {
      const activity = makeActivity('user-1');
      await repo.save(activity);

      const input: SubjectiveInput = { legs: 'normal', breathing: 'controlled', overall: 'done' };
      const updated = await repo.updateSubjectiveInput(activity.id, input);

      expect(updated).not.toBeNull();
      expect(updated!.subjectiveInput).toEqual(input);

      // Persisted
      const retrieved = (await repo.getByUserId('user-1'))[0];
      expect(retrieved.subjectiveInput!.legs).toBe('normal');
    });

    it('returns null when updating subjective input for nonexistent activity', async () => {
      expect(await repo.updateSubjectiveInput('ghost', {
        legs: 'heavy',
        breathing: 'labored',
        overall: 'shattered',
      })).toBeNull();
    });

    it('updates matched session id', async () => {
      const activity = makeActivity('user-1');
      await repo.save(activity);

      const updated = await repo.updateMatchedSession(activity.id, 'session-42');
      expect(updated!.matchedSessionId).toBe('session-42');
    });

    it('updates notes and shoe assignments on an activity', async () => {
      const activity = makeActivity('user-1');
      await repo.save(activity);

      const withNotes = await repo.updateNotes(activity.id, 'Legs woke up after 3k');
      const withShoe = await repo.setShoe(activity.id, 'shoe-42');

      expect(withNotes).toMatchObject({ notes: 'Legs woke up after 3k' });
      expect(withShoe).toMatchObject({ shoeId: 'shoe-42' });

      await repo.updateNotes(activity.id, null);
      await repo.setShoe(activity.id, null);

      expect(await repo.getById(activity.id)).toMatchObject({
        notes: undefined,
        shoeId: undefined,
      });
    });

    it('isolates activities between users', async () => {
      await repo.save(makeActivity('user-1'));
      await repo.save(makeActivity('user-2'));
      await repo.save(makeActivity('user-2'));

      expect(await repo.getByUserId('user-1')).toHaveLength(1);
      expect(await repo.getByUserId('user-2')).toHaveLength(2);
    });
  });
}

runActivityRepoTests('InMemoryActivityRepo', () => new InMemoryActivityRepo());
