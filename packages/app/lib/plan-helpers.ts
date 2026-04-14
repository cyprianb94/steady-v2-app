import type { PlannedSession, SessionType, PlanWeek } from '@steady/types';

// Re-export shared functions from types so existing app imports keep working
export { sessionKm, weekKm } from '@steady/types';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const REP_DISTS = [200, 400, 600, 800, 1000, 1200, 1600] as const;

export const RECOVERY_OPTS = ['45s', '60s', '90s', '2min', '3min', '4min', '5min'] as const;

export const WU_LIST = ['0', '0.5', '1', '1.5', '2', '2.5', '3'] as const;

// Distance options: 3–42km
export const KM_LIST = Array.from({ length: 40 }, (_, i) => String(i + 3));

// Pace options: 3:00 to 8:00 in 5-second increments
export const ALL_PACES: string[] = [];
for (let m = 3; m <= 8; m++) {
  for (let s = 0; s < 60; s += 5) {
    ALL_PACES.push(`${m}:${String(s).padStart(2, '0')}`);
  }
}

export const TYPE_DEFAULTS: Record<SessionType, Partial<PlannedSession> & { type: SessionType }> = {
  EASY: { type: 'EASY', distance: 8, pace: '5:20' },
  INTERVAL: { type: 'INTERVAL', reps: 6, repDist: 800, pace: '3:50', recovery: '90s', warmup: 1.5, cooldown: 1 },
  TEMPO: { type: 'TEMPO', distance: 10, pace: '4:20', warmup: 2, cooldown: 1.5 },
  LONG: { type: 'LONG', distance: 16, pace: '5:10' },
  REST: { type: 'REST' },
};

export const RACE_TARGETS: Record<string, string[]> = {
  '5K': ['sub-18', 'sub-20', 'sub-22', 'sub-25', 'sub-28', 'sub-30'],
  '10K': ['sub-38', 'sub-40', 'sub-45', 'sub-50', 'sub-55', 'sub-60'],
  'Half Marathon': ['sub-1:25', 'sub-1:30', 'sub-1:40', 'sub-1:45', 'sub-1:50', 'sub-2:00'],
  'Marathon': ['sub-2:45', 'sub-3:00', 'sub-3:15', 'sub-3:30', 'sub-3:45', 'sub-4:00'],
  Ultra: ['sub-10h', 'sub-12h', 'sub-15h', 'sub-20h'],
};

export function sessionLabel(s: Partial<PlannedSession> | null): string {
  if (!s || s.type === 'REST') return 'Rest';
  if (s.type === 'INTERVAL') {
    return `${s.reps ?? 6}×${s.repDist ?? 800}m @ ${s.pace ?? '—'}`;
  }
  return `${s.distance ?? '?'}km @ ${s.pace ?? '—'}`;
}

export function addDaysIso(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function todayIsoLocal(now: Date = new Date()): string {
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export function startOfWeekIso(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  const day = value.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + mondayOffset);
  return value.toISOString().slice(0, 10);
}

export function dayIndexForIsoDate(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

export function raceDateForPlanStartingThisWeek(today: string, totalWeeks: number): string {
  const weekStart = startOfWeekIso(today);
  return addDaysIso(weekStart, totalWeeks * 7 - 1);
}

export function findSessionForDateOrWeekday(
  sessions: (PlannedSession | null)[],
  date: string,
): PlannedSession | null {
  return sessions[dayIndexForIsoDate(date)] ?? null;
}

export function getRemainingWeekStartIndex(
  sessions: (PlannedSession | null)[],
  date: string,
): number {
  const exactIndex = sessions.findIndex((session) => session?.date === date);
  return (exactIndex >= 0 ? exactIndex : dayIndexForIsoDate(date)) + 1;
}

export function inferWeekStartDate(week: PlanWeek, fallbackDate = todayIsoLocal()): string {
  for (let i = 0; i < week.sessions.length; i++) {
    const session = week.sessions[i];
    if (session?.date) {
      return addDaysIso(session.date, -i);
    }
  }

  return startOfWeekIso(fallbackDate);
}
