import { describe, expect, it } from 'vitest';
import { getDisplayWeekIndex, type PlanWeek, type PlannedSession } from '@steady/types';

function makeSession(date: string): PlannedSession {
  return {
    id: crypto.randomUUID(),
    type: 'EASY',
    date,
    distance: 8,
    pace: '5:20',
  };
}

function makeWeek(weekNumber: number, dates: string[]): PlanWeek {
  return {
    weekNumber,
    phase: 'BUILD',
    sessions: dates.map((date) => (date ? makeSession(date) : null)),
    plannedKm: 40,
  };
}

describe('getDisplayWeekIndex', () => {
  it('returns the first week that still has a session on or after today', () => {
    const weeks: PlanWeek[] = [
      makeWeek(1, ['2026-04-01', '', '', '', '', '', '2026-04-06']),
      makeWeek(2, ['2026-04-07', '', '', '', '', '', '2026-04-13']),
      makeWeek(3, ['2026-04-14', '', '', '', '', '', '2026-04-20']),
    ];

    expect(getDisplayWeekIndex(weeks, '2026-04-09')).toBe(1);
  });

  it('prefers a chosen resume week when it exists in the plan', () => {
    const weeks: PlanWeek[] = [
      makeWeek(1, ['2026-04-01', '', '', '', '', '', '2026-04-06']),
      makeWeek(2, ['2026-04-07', '', '', '', '', '', '2026-04-13']),
      makeWeek(3, ['2026-04-14', '', '', '', '', '', '2026-04-20']),
    ];

    expect(getDisplayWeekIndex(weeks, '2026-04-09', 3)).toBe(2);
  });

  it('falls back to date-based selection when the resume week is out of range', () => {
    const weeks: PlanWeek[] = [
      makeWeek(1, ['2026-04-01', '', '', '', '', '', '2026-04-06']),
      makeWeek(2, ['2026-04-07', '', '', '', '', '', '2026-04-13']),
    ];

    expect(getDisplayWeekIndex(weeks, '2026-04-09', 99)).toBe(1);
  });

  it('returns the last week when every session date is already in the past', () => {
    const weeks: PlanWeek[] = [
      makeWeek(1, ['2026-03-01', '', '', '', '', '', '2026-03-07']),
      makeWeek(2, ['2026-03-08', '', '', '', '', '', '2026-03-14']),
      makeWeek(3, ['2026-03-15', '', '', '', '', '', '2026-03-21']),
    ];

    expect(getDisplayWeekIndex(weeks, '2026-04-09')).toBe(2);
  });
});
