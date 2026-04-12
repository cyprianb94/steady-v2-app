import type { PlanWeek } from '../plan';

/**
 * Normalizes all session IDs in a plan to be deterministic and unique per slot.
 * Format: `w{weekNumber}d{dayIndex}` — e.g. "w1d0", "w3d4".
 *
 * Call this after generatePlan / assignDates so duplicate template IDs
 * can never cause duplicate-key warnings in the app.
 */
export function normalizeSessionIds(weeks: PlanWeek[]): PlanWeek[] {
  return weeks.map((week) => ({
    ...week,
    sessions: week.sessions.map((session, dayIndex) => {
      if (!session) return null;
      return { ...session, id: `w${week.weekNumber}d${dayIndex}` };
    }),
  }));
}
