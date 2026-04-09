import { describe, expect, it } from 'vitest';
import {
  buildBlockPhaseSegments,
  getInjuryWeekRange,
  type Injury,
  type PlanWeek,
  type PlannedSession,
} from '@steady/types';

function makeSession(date: string): PlannedSession {
  return {
    id: crypto.randomUUID(),
    type: 'EASY',
    date,
    distance: 8,
    pace: '5:20',
  };
}

function makeWeek(weekNumber: number, phase: PlanWeek['phase'], startDate: string): PlanWeek {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const value = new Date(`${startDate}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + index);
    return value.toISOString().slice(0, 10);
  });

  return {
    weekNumber,
    phase,
    plannedKm: 40,
    sessions: dates.map((date) => makeSession(date)),
  };
}

function makeInjury(overrides: Partial<Injury> = {}): Injury {
  return {
    name: 'Calf strain',
    markedDate: '2026-04-09',
    rtrStep: 0,
    rtrStepCompletedDates: [],
    status: 'recovering',
    ...overrides,
  };
}

describe('block injury helpers', () => {
  const weeks: PlanWeek[] = [
    makeWeek(1, 'BASE', '2026-03-30'),
    makeWeek(2, 'BUILD', '2026-04-06'),
    makeWeek(3, 'BUILD', '2026-04-13'),
    makeWeek(4, 'PEAK', '2026-04-20'),
  ];

  it('computes the injury range from marked week to current week for active injuries', () => {
    const range = getInjuryWeekRange(weeks, makeInjury(), '2026-04-18');

    expect(range).toEqual({ startIndex: 1, endIndex: 2 });
  });

  it('preserves the injury range using the resolved date after recovery', () => {
    const range = getInjuryWeekRange(
      weeks,
      makeInjury({ status: 'resolved', resolvedDate: '2026-04-16' }),
      '2026-05-01',
    );

    expect(range).toEqual({ startIndex: 1, endIndex: 2 });
  });

  it('inserts an INJURY segment into the phase strip for the matching weeks', () => {
    const segments = buildBlockPhaseSegments(weeks, 2, makeInjury(), '2026-04-18');

    expect(segments).toEqual([
      { name: 'BASE', weeks: 1, isCurrent: false },
      { name: 'INJURY', weeks: 2, isCurrent: true },
      { name: 'PEAK', weeks: 1, isCurrent: false },
    ]);
  });
});
