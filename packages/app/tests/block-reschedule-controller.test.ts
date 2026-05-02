import { describe, expect, it } from 'vitest';
import {
  type PhaseName,
  type PlannedSession,
  type PlanWeek,
} from '@steady/types';
import { applyBlockRescheduleDraft } from '../features/block-review/block-reschedule-controller';

function addDays(startDate: string, offset: number): string {
  const value = new Date(`${startDate}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function session(id: string, date: string, distance = 8): PlannedSession {
  return {
    id,
    type: 'EASY',
    date,
    distance,
  };
}

function week(weekNumber: number, phase: PhaseName): PlanWeek {
  const startDate = `2026-05-${String(weekNumber).padStart(2, '0')}`;
  const sessions = Array.from({ length: 7 }, (_, index) => (
    index <= 2 ? session(`w${weekNumber}-d${index}`, addDays(startDate, index), 8 + index) : null
  ));

  return {
    weekNumber,
    phase,
    plannedKm: 27,
    sessions,
  };
}

function sessionIds(weekToRead: PlanWeek): (string | null)[] {
  return weekToRead.sessions.map((plannedSession) => plannedSession?.id ?? null);
}

const noCompletedSessions = {
  isSessionComplete: () => false,
};

describe('applyBlockRescheduleDraft', () => {
  it('applies this-week and remaining scopes without leaking into earlier weeks', () => {
    const weeks = [
      week(1, 'BASE'),
      week(2, 'BUILD'),
      week(3, 'BUILD'),
    ];

    const thisWeek = applyBlockRescheduleDraft({
      weeks,
      weekIndex: 1,
      swapLog: [{ from: 0, to: 2 }],
      scope: 'this',
      resolution: noCompletedSessions,
    });

    expect(sessionIds(thisWeek[0])).toEqual(sessionIds(weeks[0]));
    expect(sessionIds(thisWeek[1]).slice(0, 3)).toEqual(['w2-d2', 'w2-d1', 'w2-d0']);
    expect(sessionIds(thisWeek[2])).toEqual(sessionIds(weeks[2]));

    const remaining = applyBlockRescheduleDraft({
      weeks,
      weekIndex: 1,
      swapLog: [{ from: 0, to: 2 }],
      scope: 'remaining',
      resolution: noCompletedSessions,
    });

    expect(sessionIds(remaining[0])).toEqual(sessionIds(weeks[0]));
    expect(sessionIds(remaining[1]).slice(0, 3)).toEqual(['w2-d2', 'w2-d1', 'w2-d0']);
    expect(sessionIds(remaining[2]).slice(0, 3)).toEqual(['w3-d2', 'w3-d1', 'w3-d0']);
  });

  it('applies phase scope to non-contiguous phase weeks while preserving resolved locked sessions', () => {
    const weeks = [
      week(1, 'BUILD'),
      week(2, 'BASE'),
      week(3, 'BUILD'),
      week(4, 'BUILD'),
    ];
    const lockedSessionId = weeks[0].sessions[0]?.id;

    const nextWeeks = applyBlockRescheduleDraft({
      weeks,
      weekIndex: 2,
      swapLog: [{ from: 0, to: 1 }],
      scope: 'build',
      resolution: {
        isSessionComplete: (plannedSession) => plannedSession?.id === lockedSessionId,
      },
    });

    expect(sessionIds(nextWeeks[0])).toEqual(sessionIds(weeks[0]));
    expect(sessionIds(nextWeeks[1])).toEqual(sessionIds(weeks[1]));
    expect(sessionIds(nextWeeks[2]).slice(0, 3)).toEqual(['w3-d1', 'w3-d0', 'w3-d2']);
    expect(sessionIds(nextWeeks[3]).slice(0, 3)).toEqual(['w4-d1', 'w4-d0', 'w4-d2']);
  });

  it('returns the original week array when there is no valid draft to apply', () => {
    const weeks = [week(1, 'BASE')];

    expect(applyBlockRescheduleDraft({
      weeks,
      weekIndex: null,
      swapLog: [{ from: 0, to: 1 }],
      scope: 'this',
      resolution: noCompletedSessions,
    })).toBe(weeks);
    expect(applyBlockRescheduleDraft({
      weeks,
      weekIndex: 0,
      swapLog: [],
      scope: 'this',
      resolution: noCompletedSessions,
    })).toBe(weeks);
  });
});
