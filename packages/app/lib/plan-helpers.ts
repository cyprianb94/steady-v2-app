import {
  addDaysIso,
  inferWeekStartDate,
  sessionKm,
  startOfWeekIso,
  weekKm,
  type PlannedSession,
  type SessionType,
  type PlanWeek,
} from '@steady/types';
import { formatDistance, formatStoredPace, type DistanceUnits } from './units';

// Re-export shared functions from types so existing app imports keep working
export {
  addDaysIso,
  inferWeekStartDate,
  sessionKm,
  startOfWeekIso,
  weekKm,
} from '@steady/types';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const REP_DISTS = [200, 400, 600, 800, 1000, 1200, 1600] as const;

export const RECOVERY_OPTS = ['45s', '60s', '90s', '2min', '3min', '4min', '5min'] as const;

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
  INTERVAL: {
    type: 'INTERVAL',
    reps: 6,
    repDist: 800,
    pace: '3:50',
    recovery: '90s',
    warmup: { unit: 'km', value: 1.5 },
    cooldown: { unit: 'km', value: 1 },
  },
  TEMPO: {
    type: 'TEMPO',
    distance: 10,
    pace: '4:20',
    warmup: { unit: 'km', value: 2 },
    cooldown: { unit: 'km', value: 1.5 },
  },
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

export function isoDateLocal(value: Date): string {
  const timezoneOffsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export function sessionLabel(
  s: Partial<PlannedSession> | null,
  units: DistanceUnits = 'metric',
): string {
  if (!s || s.type === 'REST') return 'Rest';
  if (s.type === 'INTERVAL') {
    return `${s.reps ?? 6}×${s.repDist ?? 800}m @ ${formatStoredPace(s.pace, units)}`;
  }
  const distanceLabel = s.distance != null ? formatDistance(s.distance, units) : '?';
  return `${distanceLabel} @ ${formatStoredPace(s.pace, units)}`;
}

export function todayIsoLocal(now: Date = new Date()): string {
  return isoDateLocal(now);
}

export function activityLocalDate(startTime: string): string {
  const value = new Date(startTime);
  if (Number.isNaN(value.getTime())) {
    return startTime.slice(0, 10);
  }
  return isoDateLocal(value);
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
