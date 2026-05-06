import type {
  PhaseConfig,
  PhaseName,
  PlannedSession,
  PlanWeek,
  PropagateScope,
  SkippedSessionReason,
  SwapLogEntry,
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

export interface PropagatePlanChangeInput {
  weekIndex: number;
  dayIndex: number;
  updated: PlannedSession | null;
  scope: PropagateScope;
  targetPhase?: PhaseName;
}

export interface ApplyBlockRescheduleInput {
  weekIndex: number;
  swapLog: SwapLogEntry[];
  scope: PropagateScope;
  targetPhase?: PhaseName;
  targetSessions: (PlannedSession | null)[];
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

/**
 * Transitional whole-plan replacement bridge.
 * This remains for legacy plan-builder/generated-plan paths that still prepare
 * a complete week array before save. Live Block mutations should call the
 * server-owned intention APIs below instead of submitting authoritative weeks.
 */
export async function updatePlanWeeks(weeks: PlanWeek[]): Promise<TrainingPlan | null> {
  if (isScreenshotDemoMode()) {
    return getScreenshotDemoPlan();
  }

  return trpc.plan.updateWeeks.mutate({ weeks });
}

export async function propagatePlanChange(
  input: PropagatePlanChangeInput,
): Promise<TrainingPlan | null> {
  if (isScreenshotDemoMode()) {
    return getScreenshotDemoPlan();
  }

  return trpc.plan.propagate.mutate(input);
}

export async function applyBlockReschedule(
  input: ApplyBlockRescheduleInput,
): Promise<TrainingPlan | null> {
  if (isScreenshotDemoMode()) {
    return getScreenshotDemoPlan();
  }

  return trpc.plan.rescheduleBlockWeek.mutate(input);
}

export async function markPlannedSessionSkipped({
  sessionId,
  reason,
}: {
  sessionId: string;
  reason: SkippedSessionReason;
}): Promise<TrainingPlan | null> {
  if (isScreenshotDemoMode()) {
    return getScreenshotDemoPlan();
  }

  return trpc.plan.markSessionSkipped.mutate({
    sessionId,
    reason,
  });
}

export async function clearPlannedSessionSkipped({
  sessionId,
}: {
  sessionId: string;
}): Promise<TrainingPlan | null> {
  if (isScreenshotDemoMode()) {
    return getScreenshotDemoPlan();
  }

  return trpc.plan.clearSessionSkipped.mutate({ sessionId });
}
