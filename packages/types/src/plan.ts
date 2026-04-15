import type { PlannedSession } from './session';
import type { Injury } from './injury';

export interface PhaseConfig {
  BASE: number;
  BUILD: number;
  RECOVERY: number;
  PEAK: number;
  TAPER: number;
}

export type PhaseName = keyof PhaseConfig;

export interface SwapLogEntry {
  from: number;
  to: number;
}

export interface PlanWeek {
  weekNumber: number; // 1-indexed
  phase: PhaseName;
  sessions: (PlannedSession | null)[]; // 7 elements, Mon–Sun
  plannedKm: number; // calculated from sessions
  swapLog?: SwapLogEntry[];
}

export interface TrainingPlan {
  id: string;
  userId: string;
  createdAt: string;

  // Goal
  raceName: string;
  raceDate: string; // ISO date
  raceDistance: '5K' | '10K' | 'Half Marathon' | 'Marathon' | 'Ultra';
  targetTime: string; // e.g. 'sub-3:30'

  // Phase structure
  phases: PhaseConfig;

  // Progression
  progressionPct: number; // 0 = flat, 7 = +7% every 2 weeks

  // Template week (7 elements, index 0 = Monday)
  templateWeek: (PlannedSession | null)[];

  // Generated weeks
  weeks: PlanWeek[];

  // Recovery & injury
  activeInjury: Injury | null;
}

export interface TrainingPlanWithAnnotation extends TrainingPlan {
  coachAnnotation: string;
}
