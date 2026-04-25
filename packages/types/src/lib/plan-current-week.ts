import type { PlanWeek } from '../plan';
import { addDaysIso, inferWeekStartDate } from './week-dates';

function hasDatedSession(week: PlanWeek): boolean {
  return week.sessions.some((session) => Boolean(session?.date));
}

function findCurrentWeekIndex(weeks: PlanWeek[], today: string): number {
  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];
    if (!hasDatedSession(week)) continue;

    const weekStart = inferWeekStartDate(week, today);
    const weekEnd = addDaysIso(weekStart, 6);
    if (today <= weekEnd) {
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
