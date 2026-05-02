import type { IntervalRecovery, PlannedSession, RecoveryDuration, SessionDurationSpec } from '../session';
import { RECOVERY_KM, RECOVERY_KM_PER_MIN, sessionDurationKm, sessionSupportsWarmupCooldown } from '../session';
import { representativeSessionPaceSeconds } from './intensity-targets';
import { structuredSessionVolume, totalStructuredSessionKm } from './structured-session';

export interface SessionKmBreakdown {
  exactKm: number;
  estimatedKm: number;
  totalKm: number;
  hasEstimatedKm: boolean;
}

export interface WeekKmBreakdown extends SessionKmBreakdown {}

function roundKm(value: number): number {
  return Math.round(value * 10) / 10;
}

function durationKm(value: SessionDurationSpec | null | undefined, paceSeconds: number | null): number {
  if (!value || value.value <= 0) return 0;
  if (value.unit === 'km') return value.value;

  if (!paceSeconds) return 0;
  return value.value / (paceSeconds / 60);
}

function intervalRepKm(session: PlannedSession): number {
  const fromDuration = durationKm(session.repDuration, representativeSessionPaceSeconds(session));
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

  if (session.plannedVolume || session.runStructure) {
    return totalStructuredSessionKm(session);
  }

  const usesBookends = sessionSupportsWarmupCooldown(session.type);
  const warmup = usesBookends ? sessionDurationKm(session.warmup) : 0;
  const cooldown = usesBookends ? sessionDurationKm(session.cooldown) : 0;
  const recoveryJogKm = recoveryKm(session.recovery) * (session.reps ?? 1);

  if (session.type === 'INTERVAL' && session.reps && (session.repDist || session.repDuration)) {
    return roundKm(session.reps * intervalRepKm(session) + recoveryJogKm + warmup + cooldown);
  }

  if (session.distance) {
    return session.distance + warmup + cooldown;
  }

  return 8; // fallback for malformed sessions
}

export function sessionKmBreakdown(session: PlannedSession | null): SessionKmBreakdown {
  if (!session || session.type === 'REST') {
    return { exactKm: 0, estimatedKm: 0, totalKm: 0, hasEstimatedKm: false };
  }

  const volume = structuredSessionVolume(session);
  const knownTotalKm = roundKm(volume.exactKm + volume.estimatedKm);

  if (knownTotalKm > 0 || session.plannedVolume || session.runStructure) {
    return {
      exactKm: volume.exactKm,
      estimatedKm: volume.estimatedKm,
      totalKm: knownTotalKm,
      hasEstimatedKm: volume.estimatedKm > 0,
    };
  }

  const fallbackKm = sessionKm(session);
  return {
    exactKm: fallbackKm,
    estimatedKm: 0,
    totalKm: fallbackKm,
    hasEstimatedKm: false,
  };
}

/**
 * Expected distance for a planned session (for matching/comparison).
 */
export function expectedDistance(session: PlannedSession): number {
  if (session.plannedVolume || session.runStructure) {
    const structuredKm = totalStructuredSessionKm(session);
    if (structuredKm > 0) return structuredKm;
  }

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
  return weekKmBreakdown(weekOrSessions).totalKm;
}

export function weekKmBreakdown(weekOrSessions: PlanWeek | (PlannedSession | null)[]): WeekKmBreakdown {
  const sessions = Array.isArray(weekOrSessions)
    ? weekOrSessions
    : weekOrSessions.sessions;
  const totals = sessions.reduce(
    (sum, session) => {
      const breakdown = sessionKmBreakdown(session);
      return {
        exactKm: sum.exactKm + breakdown.exactKm,
        estimatedKm: sum.estimatedKm + breakdown.estimatedKm,
        totalKm: sum.totalKm + breakdown.totalKm,
      };
    },
    { exactKm: 0, estimatedKm: 0, totalKm: 0 },
  );

  const exactKm = roundKm(totals.exactKm);
  const estimatedKm = roundKm(totals.estimatedKm);
  return {
    exactKm,
    estimatedKm,
    totalKm: roundKm(totals.totalKm),
    hasEstimatedKm: estimatedKm > 0,
  };
}
