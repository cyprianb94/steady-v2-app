import type { PlannedSession } from '../session';
import type { PhaseConfig, PhaseName, PlanWeek } from '../plan';
import { sessionKm } from './session-km';
import { normalizeSessionIds } from './normalize-session-ids';

/**
 * Compute default phase distribution for a given total week count.
 */
export function defaultPhases(totalWeeks: number): PhaseConfig {
  const taper = Math.max(2, Math.round(totalWeeks * 0.13));
  const peak = Math.max(1, Math.round(totalWeeks * 0.13));
  const recovery = 0;
  const base = Math.max(1, Math.round(totalWeeks * 0.20));
  const build = Math.max(1, totalWeeks - base - peak - taper - recovery);
  return { BASE: base, BUILD: build, RECOVERY: recovery, PEAK: peak, TAPER: taper };
}

/**
 * Generate a full training plan from a template week.
 *
 * Hides: Phase distribution, recovery week insertion (evenly in BUILD),
 * progression factor math, recovery deload (65%), peak amplification (factor),
 * taper scaling (80%/60%), sessionKm calculations.
 */
export function generatePlan(
  template: (PlannedSession | null)[],
  totalWeeks: number,
  progressionPct: number,
  phases?: PhaseConfig,
): PlanWeek[] {
  const ph = phases ?? defaultPhases(totalWeeks);

  // Spread RECOVERY weeks evenly across the BUILD section
  const recoveryInterval =
    ph.RECOVERY > 0 ? Math.floor(ph.BUILD / (ph.RECOVERY + 1)) : Infinity;

  // Build array of phase labels, length = totalWeeks
  const weekPhases: PhaseName[] = [];
  let baseLeft = ph.BASE;
  let buildLeft = ph.BUILD;
  let recLeft = ph.RECOVERY;
  let peakLeft = ph.PEAK;
  let taperLeft = ph.TAPER;
  let buildCount = 0;

  for (let i = 0; i < totalWeeks; i++) {
    if (baseLeft > 0) {
      weekPhases.push('BASE');
      baseLeft--;
    } else if (buildLeft > 0 || recLeft > 0) {
      if (recLeft > 0 && buildCount > 0 && buildCount % recoveryInterval === 0) {
        weekPhases.push('RECOVERY');
        recLeft--;
      } else if (buildLeft > 0) {
        weekPhases.push('BUILD');
        buildLeft--;
        buildCount++;
      } else {
        weekPhases.push('RECOVERY');
        recLeft--;
      }
    } else if (peakLeft > 0) {
      weekPhases.push('PEAK');
      peakLeft--;
    } else if (taperLeft > 0) {
      weekPhases.push('TAPER');
      taperLeft--;
    } else {
      weekPhases.push('TAPER');
    }
  }

  const taperStart = weekPhases.lastIndexOf('PEAK') + 1;

  const rawWeeks = weekPhases.map((phase, w) => {
    const prog = Math.floor(w / 2);
    const isTaper = phase === 'TAPER';
    const isRecov = phase === 'RECOVERY';
    const taperIdx = isTaper ? w - taperStart : 0;
    const factor =
      progressionPct > 0 && !isTaper && !isRecov
        ? Math.pow(1 + progressionPct / 100, prog)
        : 1;

    const sessions: (PlannedSession | null)[] = template.map((s) => {
      if (!s || s.type === 'REST') return null;
      const out: PlannedSession = { ...s };

      // Progressive overload (BASE, BUILD, PEAK)
      if (progressionPct > 0 && !isTaper && !isRecov) {
        if (s.type === 'INTERVAL') {
          out.reps = Math.min(20, Math.round((s.reps ?? 6) * factor));
        } else if (s.distance) {
          out.distance = Math.round((s.distance ?? 8) * factor);
        }
      }

      // Recovery deload: 65%
      if (isRecov) {
        if (out.reps != null) out.reps = Math.max(3, Math.round((s.reps ?? 6) * 0.65));
        if (out.distance != null) out.distance = Math.max(3, Math.round((s.distance ?? 8) * 0.65));
      }

      // Taper: week 1 at 80%, week 2+ at 60%
      if (isTaper) {
        const f = taperIdx === 0 ? 0.8 : 0.6;
        if (out.reps != null) out.reps = Math.max(3, Math.round(out.reps * f));
        if (out.distance != null) out.distance = Math.max(3, Math.round(out.distance * f));
      }

      return out;
    });

    const km = sessions.reduce((acc, d) => acc + sessionKm(d), 0);

    return {
      weekNumber: w + 1,
      phase,
      sessions,
      plannedKm: Math.round(km),
    };
  });

  return normalizeSessionIds(rawWeeks);
}
