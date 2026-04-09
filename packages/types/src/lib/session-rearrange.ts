import type { PlannedSession, SessionType } from '../session';

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
