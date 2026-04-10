import type { Activity } from '../activity';
import type { PlanWeek } from '../plan';

export type BlockVolumeTone = 'past' | 'current' | 'future';

export interface WeekVolumeSummary {
  plannedKm: number;
  actualKm: number | null;
  showActual: boolean;
  barKm: number;
}

export function getWeekVolumeRatio(weekVolume: number, peakVolume: number): number {
  if (peakVolume <= 0 || weekVolume <= 0) return 0;
  return Math.min(weekVolume / peakVolume, 1);
}

export function getBlockVolumeTone(
  weekIndex: number,
  currentWeekIndex: number,
): BlockVolumeTone {
  if (weekIndex < currentWeekIndex) return 'past';
  if (weekIndex > currentWeekIndex) return 'future';
  return 'current';
}

export function getWeekVolumeSummary(
  week: PlanWeek,
  activitiesById: Map<string, Activity>,
  tone: BlockVolumeTone,
): WeekVolumeSummary {
  const plannedKm = week.plannedKm;

  if (tone === 'future') {
    return {
      plannedKm,
      actualKm: null,
      showActual: false,
      barKm: plannedKm,
    };
  }

  const actualDistances = week.sessions
    .map((session) => session?.actualActivityId)
    .filter((activityId): activityId is string => Boolean(activityId))
    .map((activityId) => activitiesById.get(activityId))
    .filter((activity): activity is Activity => Boolean(activity))
    .map((activity) => activity.distance);

  if (actualDistances.length === 0) {
    return {
      plannedKm,
      actualKm: null,
      showActual: false,
      barKm: plannedKm,
    };
  }

  const actualKm = Number(actualDistances.reduce((sum, distance) => sum + distance, 0).toFixed(1));
  return {
    plannedKm,
    actualKm,
    showActual: true,
    barKm: actualKm,
  };
}
