import type { ActivitySplit } from '@steady/types';
import type { StravaActivity } from './strava-client';

function formatSplitDistanceLabel(distanceKm: number): string {
  if (distanceKm >= 1) {
    return `${distanceKm.toFixed(1)} km`;
  }

  return `${Math.round(distanceKm * 1000)}m`;
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
    label: distanceKm > 0 ? formatSplitDistanceLabel(distanceKm) : lap.name,
    distance: distanceKm > 0 ? Number(distanceKm.toFixed(3)) : undefined,
  };
}

export function mapStravaActivitySplits(activity: StravaActivity): ActivitySplit[] {
  const metricSplits = (activity.splits_metric ?? []).map(mapMetricSplit);
  const lapSplits = (activity.laps ?? []).map(mapLap);
  const selectedSplits = metricSplits.length > 0 ? metricSplits : lapSplits;

  return selectedSplits.filter((split) => split.km > 0 && split.pace > 0);
}
