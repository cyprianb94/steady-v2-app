import type { PlannedSession } from '../session';
import type { PhaseName, PlanWeek } from '../plan';
import { normalizeSessionIntensityTarget } from './intensity-targets';
import { weekKm } from './session-km';

export type PropagateScope = 'this' | 'remaining' | 'build';

interface PropagateChangeOptions {
  shouldPreserveSession?: (
    session: PlannedSession,
    weekIndex: number,
    dayIndex: number,
  ) => boolean;
}

function copyIntensityMetadata(
  session: PlannedSession,
  updated: PlannedSession,
): PlannedSession {
  const next: PlannedSession = { ...session };

  if ('pace' in updated) {
    if (updated.pace == null) {
      delete next.pace;
    } else {
      next.pace = updated.pace;
    }
  }

  if ('intensityTarget' in updated) {
    if (updated.intensityTarget == null) {
      delete next.intensityTarget;
    } else {
      next.intensityTarget = updated.intensityTarget;
    }
  }

  return normalizeSessionIntensityTarget(next, { applyDefaults: true });
}

function copyExactStructuralFields(
  session: PlannedSession,
  updated: PlannedSession,
): PlannedSession {
  const next = copyIntensityMetadata(session, updated);

  for (const field of ['repDist', 'repDuration', 'recovery', 'warmup', 'cooldown'] as const) {
    if (updated[field] == null) {
      delete next[field];
    } else {
      next[field] = updated[field] as never;
    }
  }

  return normalizeSessionIntensityTarget(next, { applyDefaults: true });
}

/**
 * Apply a session edit across a plan, respecting scope.
 *
 * Hides: Delta calculation from template baseline, proportional application
 * that preserves existing progression, scope filtering, km recalculation.
 *
 * - 'this':      only the target week
 * - 'remaining': target week and all subsequent weeks
 * - 'build':     all weeks in the same phase as the target week
 */
export function propagateChange(
  plan: PlanWeek[],
  weekIndex: number,
  dayIndex: number,
  updated: PlannedSession | null,
  scope: PropagateScope,
  template: (PlannedSession | null)[],
  targetPhase?: PhaseName,
  options: PropagateChangeOptions = {},
): PlanWeek[] {
  const phaseScope = targetPhase ?? plan[weekIndex]?.phase ?? 'BUILD';
  const normalizedUpdated = updated
    ? normalizeSessionIntensityTarget(updated, { applyDefaults: true })
    : null;
  const shouldPreserveSession =
    options.shouldPreserveSession
    ?? ((session: PlannedSession) => Boolean(session.actualActivityId));

  return plan.map((w, wi) => {
    let apply = false;
    if (scope === 'this') apply = wi === weekIndex;
    else if (scope === 'remaining') apply = wi >= weekIndex;
    else if (scope === 'build') apply = w.phase === phaseScope;

    if (!apply) return w;

    const sessions = w.sessions.map((d, di) => {
      if (di !== dayIndex) return d;
      if (d && shouldPreserveSession(d, wi, di)) return d;

      // Target week gets the exact updated session
      if (wi === weekIndex) return normalizedUpdated;

      const base = template[dayIndex];
      if (!d || d.type === 'REST' || !base || base.type === 'REST') return normalizedUpdated;

      // Apply delta for INTERVAL reps
      if (normalizedUpdated?.type === 'INTERVAL' && d.type === 'INTERVAL') {
        const dr = (normalizedUpdated.reps ?? 6) - (base.reps ?? 6);
        return copyExactStructuralFields({
          ...d,
          reps: Math.max(2, (d.reps ?? 6) + dr),
        }, normalizedUpdated);
      }

      // Apply delta for distance-based sessions
      if (d.distance !== undefined && normalizedUpdated?.distance !== undefined) {
        const dd = (normalizedUpdated.distance ?? 8) - (base.distance ?? 8);
        return copyExactStructuralFields({
          ...d,
          distance: Math.max(2, (d.distance ?? 8) + dd),
        }, normalizedUpdated);
      }

      return normalizedUpdated;
    });

    return { ...w, sessions, plannedKm: weekKm(sessions) };
  });
}
