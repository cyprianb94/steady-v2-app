import {
  buildBlockWeekDayDetails,
  swapSessions,
  type BlockVolumeTone,
  type PlanWeek,
  type PlannedSession,
  type SwapLogEntry,
  type WeekVolumeSummary,
} from '@steady/types';
import type { ActivityResolution } from './activity-resolution';

type BlockResolution = Pick<
  ActivityResolution,
  'completionStatusForSession' | 'isSessionComplete' | 'weekActualKm'
>;

function hasResolvedLockedSwapPosition(
  sessions: readonly (PlannedSession | null)[],
  fromIndex: number,
  toIndex: number,
  resolution: Pick<ActivityResolution, 'isSessionComplete'>,
): boolean {
  return (
    resolution.isSessionComplete(sessions[fromIndex] ?? null)
    || resolution.isSessionComplete(sessions[toIndex] ?? null)
  );
}

export function buildResolvedBlockWeekDayDetails(
  week: PlanWeek,
  resolution: Pick<ActivityResolution, 'completionStatusForSession' | 'isSessionComplete'>,
) {
  const baseDetails = buildBlockWeekDayDetails(week);

  return baseDetails.map((detail, index) => {
    const session = week.sessions[index] ?? null;
    const completionStatus = resolution.completionStatusForSession(session);
    const status = completionStatus ?? (resolution.isSessionComplete(session) ? 'completed' : 'upcoming');

    return status === detail.status ? detail : { ...detail, status };
  });
}

export function getResolvedWeekVolumeSummary(
  week: PlanWeek,
  tone: BlockVolumeTone,
  resolution: Pick<ActivityResolution, 'weekActualKm'>,
): WeekVolumeSummary {
  const plannedKm = week.plannedKm;

  if (tone === 'future') {
    return {
      plannedKm,
      actualKm: null,
      showActual: false,
      barKm: plannedKm,
    };
  }

  const actualKm = resolution.weekActualKm(week.sessions);
  if (actualKm <= 0) {
    return {
      plannedKm,
      actualKm: null,
      showActual: false,
      barKm: plannedKm,
    };
  }

  return {
    plannedKm,
    actualKm,
    showActual: true,
    barKm: actualKm,
  };
}

export function restoreResolvedSwapDraft(
  sessions: (PlannedSession | null)[],
  swapLog: SwapLogEntry[],
  resolution: Pick<ActivityResolution, 'isSessionComplete'>,
) {
  return swapLog.reduce<{ sessions: (PlannedSession | null)[]; swapLog: SwapLogEntry[] }>((current, swap) => {
    if (hasResolvedLockedSwapPosition(current.sessions, swap.from, swap.to, resolution)) {
      return current;
    }

    return {
      sessions: swapSessions(current.sessions, swap.from, swap.to),
      swapLog: [...current.swapLog, swap],
    };
  }, { sessions, swapLog: [] });
}

export function preserveResolvedLockedWeeks(
  previousWeeks: PlanWeek[],
  nextWeeks: PlanWeek[],
  swap: SwapLogEntry,
  resolution: Pick<ActivityResolution, 'isSessionComplete'>,
): PlanWeek[] {
  return nextWeeks.map((week, index) => {
    const previousWeek = previousWeeks[index] ?? week;

    return hasResolvedLockedSwapPosition(previousWeek.sessions, swap.from, swap.to, resolution)
      ? previousWeek
      : week;
  });
}
