import type { ActivitySplit } from '@steady/types';
import type { StravaActivity } from './strava-client';

function formatSplitDistanceLabel(distanceKm: number): string {
  if (distanceKm >= 1) {
    const decimals = Number.isInteger(Number(distanceKm.toFixed(2))) ? 0 : 2;
    return `${distanceKm.toFixed(decimals)} km`;
  }

  return `${Math.round(distanceKm * 1000)}m`;
}

function isFullKmDistance(distanceKm: number): boolean {
  return distanceKm >= 0.95 && distanceKm <= 1.05;
}

function isDefaultLapName(name: string | undefined): boolean {
  if (!name) {
    return true;
  }

  const trimmed = name.trim();
  return trimmed.length === 0
    || /^(lap|split)\s*\d+$/i.test(trimmed);
}

function derivePaceSeconds(distanceMeters: number, elapsedTime: number, averageSpeed?: number): number {
  const distanceKm = distanceMeters > 0 ? distanceMeters / 1000 : 0;

  if (distanceKm > 0 && elapsedTime > 0) {
    return Math.round(elapsedTime / distanceKm);
  }

  if (averageSpeed && averageSpeed > 0) {
    return Math.round(1000 / averageSpeed);
  }

  return 0;
}

function formatLapLabel(lap: NonNullable<StravaActivity['laps']>[number], distanceKm: number): string | undefined {
  if (!isDefaultLapName(lap.name)) {
    return lap.name;
  }

  return distanceKm > 0 ? formatSplitDistanceLabel(distanceKm) : undefined;
}

function mapMetricSplit(split: NonNullable<StravaActivity['splits_metric']>[number]): ActivitySplit {
  const distanceKm = split.distance > 0 ? split.distance / 1000 : 0;
  const derivedPace = derivePaceSeconds(split.distance, split.elapsed_time, split.average_speed);

  return {
    km: split.split,
    pace: derivedPace,
    hr: split.average_heartrate,
    elevation: split.elevation_difference,
    distance: distanceKm > 0 ? Number(distanceKm.toFixed(3)) : undefined,
  };
}

function mapLap(lap: NonNullable<StravaActivity['laps']>[number]): ActivitySplit {
  const distanceKm = lap.distance > 0 ? lap.distance / 1000 : 0;
  const elapsedTime = lap.elapsed_time > 0 ? lap.elapsed_time : lap.moving_time ?? 0;
  const derivedPace = derivePaceSeconds(lap.distance, elapsedTime, lap.average_speed);

  return {
    km: lap.lap_index + 1,
    pace: derivedPace,
    hr: lap.average_heartrate,
    elevation: lap.total_elevation_gain,
    label: formatLapLabel(lap, distanceKm),
    distance: distanceKm > 0 ? Number(distanceKm.toFixed(3)) : undefined,
  };
}

function hasStructuredLaps(laps: NonNullable<StravaActivity['laps']>): boolean {
  if (laps.length < 2) {
    return false;
  }

  const lastIndex = laps.length - 1;

  return laps.some((lap, index) => {
    if (!isDefaultLapName(lap.name)) {
      return true;
    }

    const distanceKm = lap.distance > 0 ? lap.distance / 1000 : 0;
    if (distanceKm <= 0) {
      return false;
    }

    const finalPartial = index === lastIndex && distanceKm < 0.95;
    return !isFullKmDistance(distanceKm) && !finalPartial;
  });
}

export function mapStravaActivitySplits(activity: StravaActivity): ActivitySplit[] {
  const metricSplits = (activity.splits_metric ?? []).map(mapMetricSplit);
  const lapSplits = (activity.laps ?? []).map(mapLap);
  const selectedSplits = lapSplits.length > 0 && (metricSplits.length === 0 || hasStructuredLaps(activity.laps ?? []))
    ? lapSplits
    : metricSplits;

  return selectedSplits.filter((split) => split.km > 0 && split.pace > 0);
}
