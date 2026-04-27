import { defaultPhases, type PhaseConfig } from '@steady/types';
import {
  RACE_TARGETS,
  raceDateForPlanStartingThisWeek,
  todayIsoLocal,
} from '../../lib/plan-helpers';
import { parseIsoDate, weeksToRace } from './race-date';

export const PLAN_BUILDER_RACES = ['5K', '10K', 'Half Marathon', 'Marathon', 'Ultra'] as const;
export const ULTRA_PRESETS = ['50K', '100K', '100M', 'Custom'] as const;

export type PlanBuilderRace = (typeof PLAN_BUILDER_RACES)[number];
export type UltraPreset = (typeof ULTRA_PRESETS)[number];

export interface TargetTimeParts {
  hours: number;
  minutes: number;
  seconds: number;
}

export interface PlanBuilderGoalParams {
  raceDistance: string;
  raceLabel: string;
  raceName: string;
  raceDate: string;
  weeks: string;
  targetTime: string;
  phases: string;
  ultraPreset?: string;
  customUltraDistance?: string;
}

export function defaultCustomTimeForRace(race: PlanBuilderRace): TargetTimeParts {
  switch (race) {
    case '5K':
      return { hours: 0, minutes: 18, seconds: 0 };
    case '10K':
      return { hours: 0, minutes: 40, seconds: 0 };
    case 'Half Marathon':
      return { hours: 1, minutes: 30, seconds: 0 };
    case 'Ultra':
      return { hours: 13, minutes: 25, seconds: 0 };
    case 'Marathon':
    default:
      return { hours: 3, minutes: 15, seconds: 0 };
  }
}

export function formatTargetTime({ hours, minutes, seconds }: TargetTimeParts): string {
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

export function raceLabelFor(
  race: PlanBuilderRace,
  ultraPreset: UltraPreset,
  customUltraDistance: string,
): string {
  if (race !== 'Ultra') return race;

  if (ultraPreset === 'Custom') {
    const distance = customUltraDistance.trim();
    return distance ? `${distance} Ultra` : 'Ultra';
  }

  return `${ultraPreset} Ultra`;
}

export function getRaceTargets(race: PlanBuilderRace): string[] {
  return RACE_TARGETS[race] || [];
}

export function defaultTargetForRace(race: PlanBuilderRace): string {
  const targets = getRaceTargets(race);
  return targets[2] || targets[0] || '';
}

export function coerceRace(value: string | string[] | undefined): PlanBuilderRace {
  const candidate = Array.isArray(value) ? value[0] : value;
  return PLAN_BUILDER_RACES.includes(candidate as PlanBuilderRace)
    ? (candidate as PlanBuilderRace)
    : 'Marathon';
}

export function coerceUltraPreset(value: string | string[] | undefined): UltraPreset {
  const candidate = Array.isArray(value) ? value[0] : value;
  return ULTRA_PRESETS.includes(candidate as UltraPreset) ? (candidate as UltraPreset) : '100K';
}

export function defaultRaceDate(todayIso: string = todayIsoLocal()): string {
  return raceDateForPlanStartingThisWeek(todayIso, 16);
}

export function buildGoalParams({
  race,
  ultraPreset,
  customUltraDistance,
  raceName,
  raceDate,
  targetTime,
  todayIso = todayIsoLocal(),
}: {
  race: PlanBuilderRace;
  ultraPreset: UltraPreset;
  customUltraDistance: string;
  raceName: string;
  raceDate: string;
  targetTime: string;
  todayIso?: string;
}): PlanBuilderGoalParams {
  const weeks = weeksToRace(todayIso, raceDate);
  const raceLabel = raceLabelFor(race, ultraPreset, customUltraDistance);
  const raceYear = parseIsoDate(raceDate).year;
  const phases: PhaseConfig = defaultPhases(weeks);

  return {
    raceDistance: race,
    raceLabel,
    raceName: raceName.trim() || `${raceLabel} ${raceYear}`,
    raceDate,
    weeks: String(weeks),
    targetTime,
    phases: JSON.stringify(phases),
    ultraPreset,
    customUltraDistance: customUltraDistance.trim(),
  };
}
