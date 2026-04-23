import type { Activity, PlannedSession, PlanWeek } from '@steady/types';
import { expectedDistance } from '@steady/types';

/**
 * Match an activity to a planned session.
 *
 * Hides: Date matching, type inference from HR/pace/duration,
 * distance proximity disambiguation, already-matched exclusion,
 * short-activity filtering.
 */
export function matchActivity(
  activity: Activity,
  planWeeks: PlanWeek[],
  alreadyMatchedIds: Set<string> = new Set(),
  activityDate = activity.startTime.slice(0, 10),
): PlannedSession | null {
  // Skip very short activities (<20 min)
  if (activity.duration < 20 * 60) return null;
  const inferredType = inferType(activity);

  // Collect candidate sessions: same date, not REST, not already matched
  const candidates: PlannedSession[] = [];
  for (const week of planWeeks) {
    for (const session of week.sessions) {
      if (!session || session.type === 'REST') continue;
      if (session.date !== activityDate) continue;
      if (session.actualActivityId) continue;
      if (alreadyMatchedIds.has(session.id)) continue;
      candidates.push(session);
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Prefer type match
  const typeMatches = candidates.filter((s) => s.type === inferredType);
  if (typeMatches.length === 1) return typeMatches[0];

  // Disambiguate by closest distance
  const pool = typeMatches.length > 0 ? typeMatches : candidates;
  return closestByDistance(activity, pool);
}

/**
 * Infer session type from activity metrics.
 *
 * - HR sustained >165 bpm with pace variation (splits) → INTERVAL
 * - HR sustained >165 bpm for >60% → TEMPO
 * - Distance >16km → LONG
 * - Otherwise → EASY
 */
function inferType(activity: Activity): PlannedSession['type'] {
  const hasHR = activity.avgHR != null && activity.avgHR > 0;
  const splits = activity.splits;

  // Check for interval pattern: significant pace variation across splits
  if (splits.length >= 3) {
    const paces = splits.map((s) => s.pace);
    const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;
    const variance =
      paces.reduce((acc, p) => acc + Math.pow(p - avgPace, 2), 0) / paces.length;
    const cv = Math.sqrt(variance) / avgPace; // coefficient of variation

    // High pace variation with elevated HR suggests intervals
    if (cv > 0.15 && hasHR && activity.avgHR! > 155) {
      return 'INTERVAL';
    }
  }

  // Sustained high HR → TEMPO
  if (hasHR && activity.avgHR! > 165) {
    // Check if HR is sustained: use split-level HR if available
    const splitsWithHR = splits.filter((s) => s.hr != null && s.hr > 0);
    if (splitsWithHR.length > 0) {
      const highHRSplits = splitsWithHR.filter((s) => s.hr! > 165);
      if (highHRSplits.length / splitsWithHR.length > 0.6) {
        return 'TEMPO';
      }
    } else {
      // No split-level HR, trust avg
      return 'TEMPO';
    }
  }

  // Long distance
  if (activity.distance > 16) return 'LONG';

  return 'EASY';
}

function closestByDistance(
  activity: Activity,
  candidates: PlannedSession[],
): PlannedSession {
  let best = candidates[0];
  let bestDiff = Infinity;

  for (const c of candidates) {
    const expectedKm = expectedDistance(c);
    const diff = Math.abs(activity.distance - expectedKm);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
    }
  }

  return best;
}

// expectedDistance is now imported from @steady/types
