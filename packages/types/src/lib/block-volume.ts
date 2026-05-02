import type { Activity } from '../activity';
import type { PlanWeek } from '../plan';
import { weekKmBreakdown } from './session-km';

export type BlockVolumeTone = 'past' | 'current' | 'future';

export interface WeekVolumeSummary {
  plannedKm: number;
  plannedExactKm: number;
  plannedEstimatedKm: number;
  hasEstimatedPlannedKm: boolean;
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
  const plannedVolume = weekKmBreakdown(week);
  const plannedKm = plannedVolume.totalKm;

  if (tone === 'future') {
    return {
      plannedKm,
      plannedExactKm: plannedVolume.exactKm,
      plannedEstimatedKm: plannedVolume.estimatedKm,
      hasEstimatedPlannedKm: plannedVolume.hasEstimatedKm,
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
      plannedExactKm: plannedVolume.exactKm,
      plannedEstimatedKm: plannedVolume.estimatedKm,
      hasEstimatedPlannedKm: plannedVolume.hasEstimatedKm,
      actualKm: null,
      showActual: false,
      barKm: plannedKm,
    };
  }

  const actualKm = Number(actualDistances.reduce((sum, distance) => sum + distance, 0).toFixed(1));
  return {
    plannedKm,
    plannedExactKm: plannedVolume.exactKm,
    plannedEstimatedKm: plannedVolume.estimatedKm,
    hasEstimatedPlannedKm: plannedVolume.hasEstimatedKm,
    actualKm,
    showActual: true,
    barKm: actualKm,
  };
}
