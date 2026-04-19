import {
  addDaysIso,
  assignWeekSessionDates,
  inferWeekStartDate,
  startOfWeekIso,
  type PlanWeek,
} from '@steady/types';

export function buildDisplayWeek(week: PlanWeek, weekStartDate: string): PlanWeek {
  return {
    ...week,
    sessions: assignWeekSessionDates(week.sessions, weekStartDate),
  };
}

function dayIndexForIsoDate(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

function hasCohesiveScheduledWeek(week: PlanWeek, inferredWeekStartDate: string): boolean {
  const datedSessions = week.sessions.flatMap((session, index) => (
    session?.date ? [{ index, date: session.date }] : []
  ));

  if (datedSessions.length < 4) {
    return false;
  }

  return datedSessions.every(({ index, date }) => date === addDaysIso(inferredWeekStartDate, index));
}

export function resolveDisplayWeekStartDate(week: PlanWeek, today: string): string {
  const inferred = inferWeekStartDate(week, today);
  if (hasCohesiveScheduledWeek(week, inferred)) {
    return inferred;
  }

  const slotResolvedTodaySession = week.sessions[dayIndexForIsoDate(today)] ?? null;
  const exactTodaySession = week.sessions.find((session) => session?.date === today) ?? null;

  if (
    slotResolvedTodaySession
    && !exactTodaySession
    && slotResolvedTodaySession.date !== today
  ) {
    return startOfWeekIso(today);
  }

  return inferred;
}

export function buildCurrentDisplayWeek(week: PlanWeek, today: string): PlanWeek {
  return buildDisplayWeek(week, resolveDisplayWeekStartDate(week, today));
}
