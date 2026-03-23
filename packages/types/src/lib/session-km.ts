import type { PlannedSession, RecoveryDuration } from '../session';
import { RECOVERY_KM } from '../session';

/**
 * Calculates total km for a session including warmup, cooldown, and recovery jogs.
 *
 * This is the canonical volume calculator — used everywhere km counts appear:
 * plan display, load bars, week totals, progression calculations.
 */
export function sessionKm(session: PlannedSession | null): number {
  if (!session || session.type === 'REST') return 0;

  const warmup = session.warmup ? Number(session.warmup) : 0;
  const cooldown = session.cooldown ? Number(session.cooldown) : 0;
  const recoveryJogKm = session.recovery
    ? (RECOVERY_KM[session.recovery as RecoveryDuration] ?? 0) * (session.reps ?? 1)
    : 0;

  if (session.type === 'INTERVAL' && session.reps && session.repDist) {
    return Math.round(
      (session.reps * session.repDist / 1000 + recoveryJogKm + warmup + cooldown) * 10
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
  if (session.type === 'INTERVAL' && session.reps && session.repDist) {
    return session.reps * session.repDist / 1000 + (session.warmup ?? 0) + (session.cooldown ?? 0);
  }
  return (session.distance ?? 8) + (session.warmup ?? 0) + (session.cooldown ?? 0);
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
