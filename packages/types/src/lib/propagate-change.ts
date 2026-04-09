import type { PlannedSession } from '../session';
import type { PlanWeek } from '../plan';
import { sessionKm } from './session-km';

export type PropagateScope = 'this' | 'remaining' | 'build';

/**
 * Apply a session edit across a plan, respecting scope.
 *
 * Hides: Delta calculation from template baseline, proportional application
 * that preserves existing progression, scope filtering, km recalculation.
 *
 * - 'this':      only the target week
 * - 'remaining': target week and all subsequent weeks
 * - 'build':     target week and all subsequent BUILD-phase weeks
 */
export function propagateChange(
  plan: PlanWeek[],
  weekIndex: number,
  dayIndex: number,
  updated: PlannedSession | null,
  scope: PropagateScope,
  template: (PlannedSession | null)[],
): PlanWeek[] {
  return plan.map((w, wi) => {
    let apply = false;
    if (scope === 'this') apply = wi === weekIndex;
    else if (scope === 'remaining') apply = wi >= weekIndex;
    else if (scope === 'build') apply = wi >= weekIndex && w.phase === 'BUILD';

    if (!apply) return w;

    const sessions = w.sessions.map((d, di) => {
      if (di !== dayIndex) return d;
      if (d?.actualActivityId) return d;

      // Target week gets the exact updated session
      if (wi === weekIndex) return updated;

      const base = template[dayIndex];
      if (!d || d.type === 'REST' || !base || base.type === 'REST') return updated;

      // Apply delta for INTERVAL reps
      if (updated?.type === 'INTERVAL' && d.type === 'INTERVAL') {
        const dr = (updated.reps ?? 6) - (base.reps ?? 6);
        return {
          ...d,
          reps: Math.max(2, (d.reps ?? 6) + dr),
          repDist: updated.repDist ?? d.repDist,
        };
      }

      // Apply delta for distance-based sessions
      if (d.distance !== undefined && updated?.distance !== undefined) {
        const dd = (updated.distance ?? 8) - (base.distance ?? 8);
        return { ...d, distance: Math.max(2, (d.distance ?? 8) + dd) };
      }

      return updated;
    });

    const km = sessions.reduce((acc, d) => acc + sessionKm(d), 0);
    return { ...w, sessions, plannedKm: Math.round(km) };
  });
}
