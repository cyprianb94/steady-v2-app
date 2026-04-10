import type { PlannedSession, SessionType } from '../session';
import type { PhaseName, PlanWeek, SwapLogEntry } from '../plan';
import type { PropagateScope } from './propagate-change';
import { weekKm } from './session-km';

export interface HardSessionConflict {
  firstDayIndex: number;
  secondDayIndex: number;
  firstType: HardSessionType;
  secondType: HardSessionType;
}

type HardSessionType = Extract<SessionType, 'INTERVAL' | 'TEMPO'>;

export function swapSessions(
  sessions: (PlannedSession | null)[],
  fromIndex: number,
  toIndex: number,
): (PlannedSession | null)[] {
  if (!isDayIndex(fromIndex, sessions) || !isDayIndex(toIndex, sessions)) {
    return sessions;
  }
  if (fromIndex === toIndex) {
    return sessions;
  }

  const next = [...sessions];
  const from = next[fromIndex] ?? null;
  next[fromIndex] = next[toIndex] ?? null;
  next[toIndex] = from;
  return next;
}

export function propagateSwap(
  plan: PlanWeek[],
  weekIndex: number,
  fromIndex: number,
  toIndex: number,
  scope: PropagateScope,
  targetPhase?: PhaseName,
): PlanWeek[] {
  const swapLog: SwapLogEntry = { from: fromIndex, to: toIndex };
  const phaseScope = targetPhase ?? plan[weekIndex]?.phase ?? 'BUILD';

  return plan.map((week, index) => {
    if (!shouldApplySwap(index, week, weekIndex, scope, phaseScope)) return week;
    if (hasCompletedSwapPosition(week, fromIndex, toIndex)) return week;

    const sessions = swapSessions(week.sessions, fromIndex, toIndex);
    if (sessions === week.sessions) return week;

    return {
      ...week,
      sessions,
      plannedKm: Math.round(weekKm(sessions)),
      swapLog: [...(week.swapLog ?? []), swapLog],
    };
  });
}

function shouldApplySwap(
  index: number,
  week: PlanWeek,
  weekIndex: number,
  scope: PropagateScope,
  targetPhase: PhaseName,
): boolean {
  if (scope === 'this') return index === weekIndex;
  if (scope === 'remaining') return index >= weekIndex;
  return week.phase === targetPhase;
}

function hasCompletedSwapPosition(week: PlanWeek, fromIndex: number, toIndex: number): boolean {
  return Boolean(week.sessions[fromIndex]?.actualActivityId || week.sessions[toIndex]?.actualActivityId);
}

function isDayIndex(index: number, sessions: (PlannedSession | null)[]): boolean {
  return Number.isInteger(index) && index >= 0 && index < sessions.length;
}

export function detectHardSessionConflicts(sessions: (PlannedSession | null)[]): HardSessionConflict[] {
  const conflicts: HardSessionConflict[] = [];

  for (let dayIndex = 0; dayIndex < sessions.length - 1; dayIndex += 1) {
    const first = sessions[dayIndex];
    const second = sessions[dayIndex + 1];

    if (isHardSession(first) && isHardSession(second)) {
      conflicts.push({
        firstDayIndex: dayIndex,
        secondDayIndex: dayIndex + 1,
        firstType: first.type,
        secondType: second.type,
      });
    }
  }

  return conflicts;
}

function isHardSession(session: PlannedSession | null): session is PlannedSession & { type: HardSessionType } {
  return session?.type === 'INTERVAL' || session?.type === 'TEMPO';
}
