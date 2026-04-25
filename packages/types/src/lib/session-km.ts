import type { IntervalRecovery, PlannedSession, RecoveryDuration, SessionDurationSpec } from '../session';
import { RECOVERY_KM, RECOVERY_KM_PER_MIN, sessionDurationKm, sessionSupportsWarmupCooldown } from '../session';

function paceToSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function durationKm(value: SessionDurationSpec | null | undefined, pace: string | null | undefined): number {
  if (!value || value.value <= 0) return 0;
  if (value.unit === 'km') return value.value;

  const paceSeconds = paceToSeconds(pace);
  if (!paceSeconds) return 0;
  return value.value / (paceSeconds / 60);
}

function intervalRepKm(session: PlannedSession): number {
  const fromDuration = durationKm(session.repDuration, session.pace);
  if (fromDuration > 0) return fromDuration;
  return session.repDist ? session.repDist / 1000 : 0;
}

function recoveryKm(value: IntervalRecovery | null | undefined): number {
  if (!value) return 0;
  if (typeof value === 'string') return RECOVERY_KM[value as RecoveryDuration] ?? 0;
  if (value.unit === 'km') return value.value;
  return value.value * RECOVERY_KM_PER_MIN;
}

/**
 * Calculates total km for a session including workout bookends and recovery jogs.
 *
 * This is the canonical volume calculator — used everywhere km counts appear:
 * plan display, load bars, week totals, progression calculations.
 */
export function sessionKm(session: PlannedSession | null): number {
  if (!session || session.type === 'REST') return 0;

  const usesBookends = sessionSupportsWarmupCooldown(session.type);
  const warmup = usesBookends ? sessionDurationKm(session.warmup) : 0;
  const cooldown = usesBookends ? sessionDurationKm(session.cooldown) : 0;
  const recoveryJogKm = recoveryKm(session.recovery) * (session.reps ?? 1);

  if (session.type === 'INTERVAL' && session.reps && (session.repDist || session.repDuration)) {
    return Math.round(
      (session.reps * intervalRepKm(session) + recoveryJogKm + warmup + cooldown) * 10
    ) / 10;
  }

  if (session.distance) {
    return session.distance + warmup + cooldown;
  }

  return 8; // fallback for malformed sessions
}

/**
 * Expected distance for a planned session (for matching/comparison).
 */
export function expectedDistance(session: PlannedSession): number {
  const usesBookends = sessionSupportsWarmupCooldown(session.type);
  const warmup = usesBookends ? sessionDurationKm(session.warmup) : 0;
  const cooldown = usesBookends ? sessionDurationKm(session.cooldown) : 0;

  if (session.type === 'INTERVAL' && session.reps && (session.repDist || session.repDuration)) {
    return session.reps * intervalRepKm(session) + warmup + cooldown;
  }
  return (session.distance ?? 8) + warmup + cooldown;
}

import type { PlanWeek } from '../plan';

/**
 * Total planned km for a week.
 * Accepts either a PlanWeek or a raw sessions array.
 */
export function weekKm(weekOrSessions: PlanWeek | (PlannedSession | null)[]): number {
  const sessions = Array.isArray(weekOrSessions)
    ? weekOrSessions
    : weekOrSessions.sessions;
  return Math.round(
    sessions.reduce((sum, s) => sum + sessionKm(s), 0) * 10,
  ) / 10;
}
