import { beforeEach, describe, expect, it } from 'vitest';
import type { Activity, NormalizedProviderActivity, TrainingPlan, User } from '@steady/types';
import { InMemoryActivityRepo } from '../src/repos/activity-repo.memory';
import { InMemoryActivityProvenanceRepo } from '../src/repos/activity-provenance-repo.memory';
import { InMemoryActivitySyncLogRepo } from '../src/repos/activity-sync-log-repo.memory';
import { InMemoryPlanRepo } from '../src/repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../src/repos/profile-repo.memory';
import { createActivityIngestionService } from '../src/services/activity-ingestion-service';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'runner@test.com',
    createdAt: '2026-04-01T00:00:00.000Z',
    appleHealthConnected: true,
    primaryRunSource: 'apple_watch',
    subscriptionTier: 'free',
    timezone: 'Europe/London',
    units: 'metric',
    weeklyVolumeMetric: 'distance',
    ...overrides,
  };
}

function makePlan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    id: 'plan-1',
    userId: 'user-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    raceName: 'Spring Half',
    raceDate: '2026-05-20',
    raceDistance: 'Half Marathon',
    targetTime: 'sub-1:40',
    phases: { BASE: 1, BUILD: 1, RECOVERY: 0, PEAK: 0, TAPER: 0 },
    progressionPct: 7,
    templateWeek: [null, null, null, null, null, null, null],
    weeks: [
      {
        weekNumber: 1,
        phase: 'BASE',
        plannedKm: 10,
        sessions: [
          {
            id: 'w1d0',
            type: 'EASY',
            date: '2026-04-08',
            distance: 10,
            pace: '5:00',
          },
          null,
          null,
          null,
          null,
          null,
          null,
        ],
      },
    ],
    activeInjury: null,
    ...overrides,
  };
}

function makeAppleRun(overrides: Partial<NormalizedProviderActivity> = {}): NormalizedProviderActivity {
  return {
    source: 'apple_health',
    externalId: 'apple-workout-1',
    name: 'Morning Run',
    sourceName: 'Apple Watch',
    sourceBundleId: 'com.apple.health',
    sourceDevice: 'Apple Watch Series 9',
    startTime: '2026-04-08T07:00:00.000Z',
    timezone: 'Europe/London',
    runSubtype: 'outdoor',
    distanceKm: 10,
    durationSeconds: 3000,
    movingDurationSeconds: 3000,
    elapsedDurationSeconds: 3012,
    elevationGainM: 42,
    avgPaceSecondsPerKm: 300,
    avgHR: 148,
    maxHR: 171,
    avgCadence: 166,
    splits: [{ km: 1, label: 'Workout', distance: 10, pace: 300, hr: 148, cadence: 166 }],
    dataQuality: {
      hasHeartRate: true,
      hasCadence: true,
      routeRetained: false,
    },
    ...overrides,
  };
}

describe('activity ingestion service', () => {
  let profileRepo: InMemoryProfileRepo;
  let activityRepo: InMemoryActivityRepo;
  let planRepo: InMemoryPlanRepo;
  let provenanceRepo: InMemoryActivityProvenanceRepo;
  let syncLogRepo: InMemoryActivitySyncLogRepo;
  let service: ReturnType<typeof createActivityIngestionService>;

  beforeEach(async () => {
    profileRepo = new InMemoryProfileRepo();
    activityRepo = new InMemoryActivityRepo();
    planRepo = new InMemoryPlanRepo();
    provenanceRepo = new InMemoryActivityProvenanceRepo();
    syncLogRepo = new InMemoryActivitySyncLogRepo();

    await profileRepo.upsert(makeUser());
    await planRepo.save(makePlan());

    service = createActivityIngestionService({
      profileRepo,
      activityRepo,
      planRepo,
      provenanceRepo,
      syncLogRepo,
      now: () => new Date('2026-04-10T12:05:00.000Z'),
    });
  });

  it('imports Apple Health runs through the shared matcher, provenance, and sync log path', async () => {
    const result = await service.ingest('user-1', [makeAppleRun()]);

    expect(result).toMatchObject({
      fetched: 1,
      imported: 1,
      skipped: 0,
      upgraded: 0,
      matched: 1,
      errors: 0,
      lastSuccessfulSyncAt: '2026-04-10T12:05:00.000Z',
    });
    expect(result.matchedSessions).toEqual([
      { sessionId: 'w1d0', sessionType: 'EASY', sessionDate: '2026-04-08' },
    ]);

    const [activity] = await activityRepo.getByUserId('user-1');
    expect(activity).toMatchObject({
      source: 'apple_health',
      externalId: 'apple-workout-1',
      sourceName: 'Apple Watch',
      sourceDevice: 'Apple Watch Series 9',
      runSubtype: 'outdoor',
      distance: 10,
      duration: 3000,
      avgPace: 300,
      avgHR: 148,
      maxHR: 171,
      avgCadence: 166,
      matchedSessionId: 'w1d0',
      splits: [{ km: 1, label: 'Workout', distance: 10, pace: 300, hr: 148, cadence: 166 }],
    });

    const plan = await planRepo.getActive('user-1');
    expect(plan?.weeks[0].sessions[0]).toMatchObject({
      id: 'w1d0',
      actualActivityId: activity.id,
    });

    const provenance = await provenanceRepo.getByProviderExternalId('user-1', 'apple_health', 'apple-workout-1');
    expect(provenance).toMatchObject({
      activityId: activity.id,
      sourceName: 'Apple Watch',
      sourceBundleId: 'com.apple.health',
      sourceDevice: 'Apple Watch Series 9',
      dataQualityFlags: expect.objectContaining({ routeRetained: false }),
    });

    const syncLog = await syncLogRepo.getLatestSuccessful('user-1', 'apple_health');
    expect(syncLog).toMatchObject({
      fetchedCount: 1,
      importedCount: 1,
      skippedCount: 0,
      upgradedCount: 0,
      errorCount: 0,
      lastSuccessfulSyncAt: '2026-04-10T12:05:00.000Z',
    });
  });

  it('lets primary Apple Watch data supersede duplicate Strava runs while preserving user-owned fields', async () => {
    const existingActivity: Activity = {
      id: 'activity-strava',
      userId: 'user-1',
      source: 'strava',
      externalId: 'strava-activity-1',
      startTime: '2026-04-08T07:00:40.000Z',
      distance: 10.02,
      duration: 3005,
      avgPace: 300,
      avgHR: 146,
      splits: [{ km: 1, pace: 300 }],
      matchedSessionId: 'w1d0',
      subjectiveInput: {
        legs: 'normal',
        breathing: 'controlled',
        overall: 'done',
      },
      shoeId: 'shoe-1',
      notes: 'Keep this note',
      fuelEvents: [
        {
          id: 'fuel-1',
          minute: 35,
          gel: {
            id: 'gel-1',
            brand: 'Precision Fuel & Hydration',
            name: 'PF 30 Gel',
            flavour: 'Original',
            caloriesKcal: 120,
            carbsG: 30,
            caffeineMg: 0,
            sodiumMg: 0,
            potassiumMg: 0,
            magnesiumMg: 0,
            imageUrl: null,
          },
        },
      ],
    };
    await activityRepo.save(existingActivity);
    await planRepo.save(makePlan({
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 10,
          sessions: [
            {
              id: 'w1d0',
              type: 'EASY',
              date: '2026-04-08',
              distance: 10,
              pace: '5:00',
              actualActivityId: existingActivity.id,
            },
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        },
      ],
    }));

    const result = await service.ingest('user-1', [makeAppleRun({
      externalId: 'apple-workout-upgrade',
      startTime: '2026-04-08T07:00:20.000Z',
      distanceKm: 10,
      durationSeconds: 3000,
    })]);

    expect(result).toMatchObject({
      fetched: 1,
      imported: 0,
      skipped: 0,
      upgraded: 1,
      matched: 0,
      errors: 0,
    });

    const upgraded = await activityRepo.getById(existingActivity.id);
    expect(upgraded).toMatchObject({
      id: existingActivity.id,
      source: 'apple_health',
      externalId: 'apple-workout-upgrade',
      matchedSessionId: 'w1d0',
      subjectiveInput: existingActivity.subjectiveInput,
      shoeId: 'shoe-1',
      notes: 'Keep this note',
      fuelEvents: existingActivity.fuelEvents,
    });
  });

  it('does not supersede Strava duplicates when Strava is the primary source', async () => {
    await profileRepo.upsert(makeUser({ primaryRunSource: 'strava' }));
    await activityRepo.save({
      id: 'activity-strava',
      userId: 'user-1',
      source: 'strava',
      externalId: 'strava-activity-1',
      startTime: '2026-04-08T07:00:00.000Z',
      distance: 10,
      duration: 3000,
      avgPace: 300,
      splits: [{ km: 1, pace: 300 }],
      matchedSessionId: 'w1d0',
    });

    const result = await service.ingest('user-1', [makeAppleRun()]);

    expect(result).toMatchObject({
      fetched: 1,
      imported: 0,
      skipped: 1,
      upgraded: 0,
      matched: 0,
      errors: 0,
    });
    await expect(activityRepo.getById('activity-strava')).resolves.toMatchObject({
      source: 'strava',
      externalId: 'strava-activity-1',
    });
  });

  it('skips low-confidence near-duplicates instead of guessing', async () => {
    await activityRepo.save({
      id: 'activity-nearby',
      userId: 'user-1',
      source: 'strava',
      externalId: 'strava-nearby',
      startTime: '2026-04-08T07:08:00.000Z',
      distance: 10.4,
      duration: 3180,
      avgPace: 306,
      splits: [{ km: 1, pace: 306 }],
    });

    const result = await service.ingest('user-1', [makeAppleRun()]);

    expect(result).toMatchObject({
      fetched: 1,
      imported: 0,
      skipped: 1,
      upgraded: 0,
      matched: 0,
      errors: 0,
    });
    await expect(activityRepo.getByExternalId('user-1', 'apple_health', 'apple-workout-1')).resolves.toBeNull();
  });
});
