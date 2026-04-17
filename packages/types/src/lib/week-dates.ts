import type { PlanWeek } from '../plan';
import type { PlannedSession } from '../session';

function currentIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function startOfWeekIso(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + mondayOffset);
  return value.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  const aTime = new Date(`${a}T00:00:00Z`).getTime();
  const bTime = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(aTime - bTime);
}

export function inferWeekStartDate(
  week: Pick<PlanWeek, 'sessions'>,
  fallbackDate = currentIsoDate(),
): string {
  const fallbackWeekStart = startOfWeekIso(fallbackDate);
  const candidateCounts = new Map<string, number>();

  week.sessions.forEach((session, index) => {
    if (!session?.date) {
      return;
    }

    const candidate = addDaysIso(session.date, -index);
    candidateCounts.set(candidate, (candidateCounts.get(candidate) ?? 0) + 1);
  });

  if (candidateCounts.size === 0) {
    return fallbackWeekStart;
  }

  return [...candidateCounts.entries()]
    .sort((a, b) => {
      const byCount = b[1] - a[1];
      if (byCount !== 0) {
        return byCount;
      }

      const byFallbackDistance = diffDays(a[0], fallbackWeekStart) - diffDays(b[0], fallbackWeekStart);
      if (byFallbackDistance !== 0) {
        return byFallbackDistance;
      }

      return a[0].localeCompare(b[0]);
    })[0][0];
}

export function assignWeekSessionDates(
  sessions: (PlannedSession | null)[],
  weekStartDate: string,
): (PlannedSession | null)[] {
  return sessions.map((session, index) => {
    if (!session) {
      return null;
    }

    const date = addDaysIso(weekStartDate, index);
    return session.date === date
      ? session
      : {
          ...session,
          date,
        };
  });
}
