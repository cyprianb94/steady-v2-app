import type { PlanWeek, PlannedSession, TrainingPlan } from '@steady/types';

interface ApplyActivityMatchResult {
  weeks: PlanWeek[];
  foundSession: boolean;
  conflictingSession: PlannedSession | null;
}

export function applyActivityMatchToWeeks(
  weeks: PlanWeek[],
  activityId: string,
  sessionId: string | null,
): ApplyActivityMatchResult {
  let foundSession = sessionId == null;
  let conflictingSession: PlannedSession | null = null;

  const nextWeeks = weeks.map((week) => ({
    ...week,
    sessions: week.sessions.map((session) => {
      if (!session) return session;

      if (session.actualActivityId === activityId && session.id !== sessionId) {
        return { ...session, actualActivityId: undefined };
      }

      if (session.id !== sessionId) {
        return session;
      }

      foundSession = true;
      if (session.actualActivityId && session.actualActivityId !== activityId) {
        conflictingSession = session;
        return session;
      }

      return {
        ...session,
        actualActivityId: activityId,
      };
    }),
  }));

  return {
    weeks: nextWeeks,
    foundSession,
    conflictingSession,
  };
}

export function applyActivityMatchToPlan(
  plan: TrainingPlan,
  activityId: string,
  sessionId: string | null,
): ApplyActivityMatchResult & { plan: TrainingPlan } {
  const result = applyActivityMatchToWeeks(plan.weeks, activityId, sessionId);
  return {
    ...result,
    plan: {
      ...plan,
      weeks: result.weeks,
    },
  };
}
