import type { ComponentType } from 'react';
import type { PhaseConfig, PlannedSession, PlanWeek } from '@steady/types';

export interface PlanBuilderReviewBlockProps {
  plan: PlanWeek[];
  template: (PlannedSession | null)[];
  weeks: number;
  phases: PhaseConfig;
  raceLabel: string;
  targetTime: string;
  progressionPct: number | null;
  saving: boolean;
  onApplyProgression: (pct: number) => void;
  onEditSession: (weekIndex: number, dayIndex: number) => void;
  onSavePlan: () => void;
}

export function getSharedPlanBuilderReviewComponent():
  | ComponentType<PlanBuilderReviewBlockProps>
  | null {
  return null;
}
