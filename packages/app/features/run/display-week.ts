import {
  assignWeekSessionDates,
  type PlanWeek,
} from '@steady/types';

export function buildDisplayWeek(week: PlanWeek, weekStartDate: string): PlanWeek {
  return {
    ...week,
    sessions: assignWeekSessionDates(week.sessions, weekStartDate),
  };
}
