import type { PlanWeek } from '../plan';
import type { PlannedSession } from '../session';

function findCurrentWeekIndex(weeks: PlanWeek[], today: string): number {
  for (let i = 0; i < weeks.length; i++) {
    const sessions = weeks[i].sessions.filter(Boolean) as PlannedSession[];
    if (sessions.length === 0) continue;
    const dates = sessions.map((session) => session.date);
    if (dates.some((date) => date >= today)) {
      return i;
    }
  }

  return Math.max(weeks.length - 1, 0);
}

export function getDisplayWeekIndex(
  weeks: PlanWeek[],
  today: string,
  resumeWeekNumber?: number | null,
): number {
  if (weeks.length === 0) return 0;

  if (resumeWeekNumber != null) {
    const overrideIndex = weeks.findIndex((week) => week.weekNumber === resumeWeekNumber);
    if (overrideIndex >= 0) {
      return overrideIndex;
    }
  }

  return findCurrentWeekIndex(weeks, today);
}
