import type { PlanWeek } from '../plan';
import type { PlannedSession } from '../session';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type BlockDayStatus = 'completed' | 'off-target' | 'missed' | 'upcoming';

export interface BlockWeekDayDetail {
  dayLabel: (typeof DAY_LABELS)[number];
  date: string | null;
  sessionLabel: string;
  distanceLabel: string | null;
  status: BlockDayStatus;
  isRest: boolean;
  sessionType: PlannedSession['type'];
}

function getSessionLabel(session: PlannedSession | null): string {
  if (!session || session.type === 'REST') return 'Rest';

  switch (session.type) {
    case 'EASY':
      return 'Easy Run';
    case 'INTERVAL':
      return 'Intervals';
    case 'TEMPO':
      return 'Tempo';
    case 'LONG':
      return 'Long Run';
    default:
      return 'Rest';
  }
}

function getDistanceLabel(session: PlannedSession | null): string | null {
  if (!session || session.type === 'REST') return null;
  if (session.type === 'INTERVAL') {
    if (session.reps && session.repDist) {
      return `${session.reps}×${session.repDist}m`;
    }
    return null;
  }
  return session.distance != null ? `${session.distance}km` : null;
}

function getStatus(session: PlannedSession | null): BlockDayStatus {
  if (session?.actualActivityId) {
    return 'completed';
  }

  return 'upcoming';
}

export function buildBlockWeekDayDetails(week: PlanWeek): BlockWeekDayDetail[] {
  return DAY_LABELS.map((dayLabel, index) => {
    const session = week.sessions[index] ?? null;
    return {
      dayLabel,
      date: session?.date ?? null,
      sessionLabel: getSessionLabel(session),
      distanceLabel: getDistanceLabel(session),
      status: getStatus(session),
      isRest: !session || session.type === 'REST',
      sessionType: session?.type ?? 'REST',
    };
  });
}
