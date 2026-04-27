import { describe, expect, it } from 'vitest';
import type { Activity, PlannedSession, PlanWeek } from '@steady/types';
import {
  canOpenHomeSessionRow,
  canOpenResolveSessionSheet,
  clearSessionSkippedInWeeks,
  markSessionSkippedInWeeks,
  possibleActivityMatchesForSession,
} from '../features/home/resolve-session';

function intervalSession(overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'interval-1',
    type: 'INTERVAL',
    date: '2026-04-23',
    reps: 5,
    repDuration: { unit: 'min', value: 8 },
    pace: '4:10',
    recovery: '90s',
    warmup: { unit: 'km', value: 2 },
    cooldown: { unit: 'km', value: 1 },
    ...overrides,
  };
}

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: 'activity-1',
    userId: 'user-1',
    source: 'strava',
    externalId: 'external-1',
    startTime: '2026-04-23T18:42:00.000Z',
    distance: 9.8,
    duration: 2772,
    avgPace: 283,
    splits: [],
    ...overrides,
  };
}

describe('home resolve-session helpers', () => {
  it('opens the resolve sheet for unlogged planned sessions in the current week', () => {
    expect(canOpenResolveSessionSheet(intervalSession(), 'missed')).toBe(true);
    expect(canOpenResolveSessionSheet(intervalSession(), 'today')).toBe(true);
    expect(canOpenResolveSessionSheet(intervalSession(), 'upcoming')).toBe(true);
    expect(canOpenResolveSessionSheet(intervalSession({ actualActivityId: 'activity-1' }), 'missed')).toBe(false);
    expect(canOpenResolveSessionSheet(intervalSession(), 'completed')).toBe(false);
    expect(canOpenResolveSessionSheet(intervalSession({ skipped: { reason: 'tired', markedAt: '2026-04-24T12:00:00.000Z' } }), 'skipped')).toBe(true);
    expect(canOpenResolveSessionSheet({ ...intervalSession(), type: 'REST' }, 'rest')).toBe(false);
  });

  it('keeps completed rows openable through run detail even when resolve is not available', () => {
    expect(
      canOpenHomeSessionRow({
        session: intervalSession({ actualActivityId: 'activity-1' }),
        status: 'completed',
        hasRunDetail: true,
      }),
    ).toBe(true);
  });

  it('finds same-date unmatched activities and orders closest distance first', () => {
    const session = intervalSession();

    const matches = possibleActivityMatchesForSession(session, [
      activity({ id: 'far', distance: 9.8, startTime: '2026-04-23T19:00:00.000Z' }),
      activity({ id: 'linked', matchedSessionId: 'other-session' }),
      activity({ id: 'wrong-date', startTime: '2026-04-22T18:42:00.000Z' }),
      activity({ id: 'manual', source: 'manual' }),
      activity({ id: 'close', distance: 12.4, startTime: '2026-04-23T07:18:00.000Z' }),
    ]);

    expect(matches.map((match) => match.id)).toEqual(['close', 'far']);
  });

  it('marks a session skipped without mutating the original weeks', () => {
    const session = intervalSession();
    const weeks: PlanWeek[] = [
      {
        weekNumber: 2,
        phase: 'BASE',
        sessions: [session, null, null, null, null, null, null],
        plannedKm: 10,
      },
    ];

    const nextWeeks = markSessionSkippedInWeeks({
      weeks,
      sessionId: session.id,
      reason: 'busy',
      markedAt: '2026-04-24T12:00:00.000Z',
    });

    expect(nextWeeks[0].sessions[0]?.skipped).toEqual({
      reason: 'busy',
      markedAt: '2026-04-24T12:00:00.000Z',
    });
    expect(weeks[0].sessions[0]?.skipped).toBeUndefined();
  });

  it('clears a skipped session without mutating the original weeks', () => {
    const session = intervalSession({
      skipped: {
        reason: 'busy',
        markedAt: '2026-04-24T12:00:00.000Z',
      },
    });
    const weeks: PlanWeek[] = [
      {
        weekNumber: 2,
        phase: 'BASE',
        sessions: [session, null, null, null, null, null, null],
        plannedKm: 10,
      },
    ];

    const nextWeeks = clearSessionSkippedInWeeks({
      weeks,
      sessionId: session.id,
    });

    expect(nextWeeks[0].sessions[0]?.skipped).toBeUndefined();
    expect(weeks[0].sessions[0]?.skipped).toEqual({
      reason: 'busy',
      markedAt: '2026-04-24T12:00:00.000Z',
    });
  });
});
