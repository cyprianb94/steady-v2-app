import type { Activity } from '../activity';
import type {
  IntervalRecovery,
  PlannedSession,
  RecoveryDuration,
  SessionDurationSpec,
  SessionType,
} from '../session';
import type { WeeklyVolumeMetric } from '../user';
import { representativeSessionPaceSeconds } from './intensity-targets';
import { sessionKm } from './session-km';
import { addDaysIso } from './week-dates';

export type WeeklyVolumeDayStatus =
  | 'rest'
  | 'upcoming'
  | 'planned'
  | 'completed'
  | 'over'
  | 'missed'
  | 'varied';

export interface WeeklyVolumeDay {
  dayIndex: number;
  date: string;
  sessionId?: string;
  plannedDistanceKm: number;
  actualDistanceKm: number;
  plannedSeconds: number;
  actualSeconds: number;
  plannedType: SessionType;
  actualType?: SessionType;
  status: WeeklyVolumeDayStatus;
}

export interface WeeklyVolumeSummary {
  plannedDistanceKm: number;
  actualDistanceKm: number;
  plannedSeconds: number;
  actualSeconds: number;
  days: WeeklyVolumeDay[];
}

export interface WeeklyVolumeMetricValues {
  planned: number;
  actual: number;
  over: number;
}

export interface BuildWeeklyVolumeSummaryInput {
  sessions: readonly (PlannedSession | null)[];
  activities?: readonly Activity[];
  today: string;
  weekStartDate?: string;
}

const FALLBACK_PACE_SECONDS: Record<SessionType, number> = {
  EASY: 330,
  INTERVAL: 240,
  TEMPO: 270,
  LONG: 330,
  REST: 0,
};

const RECOVERY_SECONDS: Record<RecoveryDuration, number> = {
  '45s': 45,
  '60s': 60,
  '90s': 90,
  '2min': 120,
  '3min': 180,
  '4min': 240,
  '5min': 300,
};

function roundDistance(value: number): number {
  return Math.round(value * 10) / 10;
}

function paceSecondsFor(session: PlannedSession): number {
  return representativeSessionPaceSeconds(session) ?? FALLBACK_PACE_SECONDS[session.type];
}

function durationSpecSeconds(
  value: SessionDurationSpec | number | null | undefined,
  paceSeconds: number,
): number {
  if (value == null) return 0;

  if (typeof value === 'number') {
    return value > 0 ? value * paceSeconds : 0;
  }

  if (!Number.isFinite(value.value) || value.value <= 0) {
    return 0;
  }

  return value.unit === 'min'
    ? value.value * 60
    : value.value * paceSeconds;
}

function intervalRepDistanceKm(session: PlannedSession): number {
  if (session.repDuration?.unit === 'km') {
    return session.repDuration.value;
  }

  if (session.repDist && session.repDist > 0) {
    return session.repDist / 1000;
  }

  return 0;
}

function intervalRepSeconds(session: PlannedSession, paceSeconds: number): number {
  if (session.repDuration?.unit === 'min') {
    return session.repDuration.value * 60;
  }

  return intervalRepDistanceKm(session) * paceSeconds;
}

function recoverySeconds(value: IntervalRecovery | null | undefined, paceSeconds: number): number {
  if (!value) return 0;
  if (typeof value === 'string') return RECOVERY_SECONDS[value as RecoveryDuration] ?? 0;
  return durationSpecSeconds(value, paceSeconds);
}

function plannedSessionSeconds(session: PlannedSession | null): number {
  if (!session || session.type === 'REST') return 0;

  const paceSeconds = paceSecondsFor(session);
  const easyPaceSeconds = FALLBACK_PACE_SECONDS.EASY;
  const warmup = durationSpecSeconds(session.warmup, easyPaceSeconds);
  const cooldown = durationSpecSeconds(session.cooldown, easyPaceSeconds);

  if (session.type === 'INTERVAL') {
    const reps = session.reps ?? 1;
    return Math.round(
      (reps * intervalRepSeconds(session, paceSeconds))
      + (reps * recoverySeconds(session.recovery, easyPaceSeconds))
      + warmup
      + cooldown,
    );
  }

  if (session.type === 'TEMPO') {
    return Math.round(((session.distance ?? 0) * paceSeconds) + warmup + cooldown);
  }

  return Math.round((session.distance ?? 0) * paceSeconds);
}

function isoDateLocal(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function activityDate(activity: Activity): string {
  const value = new Date(activity.startTime);
  return Number.isNaN(value.getTime())
    ? activity.startTime.slice(0, 10)
    : isoDateLocal(value);
}

function isActivityCompatibleWithSession(session: PlannedSession, activity: Activity): boolean {
  return activityDate(activity) === session.date;
}

function activityMaps(activities: readonly Activity[]) {
  return {
    byId: new Map(activities.map((activity) => [activity.id, activity] as const)),
    byMatchedSessionId: new Map(
      activities
        .filter((activity) => Boolean(activity.matchedSessionId))
        .map((activity) => [activity.matchedSessionId!, activity] as const),
    ),
  };
}

function activityForSession(
  session: PlannedSession,
  maps: ReturnType<typeof activityMaps>,
): Activity | undefined {
  if (session.actualActivityId) {
    const linkedActivity = maps.byId.get(session.actualActivityId);
    if (linkedActivity && isActivityCompatibleWithSession(session, linkedActivity)) {
      return linkedActivity;
    }
  }

  const matchedActivity = maps.byMatchedSessionId.get(session.id);
  if (matchedActivity && isActivityCompatibleWithSession(session, matchedActivity)) {
    return matchedActivity;
  }

  return undefined;
}

function isFutureSession(session: PlannedSession, today: string): boolean {
  return session.date > today;
}

function dayStatus({
  session,
  actualDistanceKm,
  actualSeconds,
  plannedDistanceKm,
  plannedSeconds,
  today,
}: {
  session: PlannedSession | null;
  actualDistanceKm: number;
  actualSeconds: number;
  plannedDistanceKm: number;
  plannedSeconds: number;
  today: string;
}): WeeklyVolumeDayStatus {
  if (!session || session.type === 'REST') {
    return 'rest';
  }

  if (actualDistanceKm > 0 || actualSeconds > 0) {
    if (
      (plannedDistanceKm > 0 && actualDistanceKm > plannedDistanceKm)
      || (plannedSeconds > 0 && actualSeconds > plannedSeconds)
    ) {
      return 'over';
    }

    return 'completed';
  }

  if (session.date < today) {
    return 'missed';
  }

  return session.date === today ? 'planned' : 'upcoming';
}

function normalizeSessionDate(
  session: PlannedSession | null,
  dayIndex: number,
  weekStartDate?: string,
): { session: PlannedSession | null; date: string } {
  const date = weekStartDate ? addDaysIso(weekStartDate, dayIndex) : (session?.date ?? '');
  if (!session || session.date === date) {
    return { session, date };
  }

  return {
    session: {
      ...session,
      date,
    },
    date,
  };
}

export function buildWeeklyVolumeSummary({
  sessions,
  activities = [],
  today,
  weekStartDate,
}: BuildWeeklyVolumeSummaryInput): WeeklyVolumeSummary {
  const maps = activityMaps(activities);
  let plannedDistanceTotalKm = 0;
  let actualDistanceTotalKm = 0;
  const days = Array.from({ length: 7 }, (_, dayIndex): WeeklyVolumeDay => {
    const normalized = normalizeSessionDate(sessions[dayIndex] ?? null, dayIndex, weekStartDate);
    const session = normalized.session;
    const plannedDistanceExactKm = sessionKm(session);
    const plannedDistanceKm = roundDistance(plannedDistanceExactKm);
    const plannedSeconds = plannedSessionSeconds(session);
    const activity = session ? activityForSession(session, maps) : undefined;
    const hasPastLinkedActivityPendingSnapshot = Boolean(
      session?.actualActivityId
      && !activity
      && !maps.byId.has(session.actualActivityId)
      && !isFutureSession(session, today),
    );
    const actualDistanceExactKm = activity
      ? activity.distance
      : hasPastLinkedActivityPendingSnapshot
        ? plannedDistanceExactKm
        : 0;
    const actualSeconds = activity
      ? activity.duration
      : hasPastLinkedActivityPendingSnapshot
        ? plannedSeconds
        : 0;
    plannedDistanceTotalKm += plannedDistanceExactKm;
    actualDistanceTotalKm += actualDistanceExactKm;

    return {
      dayIndex,
      date: normalized.date,
      sessionId: session?.id,
      plannedDistanceKm,
      actualDistanceKm: roundDistance(actualDistanceExactKm),
      plannedSeconds,
      actualSeconds: Math.round(actualSeconds),
      plannedType: session?.type ?? 'REST',
      actualType: actualDistanceExactKm > 0 || actualSeconds > 0 ? session?.type : undefined,
      status: dayStatus({
        session,
        actualDistanceKm: actualDistanceExactKm,
        actualSeconds,
        plannedDistanceKm,
        plannedSeconds,
        today,
      }),
    };
  });

  return {
    plannedDistanceKm: roundDistance(plannedDistanceTotalKm),
    actualDistanceKm: roundDistance(actualDistanceTotalKm),
    plannedSeconds: days.reduce((sum, day) => sum + day.plannedSeconds, 0),
    actualSeconds: days.reduce((sum, day) => sum + day.actualSeconds, 0),
    days,
  };
}

export function getWeeklyVolumeDayMetric(
  day: WeeklyVolumeDay,
  metric: WeeklyVolumeMetric,
): WeeklyVolumeMetricValues {
  const planned = metric === 'distance' ? day.plannedDistanceKm : day.plannedSeconds;
  const actual = metric === 'distance' ? day.actualDistanceKm : day.actualSeconds;
  const over = Math.max(0, actual - planned);

  return {
    planned,
    actual,
    over: metric === 'distance' ? roundDistance(over) : Math.round(over),
  };
}
