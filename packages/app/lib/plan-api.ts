import type {
  PhaseConfig,
  PlannedSession,
  PlanWeek,
  TrainingPaceProfile,
  TrainingPlan,
  TrainingPlanWithAnnotation,
} from '@steady/types';
import { normalizeTrainingPaceProfile } from '@steady/types';
import { trpc } from './trpc';
import {
  getScreenshotDemoPlan,
  isScreenshotDemoMode,
} from '../demo/screenshot-demo';

export interface SavePlanInput {
  raceName: string;
  raceDate: string;
  raceDistance: TrainingPlan['raceDistance'];
  targetTime: string;
  phases: PhaseConfig;
  progressionPct: number;
  progressionEveryWeeks?: number;
  trainingPaceProfile?: TrainingPaceProfile | null;
  templateWeek: (PlannedSession | null)[];
  weeks: PlanWeek[];
}

export async function getPlan(): Promise<TrainingPlanWithAnnotation | null> {
  if (isScreenshotDemoMode()) {
    return getScreenshotDemoPlan();
  }

  return trpc.plan.get.query();
}

export async function savePlan(input: SavePlanInput): Promise<TrainingPlan> {
  if (isScreenshotDemoMode()) {
    return getScreenshotDemoPlan();
  }

  return trpc.plan.save.mutate(input);
}

export async function getTrainingPaceProfile(): Promise<TrainingPaceProfile | null> {
  if (isScreenshotDemoMode()) {
    const demoPlan = await getScreenshotDemoPlan();
    return normalizeTrainingPaceProfile(demoPlan.trainingPaceProfile);
  }

  return trpc.plan.getTrainingPaceProfile.query();
}

export async function saveTrainingPaceProfile(
  trainingPaceProfile: TrainingPaceProfile | null,
): Promise<TrainingPaceProfile | null> {
  const normalizedProfile = normalizeTrainingPaceProfile(trainingPaceProfile);

  if (isScreenshotDemoMode()) {
    return normalizedProfile;
  }

  return trpc.plan.updateTrainingPaceProfile.mutate({
    trainingPaceProfile: normalizedProfile,
  });
}

export async function updatePlanWeeks(weeks: PlanWeek[]): Promise<TrainingPlan | null> {
  if (isScreenshotDemoMode()) {
    return getScreenshotDemoPlan();
  }

  return trpc.plan.updateWeeks.mutate({ weeks });
}
