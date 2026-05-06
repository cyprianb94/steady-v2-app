import type { PlannedSession, SessionType } from '../session';
import type { PhaseName, PlanWeek, SwapLogEntry } from '../plan';
import type { PropagateScope } from './propagate-change';
import { weekKm } from './session-km';
import { assignWeekSessionDates, inferWeekStartDate } from './week-dates';

export interface HardSessionConflict {
  firstDayIndex: number;
  secondDayIndex: number;
  firstType: HardSessionType;
  secondType: HardSessionType;
}

type HardSessionType = Extract<SessionType, 'INTERVAL' | 'TEMPO'>;

interface PropagateSwapOptions {
  shouldPreserveSession?: (
    session: PlannedSession,
    weekIndex: number,
    dayIndex: number,
  ) => boolean;
}

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
  options: PropagateSwapOptions = {},
): PlanWeek[] {
  const swapLog: SwapLogEntry = { from: fromIndex, to: toIndex };
  const phaseScope = targetPhase ?? plan[weekIndex]?.phase ?? 'BUILD';

  return plan.map((week, index) => {
    if (!shouldApplySwap(index, week, weekIndex, scope, phaseScope)) return week;
    if (hasPreservedSwapPosition(week, index, fromIndex, toIndex, options)) return week;

    const weekStartDate = inferWeekStartDate(week);
    const sessions = assignWeekSessionDates(
      swapSessions(week.sessions, fromIndex, toIndex),
      weekStartDate,
    );
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

function hasPreservedSwapPosition(
  week: PlanWeek,
  weekIndex: number,
  fromIndex: number,
  toIndex: number,
  options: PropagateSwapOptions,
): boolean {
  const shouldPreserveSession =
    options.shouldPreserveSession
    ?? ((session: PlannedSession) => Boolean(session.actualActivityId));
  const fromSession = week.sessions[fromIndex] ?? null;
  const toSession = week.sessions[toIndex] ?? null;

  return (
    Boolean(fromSession && shouldPreserveSession(fromSession, weekIndex, fromIndex))
    || Boolean(toSession && shouldPreserveSession(toSession, weekIndex, toIndex))
  );
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
