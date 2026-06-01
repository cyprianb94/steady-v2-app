import { describe, expect, it, vi } from 'vitest';
import {
  APPLE_HEALTH_READ_TYPES,
  readAppleHealthRuns,
  requestAppleHealthAuthorization,
  type AppleHealthKitClient,
} from '../features/apple-health/apple-health-client';

function makeClient(overrides: Partial<AppleHealthKitClient> = {}): AppleHealthKitClient {
  return {
    isHealthDataAvailableAsync: vi.fn().mockResolvedValue(true),
    requestAuthorization: vi.fn().mockResolvedValue(true),
    queryWorkoutSamples: vi.fn().mockResolvedValue([]),
    WorkoutActivityType: { running: 37 },
    ...overrides,
  };
}

describe('apple health client', () => {
  it('requests only the v1 run permissions Steady needs', async () => {
    const client = makeClient();

    await expect(requestAppleHealthAuthorization(client, 'ios')).resolves.toBe(true);

    expect(client.requestAuthorization).toHaveBeenCalledWith({
      toRead: APPLE_HEALTH_READ_TYPES,
    });
    expect(APPLE_HEALTH_READ_TYPES).not.toContain('HKWorkoutRouteTypeIdentifier');
    expect(APPLE_HEALTH_READ_TYPES).not.toContain('HKQuantityTypeIdentifierHeartRateVariabilitySDNN');
  });

  it('maps Apple Watch workouts and filters mirrored third-party workouts without reading routes', async () => {
    const appleGetStatistic = vi.fn(async (type: string) => {
      if (type === 'HKQuantityTypeIdentifierHeartRate') {
        return {
          averageQuantity: { quantity: 148, unit: 'count/min' },
          maximumQuantity: { quantity: 171, unit: 'count/min' },
        };
      }

      if (type === 'HKQuantityTypeIdentifierStepCount') {
        return { sumQuantity: { quantity: 4520, unit: 'count' } };
      }

      return undefined;
    });
    const thirdPartyGetWorkoutRoutes = vi.fn();
    const client = makeClient({
      queryWorkoutSamples: vi.fn().mockResolvedValue([
        {
          uuid: 'apple-workout-1',
          startDate: new Date('2026-05-29T07:00:00.000Z'),
          endDate: new Date('2026-05-29T07:30:00.000Z'),
          duration: { quantity: 1800, unit: 's' },
          totalDistance: { quantity: 6200, unit: 'm' },
          metadata: { HKIndoorWorkout: false },
          sourceRevision: {
            source: {
              name: 'Apple Watch',
              bundleIdentifier: 'com.apple.health',
            },
            productType: 'Watch7,4',
          },
          device: {
            manufacturer: 'Apple',
            model: 'Watch',
          },
          getStatistic: appleGetStatistic,
        },
        {
          uuid: 'strava-mirror-1',
          startDate: new Date('2026-05-29T08:00:00.000Z'),
          endDate: new Date('2026-05-29T08:30:00.000Z'),
          duration: { quantity: 1800, unit: 's' },
          totalDistance: { quantity: 5000, unit: 'm' },
          sourceRevision: {
            source: {
              name: 'Strava',
              bundleIdentifier: 'com.strava.stravaride',
            },
          },
          getWorkoutRoutes: thirdPartyGetWorkoutRoutes,
        },
      ]),
    });

    const runs = await readAppleHealthRuns({
      since: new Date('2026-05-01T00:00:00.000Z'),
      until: new Date('2026-05-30T00:00:00.000Z'),
      timezone: 'Europe/London',
      client,
      platformOS: 'ios',
    });

    expect(client.queryWorkoutSamples).toHaveBeenCalledWith(expect.objectContaining({
      filter: expect.objectContaining({
        workoutActivityType: 37,
      }),
      ascending: true,
    }));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      source: 'apple_health',
      externalId: 'apple-workout-1',
      sourceName: 'Apple Watch',
      sourceBundleId: 'com.apple.health',
      sourceDevice: expect.stringContaining('Apple'),
      startTime: '2026-05-29T07:00:00.000Z',
      timezone: 'Europe/London',
      runSubtype: 'outdoor',
      distanceKm: 6.2,
      durationSeconds: 1800,
      avgPaceSecondsPerKm: 290,
      avgHR: 148,
      maxHR: 171,
      avgCadence: 151,
      dataQuality: expect.objectContaining({
        routeRetained: false,
        hasHeartRate: true,
        hasCadence: true,
        hasKilometreSplits: false,
      }),
    });
    expect(runs[0].splits[0]).toMatchObject({
      label: 'Workout',
      distance: 6.2,
      pace: 290,
      hr: 148,
      cadence: 151,
    });
    expect(thirdPartyGetWorkoutRoutes).not.toHaveBeenCalled();
  });

  it('derives kilometre splits from Apple Health workout quantity samples', async () => {
    const start = new Date('2026-05-29T07:00:00.000Z');
    const workout = {
      uuid: 'apple-workout-1',
      startDate: start,
      endDate: new Date('2026-05-29T07:16:30.000Z'),
      duration: { quantity: 990, unit: 's' },
      totalDistance: { quantity: 2500, unit: 'm' },
      metadata: { HKIndoorWorkout: false },
      sourceRevision: {
        source: {
          name: 'Apple Watch',
          bundleIdentifier: 'com.apple.health',
        },
        productType: 'Watch7,4',
      },
      device: {
        manufacturer: 'Apple',
        model: 'Watch',
      },
      getStatistic: vi.fn(async (type: string) => {
        if (type === 'HKQuantityTypeIdentifierHeartRate') {
          return {
            averageQuantity: { quantity: 146, unit: 'count/min' },
            maximumQuantity: { quantity: 153, unit: 'count/min' },
          };
        }

        if (type === 'HKQuantityTypeIdentifierStepCount') {
          return { sumQuantity: { quantity: 2694, unit: 'count' } };
        }

        return undefined;
      }),
    };
    const queryQuantitySamples = vi.fn(async (type: string) => {
      if (type === 'HKQuantityTypeIdentifierDistanceWalkingRunning') {
        return [
          { startDate: new Date('2026-05-29T07:00:00.000Z'), endDate: new Date('2026-05-29T07:06:20.000Z'), quantity: 1000, unit: 'm' },
          { startDate: new Date('2026-05-29T07:06:20.000Z'), endDate: new Date('2026-05-29T07:12:52.000Z'), quantity: 1000, unit: 'm' },
          { startDate: new Date('2026-05-29T07:12:52.000Z'), endDate: new Date('2026-05-29T07:16:30.000Z'), quantity: 500, unit: 'm' },
        ];
      }

      if (type === 'HKQuantityTypeIdentifierHeartRate') {
        return [
          { startDate: new Date('2026-05-29T07:03:00.000Z'), endDate: new Date('2026-05-29T07:03:00.000Z'), quantity: 141, unit: 'count/min' },
          { startDate: new Date('2026-05-29T07:09:00.000Z'), endDate: new Date('2026-05-29T07:09:00.000Z'), quantity: 142, unit: 'count/min' },
          { startDate: new Date('2026-05-29T07:14:30.000Z'), endDate: new Date('2026-05-29T07:14:30.000Z'), quantity: 153, unit: 'count/min' },
        ];
      }

      if (type === 'HKQuantityTypeIdentifierStepCount') {
        return [
          { startDate: new Date('2026-05-29T07:00:00.000Z'), endDate: new Date('2026-05-29T07:06:20.000Z'), quantity: 1026, unit: 'count' },
          { startDate: new Date('2026-05-29T07:06:20.000Z'), endDate: new Date('2026-05-29T07:12:52.000Z'), quantity: 1078, unit: 'count' },
          { startDate: new Date('2026-05-29T07:12:52.000Z'), endDate: new Date('2026-05-29T07:16:30.000Z'), quantity: 590, unit: 'count' },
        ];
      }

      return [];
    });
    const client = makeClient({
      queryWorkoutSamples: vi.fn().mockResolvedValue([workout]),
      queryQuantitySamples,
    });

    const runs = await readAppleHealthRuns({
      since: new Date('2026-05-01T00:00:00.000Z'),
      until: new Date('2026-05-30T00:00:00.000Z'),
      timezone: 'Europe/London',
      client,
      platformOS: 'ios',
    });

    expect(queryQuantitySamples).toHaveBeenCalledWith(
      'HKQuantityTypeIdentifierDistanceWalkingRunning',
      expect.objectContaining({
        filter: expect.objectContaining({ workout }),
        unit: 'm',
      }),
    );
    expect(runs).toHaveLength(1);
    expect(runs[0].dataQuality).toMatchObject({
      hasKilometreSplits: true,
      splitSource: 'distance_samples',
    });
    expect(runs[0].splits).toEqual([
      { km: 1, distance: 1, pace: 380, hr: 141, cadence: 162 },
      { km: 2, distance: 1, pace: 392, hr: 142, cadence: 165 },
      { km: 3, distance: 0.5, pace: 436, hr: 153, cadence: 162 },
    ]);
  });

  it('returns no runs on non-iOS platforms', async () => {
    const client = makeClient();

    await expect(readAppleHealthRuns({
      since: new Date('2026-05-01T00:00:00.000Z'),
      client,
      platformOS: 'android',
    })).resolves.toEqual([]);

    expect(client.queryWorkoutSamples).not.toHaveBeenCalled();
  });
});
