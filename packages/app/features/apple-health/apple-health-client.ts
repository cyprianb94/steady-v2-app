import { Platform } from 'react-native';
import type { ActivityRunSubtype, NormalizedProviderActivity } from '@steady/types';

export type AppleHealthActivity = Omit<NormalizedProviderActivity, 'source'> & { source: 'apple_health' };

export const APPLE_HEALTH_READ_TYPES = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierRunningSpeed',
] as const;

const RUNNING_WORKOUT_ACTIVITY_TYPE = 37;
const DISTANCE_TYPE = 'HKQuantityTypeIdentifierDistanceWalkingRunning';
const HEART_RATE_TYPE = 'HKQuantityTypeIdentifierHeartRate';
const STEP_COUNT_TYPE = 'HKQuantityTypeIdentifierStepCount';
const RUNNING_SPEED_TYPE = 'HKQuantityTypeIdentifierRunningSpeed';
const ONE_KM_METERS = 1000;
const MIN_DERIVED_SPLIT_METERS = 25;
const MAX_SAMPLE_TOTAL_DRIFT_RATIO = 0.25;

type HealthQuantity = {
  quantity?: number;
  unit?: string;
};

type HealthStatistic = {
  averageQuantity?: HealthQuantity;
  maximumQuantity?: HealthQuantity;
  sumQuantity?: HealthQuantity;
};

type HealthQuantitySample = {
  quantity?: number;
  unit?: string;
  startDate?: Date | string;
  endDate?: Date | string;
};

type HealthSource = {
  name?: string;
  bundleIdentifier?: string;
};

type HealthDevice = {
  name?: string;
  manufacturer?: string;
  model?: string;
  hardwareVersion?: string;
};

type HealthWorkout = {
  uuid?: string;
  name?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  duration?: HealthQuantity | number;
  totalDistance?: HealthQuantity;
  metadata?: Record<string, unknown>;
  sourceRevision?: {
    source?: HealthSource;
    productType?: string;
  };
  device?: HealthDevice;
  events?: readonly unknown[];
  getStatistic?: (quantityType: string, unitOverride?: string) => Promise<HealthStatistic | undefined>;
};

export type AppleHealthKitClient = {
  isHealthDataAvailableAsync: () => Promise<boolean>;
  requestAuthorization: (request: { toRead: readonly string[] }) => Promise<boolean>;
  queryWorkoutSamples: (options: {
    filter?: {
      workoutActivityType?: number;
      date?: { startDate?: Date; endDate?: Date };
    };
    limit: number;
    ascending?: boolean;
  }) => Promise<readonly HealthWorkout[]>;
  queryQuantitySamples?: (identifier: string, options: {
    filter?: {
      workout?: HealthWorkout;
      date?: { startDate?: Date; endDate?: Date };
    };
    limit: number;
    ascending?: boolean;
    unit?: string;
  }) => Promise<readonly HealthQuantitySample[]>;
  WorkoutActivityType?: { running?: number };
};

type QuantitySampleSegment = {
  startMs: number;
  endMs: number;
  quantity: number;
};

type DistanceSegment = {
  startMs: number;
  endMs: number;
  distanceMeters: number;
};

type SplitWindow = {
  km: number;
  startMs: number;
  endMs: number;
  distanceKm: number;
  durationSeconds: number;
};

export interface ReadAppleHealthRunsOptions {
  since: Date;
  until?: Date;
  limit?: number;
  timezone?: string;
  client?: AppleHealthKitClient;
  platformOS?: string;
}

async function loadHealthKitClient(): Promise<AppleHealthKitClient> {
  return await import('@kingstinct/react-native-healthkit') as unknown as AppleHealthKitClient;
}

function toDate(value: Date | string | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function quantityValue(quantity: HealthQuantity | number | undefined | null): number | null {
  if (typeof quantity === 'number') {
    return Number.isFinite(quantity) ? quantity : null;
  }

  const value = quantity?.quantity;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function quantityUnit(quantity: HealthQuantity | number | undefined | null): string {
  return typeof quantity === 'object' && quantity?.unit ? quantity.unit.toLowerCase() : '';
}

function distanceKmFromQuantity(quantity: HealthQuantity | undefined): number | null {
  const value = quantityValue(quantity);
  if (value == null || value <= 0) return null;

  const unit = quantityUnit(quantity);
  if (unit === 'km') return value;
  if (unit === 'mi' || unit.includes('mile')) return value * 1.609344;
  if (unit === 'ft' || unit.includes('foot') || unit.includes('feet')) return value * 0.0003048;
  return value / 1000;
}

function metersPerSecondFromQuantity(quantity: HealthQuantity | undefined): number | null {
  const value = quantityValue(quantity);
  if (value == null || value <= 0) return null;

  const unit = quantityUnit(quantity);
  if (!unit || unit === 'm/s') return value;
  if (unit === 'km/h') return value / 3.6;
  if (unit === 'mph' || unit.includes('mi/h')) return value * 0.44704;
  return value;
}

function secondsFromQuantity(quantity: HealthQuantity | number | undefined, start: Date, end: Date): number {
  const value = quantityValue(quantity);
  if (value != null && value > 0) {
    const unit = quantityUnit(quantity);
    if (unit === 'h' || unit.includes('hour')) return value * 3600;
    if (unit === 'min' || unit.includes('minute')) return value * 60;
    return value;
  }

  return Math.max(0, (end.getTime() - start.getTime()) / 1000);
}

function roundedMetric(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined;
}

async function safeStatistic(
  workout: HealthWorkout,
  quantityType: string,
  unitOverride?: string,
): Promise<HealthStatistic | undefined> {
  if (!workout.getStatistic) return undefined;

  try {
    return await workout.getStatistic(quantityType, unitOverride);
  } catch {
    return undefined;
  }
}

async function safeQuantitySamples(
  client: AppleHealthKitClient,
  workout: HealthWorkout,
  quantityType: string,
  unit: string,
  start: Date,
  end: Date,
): Promise<readonly HealthQuantitySample[]> {
  if (!client.queryQuantitySamples) return [];

  const baseOptions = {
    limit: -1,
    ascending: true,
    unit,
  };

  try {
    return await client.queryQuantitySamples(quantityType, {
      ...baseOptions,
      filter: {
        workout,
        date: { startDate: start, endDate: end },
      },
    });
  } catch {
    try {
      return await client.queryQuantitySamples(quantityType, {
        ...baseOptions,
        filter: {
          date: { startDate: start, endDate: end },
        },
      });
    } catch {
      return [];
    }
  }
}

function sourceForWorkout(workout: HealthWorkout): { sourceName?: string; sourceBundleId?: string } {
  const source = workout.sourceRevision?.source;
  return {
    sourceName: source?.name,
    sourceBundleId: source?.bundleIdentifier,
  };
}

function sourceDeviceForWorkout(workout: HealthWorkout): string | undefined {
  const parts = [
    workout.device?.manufacturer,
    workout.device?.model,
    workout.device?.name,
    workout.sourceRevision?.productType,
  ]
    .map((part) => part?.trim())
    .filter(Boolean);

  return parts.length ? [...new Set(parts)].join(' ') : undefined;
}

function lowerSignalText(workout: HealthWorkout): string {
  const { sourceName, sourceBundleId } = sourceForWorkout(workout);
  const metadataValues = Object.values(workout.metadata ?? {})
    .filter((value) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    .map(String);

  return [
    sourceName,
    sourceBundleId,
    sourceDeviceForWorkout(workout),
    workout.name,
    workout.sourceRevision?.productType,
    ...metadataValues,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isThirdPartyMirroredWorkout(workout: HealthWorkout): boolean {
  const text = lowerSignalText(workout);
  return [
    'strava',
    'garmin',
    'connectiq',
    'nike run',
    'runkeeper',
    'polar',
    'suunto',
    'coros',
    'wahoo',
  ].some((keyword) => text.includes(keyword));
}

function isAppleWatchOrAppleFitnessWorkout(workout: HealthWorkout): boolean {
  if (isThirdPartyMirroredWorkout(workout)) {
    return false;
  }

  const { sourceName, sourceBundleId } = sourceForWorkout(workout);
  const text = lowerSignalText(workout);
  const bundleId = sourceBundleId?.toLowerCase() ?? '';
  const source = sourceName?.toLowerCase() ?? '';

  return (
    text.includes('apple watch')
    || text.includes('watch')
    || (bundleId.startsWith('com.apple') && (source.includes('workout') || source.includes('fitness') || source.includes('health')))
  );
}

function runSubtypeForWorkout(workout: HealthWorkout): ActivityRunSubtype {
  const metadata = workout.metadata ?? {};
  const indoorWorkout = metadata.HKIndoorWorkout ?? metadata.HKMetadataKeyIndoorWorkout;
  const signalText = lowerSignalText(workout);

  if (indoorWorkout === true || indoorWorkout === 1 || signalText.includes('treadmill') || signalText.includes('indoor')) {
    return 'treadmill';
  }
  if (signalText.includes('trail')) return 'trail';
  if (signalText.includes('track')) return 'track';
  if (indoorWorkout === false || indoorWorkout === 0 || signalText.includes('outdoor')) return 'outdoor';
  return 'unknown';
}

function getTimezone(timezone: string | undefined): string | undefined {
  return timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function buildSummarySplit(
  distanceKm: number,
  durationSeconds: number,
  avgHR: number | undefined,
  avgCadence: number | undefined,
) {
  return {
    km: 1,
    label: 'Workout',
    distance: Number(distanceKm.toFixed(3)),
    pace: Math.round(durationSeconds / distanceKm),
    hr: avgHR,
    cadence: avgCadence,
  };
}

function normaliseSampleSegment(sample: HealthQuantitySample): QuantitySampleSegment | null {
  const start = toDate(sample.startDate);
  const end = toDate(sample.endDate) ?? start;
  const quantity = quantityValue(sample);

  if (!start || !end || quantity == null || quantity <= 0) {
    return null;
  }

  const startMs = start.getTime();
  const endMs = Math.max(end.getTime(), startMs);
  return Number.isFinite(startMs) && Number.isFinite(endMs)
    ? { startMs, endMs, quantity }
    : null;
}

function distanceSegmentsFromDistanceSamples(samples: readonly HealthQuantitySample[]): DistanceSegment[] {
  return samples
    .map((sample) => {
      const segment = normaliseSampleSegment(sample);
      const distanceKm = distanceKmFromQuantity({ quantity: sample.quantity, unit: sample.unit });
      if (!segment || distanceKm == null || distanceKm <= 0) {
        return null;
      }

      return {
        startMs: segment.startMs,
        endMs: segment.endMs,
        distanceMeters: distanceKm * 1000,
      };
    })
    .filter((segment): segment is DistanceSegment => segment != null)
    .sort((left, right) => left.startMs - right.startMs);
}

function distanceSegmentsFromSpeedSamples(samples: readonly HealthQuantitySample[]): DistanceSegment[] {
  return samples
    .map((sample) => {
      const segment = normaliseSampleSegment(sample);
      const speedMetersPerSecond = metersPerSecondFromQuantity({
        quantity: sample.quantity,
        unit: sample.unit,
      });
      if (!segment || speedMetersPerSecond == null || speedMetersPerSecond <= 0) {
        return null;
      }

      const durationSeconds = Math.max(0, (segment.endMs - segment.startMs) / 1000);
      if (durationSeconds <= 0) {
        return null;
      }

      return {
        startMs: segment.startMs,
        endMs: segment.endMs,
        distanceMeters: speedMetersPerSecond * durationSeconds,
      };
    })
    .filter((segment): segment is DistanceSegment => segment != null)
    .sort((left, right) => left.startMs - right.startMs);
}

function hasUsefulSplitGranularity(segments: DistanceSegment[], totalDistanceMeters: number): boolean {
  if (segments.length === 0 || totalDistanceMeters <= 0) {
    return false;
  }

  if (totalDistanceMeters <= ONE_KM_METERS * 1.5) {
    return true;
  }

  const largestSegmentMeters = Math.max(...segments.map((segment) => segment.distanceMeters));
  return segments.length > 1 && largestSegmentMeters <= Math.max(ONE_KM_METERS * 1.5, totalDistanceMeters * 0.6);
}

function buildKilometreSplitWindows(
  segments: DistanceSegment[],
  totalDistanceKm: number,
): SplitWindow[] {
  const totalDistanceMeters = totalDistanceKm * 1000;
  const sampleDistanceMeters = segments.reduce((total, segment) => total + segment.distanceMeters, 0);

  if (
    totalDistanceMeters <= 0
    || sampleDistanceMeters <= 0
    || !hasUsefulSplitGranularity(segments, totalDistanceMeters)
  ) {
    return [];
  }

  const driftRatio = Math.abs(sampleDistanceMeters - totalDistanceMeters) / totalDistanceMeters;
  if (driftRatio > MAX_SAMPLE_TOTAL_DRIFT_RATIO) {
    return [];
  }

  const distanceScale = totalDistanceMeters / sampleDistanceMeters;
  const windows: SplitWindow[] = [];
  let currentDistanceMeters = 0;
  let currentDurationSeconds = 0;
  let currentStartMs: number | null = null;
  let currentEndMs: number | null = null;

  const finishWindow = (distanceMeters: number) => {
    if (
      distanceMeters < MIN_DERIVED_SPLIT_METERS
      || currentStartMs == null
      || currentEndMs == null
      || currentDurationSeconds <= 0
    ) {
      return;
    }

    windows.push({
      km: windows.length + 1,
      startMs: currentStartMs,
      endMs: currentEndMs,
      distanceKm: Number((distanceMeters / 1000).toFixed(3)),
      durationSeconds: currentDurationSeconds,
    });
  };

  for (const segment of segments) {
    const segmentDistanceMeters = segment.distanceMeters * distanceScale;
    const segmentDurationMs = Math.max(0, segment.endMs - segment.startMs);
    if (segmentDistanceMeters <= 0 || segmentDurationMs <= 0) {
      continue;
    }

    let remainingDistanceMeters = segmentDistanceMeters;
    let cursorMs = segment.startMs;

    while (remainingDistanceMeters > 0.0001) {
      const neededMeters = ONE_KM_METERS - currentDistanceMeters;
      const chunkMeters = Math.min(remainingDistanceMeters, neededMeters);
      const chunkDurationMs = segmentDurationMs * (chunkMeters / segmentDistanceMeters);

      currentStartMs ??= cursorMs;
      currentDistanceMeters += chunkMeters;
      currentDurationSeconds += chunkDurationMs / 1000;
      cursorMs += chunkDurationMs;
      currentEndMs = cursorMs;
      remainingDistanceMeters -= chunkMeters;

      if (currentDistanceMeters >= ONE_KM_METERS - 0.5) {
        finishWindow(ONE_KM_METERS);
        currentDistanceMeters = 0;
        currentDurationSeconds = 0;
        currentStartMs = null;
        currentEndMs = null;
      }
    }
  }

  finishWindow(currentDistanceMeters);
  return windows;
}

function averageQuantityInWindow(
  samples: readonly HealthQuantitySample[],
  startMs: number,
  endMs: number,
): number | undefined {
  let total = 0;
  let weight = 0;

  for (const sample of samples) {
    const segment = normaliseSampleSegment(sample);
    if (!segment) {
      continue;
    }

    const durationMs = segment.endMs - segment.startMs;
    if (durationMs <= 0) {
      if (segment.startMs >= startMs && segment.startMs <= endMs) {
        total += segment.quantity;
        weight += 1;
      }
      continue;
    }

    const overlapMs = Math.min(endMs, segment.endMs) - Math.max(startMs, segment.startMs);
    if (overlapMs > 0) {
      total += segment.quantity * overlapMs;
      weight += overlapMs;
    }
  }

  return weight > 0 ? total / weight : undefined;
}

function sumQuantityInWindow(
  samples: readonly HealthQuantitySample[],
  startMs: number,
  endMs: number,
): number | undefined {
  let total = 0;
  let found = false;

  for (const sample of samples) {
    const segment = normaliseSampleSegment(sample);
    if (!segment) {
      continue;
    }

    const durationMs = segment.endMs - segment.startMs;
    if (durationMs <= 0) {
      if (segment.startMs >= startMs && segment.startMs <= endMs) {
        total += segment.quantity;
        found = true;
      }
      continue;
    }

    const overlapMs = Math.min(endMs, segment.endMs) - Math.max(startMs, segment.startMs);
    if (overlapMs > 0) {
      total += segment.quantity * (overlapMs / durationMs);
      found = true;
    }
  }

  return found ? total : undefined;
}

async function buildDetailedSplits(
  client: AppleHealthKitClient,
  workout: HealthWorkout,
  start: Date,
  end: Date,
  distanceKm: number,
) {
  const distanceSamples = await safeQuantitySamples(client, workout, DISTANCE_TYPE, 'm', start, end);
  let splitWindows = buildKilometreSplitWindows(
    distanceSegmentsFromDistanceSamples(distanceSamples),
    distanceKm,
  );
  let splitSource: string | null = splitWindows.length > 0 ? 'distance_samples' : null;

  if (splitWindows.length === 0) {
    const speedSamples = await safeQuantitySamples(client, workout, RUNNING_SPEED_TYPE, 'm/s', start, end);
    splitWindows = buildKilometreSplitWindows(
      distanceSegmentsFromSpeedSamples(speedSamples),
      distanceKm,
    );
    splitSource = splitWindows.length > 0 ? 'running_speed_samples' : null;
  }

  if (splitWindows.length === 0) {
    return { splits: null, splitSource: null };
  }

  const [heartRateSamples, stepSamples] = await Promise.all([
    safeQuantitySamples(client, workout, HEART_RATE_TYPE, 'count/min', start, end),
    safeQuantitySamples(client, workout, STEP_COUNT_TYPE, 'count', start, end),
  ]);

  const splits = splitWindows.map((window) => {
    const heartRate = roundedMetric(averageQuantityInWindow(heartRateSamples, window.startMs, window.endMs));
    const steps = sumQuantityInWindow(stepSamples, window.startMs, window.endMs);
    const cadence = steps && window.durationSeconds > 0
      ? Math.round(steps / (window.durationSeconds / 60))
      : undefined;

    return {
      km: window.km,
      distance: window.distanceKm,
      pace: Math.round(window.durationSeconds / window.distanceKm),
      hr: heartRate,
      cadence,
    };
  });

  return { splits, splitSource };
}

async function mapWorkoutToRun(
  workout: HealthWorkout,
  client: AppleHealthKitClient,
  timezone?: string,
): Promise<AppleHealthActivity | null> {
  if (!workout.uuid || !isAppleWatchOrAppleFitnessWorkout(workout)) {
    return null;
  }

  const start = toDate(workout.startDate);
  const end = toDate(workout.endDate);
  if (!start || !end) return null;

  const durationSeconds = Math.round(secondsFromQuantity(workout.duration, start, end));
  if (durationSeconds <= 0) return null;

  const distanceStat = workout.totalDistance
    ? undefined
    : await safeStatistic(workout, DISTANCE_TYPE, 'm');
  const distanceKm = distanceKmFromQuantity(workout.totalDistance)
    ?? distanceKmFromQuantity(distanceStat?.sumQuantity);
  if (!distanceKm || distanceKm <= 0) return null;

  const [heartRateStat, stepCountStat] = await Promise.all([
    safeStatistic(workout, HEART_RATE_TYPE, 'count/min'),
    safeStatistic(workout, STEP_COUNT_TYPE, 'count'),
  ]);
  const avgHR = roundedMetric(quantityValue(heartRateStat?.averageQuantity));
  const maxHR = roundedMetric(quantityValue(heartRateStat?.maximumQuantity));
  const stepCount = quantityValue(stepCountStat?.sumQuantity);
  const avgCadence = stepCount && durationSeconds > 0
    ? Math.round(stepCount / (durationSeconds / 60))
    : undefined;
  const { sourceName, sourceBundleId } = sourceForWorkout(workout);
  const sourceDevice = sourceDeviceForWorkout(workout);
  const runSubtype = runSubtypeForWorkout(workout);
  const detailedSplits = await buildDetailedSplits(client, workout, start, end, distanceKm);
  const splits = detailedSplits.splits ?? [buildSummarySplit(distanceKm, durationSeconds, avgHR, avgCadence)];

  return {
    source: 'apple_health',
    externalId: workout.uuid,
    name: workout.name,
    sourceName: sourceName ?? 'Apple Health',
    sourceBundleId,
    sourceDevice,
    startTime: start.toISOString(),
    timezone: getTimezone(timezone),
    runSubtype,
    distanceKm: Number(distanceKm.toFixed(3)),
    durationSeconds,
    movingDurationSeconds: durationSeconds,
    elapsedDurationSeconds: durationSeconds,
    avgPaceSecondsPerKm: Math.round(durationSeconds / distanceKm),
    avgHR,
    maxHR,
    avgCadence,
    splits,
    dataQuality: {
      appleWatchOrAppleFitnessSource: true,
      hasHeartRate: Boolean(avgHR),
      hasCadence: Boolean(avgCadence),
      hasLaps: Boolean(workout.events?.length),
      hasKilometreSplits: Boolean(detailedSplits.splits?.length),
      splitSource: detailedSplits.splitSource,
      routeRetained: false,
      isTreadmill: runSubtype === 'treadmill',
    },
  };
}

export async function isAppleHealthSupported(
  client?: AppleHealthKitClient,
  platformOS = Platform.OS,
): Promise<boolean> {
  if (platformOS !== 'ios') return false;

  try {
    const healthKit = client ?? await loadHealthKitClient();
    return await healthKit.isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}

export async function requestAppleHealthAuthorization(
  client?: AppleHealthKitClient,
  platformOS = Platform.OS,
): Promise<boolean> {
  if (!await isAppleHealthSupported(client, platformOS)) return false;
  const healthKit = client ?? await loadHealthKitClient();

  return healthKit.requestAuthorization({
    toRead: APPLE_HEALTH_READ_TYPES,
  });
}

export async function readAppleHealthRuns({
  since,
  until = new Date(),
  limit = 100,
  timezone,
  client,
  platformOS = Platform.OS,
}: ReadAppleHealthRunsOptions): Promise<AppleHealthActivity[]> {
  if (platformOS !== 'ios') return [];

  const healthKit = client ?? await loadHealthKitClient();
  const runningType = healthKit.WorkoutActivityType?.running ?? RUNNING_WORKOUT_ACTIVITY_TYPE;
  const workouts = await healthKit.queryWorkoutSamples({
    filter: {
      workoutActivityType: runningType,
      date: {
        startDate: since,
        endDate: until,
      },
    },
    limit,
    ascending: true,
  });

  const mapped = await Promise.all(workouts.map((workout) => mapWorkoutToRun(workout, healthKit, timezone)));
  return mapped.filter((activity): activity is AppleHealthActivity => activity != null);
}
