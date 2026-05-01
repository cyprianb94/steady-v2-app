import { describe, expect, it } from 'vitest';
import type { Activity, PlannedSession } from '@steady/types';
import { candidateActivitiesForSession } from '../features/run/session-activity-candidates';

function session(overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'session-1',
    type: 'EASY',
    date: '2026-04-30',
    distance: 8,
    pace: '5:30',
    ...overrides,
  };
}

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    userId: 'user-1',
    source: 'strava',
    externalId: 'external-1',
    startTime: '2026-04-30T18:00:00.000Z',
    distance: 8,
    duration: 2880,
    avgPace: 360,
    splits: [],
    ...overrides,
  };
}

describe('session activity candidates', () => {
  it('shows nearby synced runs and ranks the closest distance before exact-date misses', () => {
    const matches = candidateActivitiesForSession(session(), [
      activity({ id: 'same-date-far', startTime: '2026-04-30T21:32:00.000Z', distance: 9.1 }),
      activity({ id: 'previous-day-close', startTime: '2026-04-29T18:31:00.000Z', distance: 8.01 }),
      activity({ id: 'two-days-before', startTime: '2026-04-28T18:31:00.000Z', distance: 8 }),
      activity({ id: 'manual', source: 'manual', startTime: '2026-04-29T18:31:00.000Z', distance: 8 }),
      activity({ id: 'matched-elsewhere', matchedSessionId: 'other-session', startTime: '2026-04-29T18:31:00.000Z', distance: 8 }),
    ]);

    expect(matches.map((match) => match.id)).toEqual(['previous-day-close', 'same-date-far']);
  });

  it('can keep the current auto-match visible for the session picker', () => {
    const matches = candidateActivitiesForSession(
      session(),
      [
        activity({ id: 'current-match', matchedSessionId: 'session-1', startTime: '2026-04-30T21:32:00.000Z', distance: 9.1 }),
        activity({ id: 'matched-elsewhere', matchedSessionId: 'other-session', startTime: '2026-04-30T18:31:00.000Z', distance: 8 }),
      ],
      { allowMatchedToSession: true },
    );

    expect(matches.map((match) => match.id)).toEqual(['current-match']);
  });
});
