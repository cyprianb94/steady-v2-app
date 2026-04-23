import type { TrainingPlan, PlanWeek } from '../plan';
import { normalizeSessionDuration, type PlannedSession } from '../session';

export function normalizeSessionDurations(
  session: PlannedSession | null,
): PlannedSession | null {
  if (!session) {
    return null;
  }

  return {
    ...session,
    warmup: normalizeSessionDuration(session.warmup),
    cooldown: normalizeSessionDuration(session.cooldown),
  };
}

export function normalizePlanWeekSessionDurations(week: PlanWeek): PlanWeek {
  return {
    ...week,
    sessions: week.sessions.map(normalizeSessionDurations),
  };
}

export function normalizeTrainingPlanSessionDurations(plan: TrainingPlan): TrainingPlan {
  return {
    ...plan,
    templateWeek: plan.templateWeek.map(normalizeSessionDurations),
    weeks: plan.weeks.map(normalizePlanWeekSessionDurations),
  };
}
