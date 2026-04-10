import type { Injury } from '../injury';
import type { PhaseName, PlanWeek } from '../plan';

export interface InjuryWeekRange {
  startIndex: number;
  endIndex: number;
}

export interface BlockPhaseSegment {
  name: PhaseName | 'INJURY';
  weeks: number;
  isCurrent: boolean;
}

function dateInWeek(week: PlanWeek, date: string): boolean {
  const dates = week.sessions
    .filter((session): session is NonNullable<typeof session> => Boolean(session))
    .map((session) => session.date)
    .sort();

  if (dates.length === 0) return false;
  return date >= dates[0] && date <= dates[dates.length - 1];
}

function findWeekIndexForDate(weeks: PlanWeek[], date: string): number {
  const exactIndex = weeks.findIndex((week) => dateInWeek(week, date));
  if (exactIndex >= 0) return exactIndex;

  const futureIndex = weeks.findIndex((week) => {
    const firstDate = week.sessions.find((session) => session?.date)?.date;
    return firstDate ? firstDate >= date : false;
  });

  if (futureIndex >= 0) return futureIndex;
  return Math.max(weeks.length - 1, 0);
}

export function getInjuryWeekRange(
  weeks: PlanWeek[],
  injury: Injury | null | undefined,
  today: string,
): InjuryWeekRange | null {
  if (!injury || weeks.length === 0) return null;

  const startIndex = findWeekIndexForDate(weeks, injury.markedDate);
  const endDate = injury.status === 'resolved' && injury.resolvedDate
    ? injury.resolvedDate
    : today;
  const endIndex = findWeekIndexForDate(weeks, endDate);

  return {
    startIndex: Math.min(startIndex, endIndex),
    endIndex: Math.max(startIndex, endIndex),
  };
}

export function isInjuryWeek(
  weekIndex: number,
  injuryRange: InjuryWeekRange | null,
): boolean {
  if (!injuryRange) return false;
  return weekIndex >= injuryRange.startIndex && weekIndex <= injuryRange.endIndex;
}

export function buildBlockPhaseSegments(
  weeks: PlanWeek[],
  currentIdx: number,
  injury: Injury | null | undefined,
  today: string,
): BlockPhaseSegment[] {
  const injuryRange = getInjuryWeekRange(weeks, injury, today);
  const segments: BlockPhaseSegment[] = [];

  for (let i = 0; i < weeks.length; i++) {
    const phaseName: BlockPhaseSegment['name'] = isInjuryWeek(i, injuryRange)
      ? 'INJURY'
      : weeks[i].phase;

    if (segments.length > 0 && segments[segments.length - 1].name === phaseName) {
      segments[segments.length - 1].weeks += 1;
    } else {
      segments.push({ name: phaseName, weeks: 1, isCurrent: false });
    }

    if (i === currentIdx) {
      segments[segments.length - 1].isCurrent = true;
    }
  }

  return segments;
}
