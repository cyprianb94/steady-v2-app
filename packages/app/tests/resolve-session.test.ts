import { describe, expect, it } from 'vitest';
import type { Activity, PlannedSession } from '@steady/types';
import {
  canOpenHomeSessionRow,
  canOpenResolveSessionSheet,
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

  it('finds nearby unmatched activities and orders closest distance first', () => {
    const session = intervalSession({ type: 'EASY', distance: 8 });

    const matches = possibleActivityMatchesForSession(session, [
      activity({ id: 'same-date-far', distance: 9.8, startTime: '2026-04-23T19:00:00.000Z' }),
      activity({ id: 'linked', matchedSessionId: 'other-session' }),
      activity({ id: 'outside-window', startTime: '2026-04-21T18:42:00.000Z' }),
      activity({ id: 'manual', source: 'manual' }),
      activity({ id: 'previous-day-close', distance: 8.01, startTime: '2026-04-22T18:42:00.000Z' }),
      activity({ id: 'same-date-close', distance: 8.2, startTime: '2026-04-23T07:18:00.000Z' }),
    ]);

    expect(matches.map((match) => match.id)).toEqual(['previous-day-close', 'same-date-close', 'same-date-far']);
  });
});
