import { describe, expect, it } from 'vitest';
import type { Activity, PlannedSession } from '@steady/types';
import { resolveDefaultMatchSessionId } from '../features/sync/sync-run-detail';

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
    startTime: '2026-04-29T18:31:00.000Z',
    distance: 8.01,
    duration: 2827,
    avgPace: 353,
    splits: [],
    ...overrides,
  };
}

describe('sync run detail helpers', () => {
  it('honours an explicit nearby preferred session even when another run is currently linked', () => {
    const preferredSession = session({ actualActivityId: 'wrong-activity' });

    expect(resolveDefaultMatchSessionId({
      activity: activity(),
      preferredSession,
      today: '2026-05-01',
      todaySession: null,
      sessionOptions: [preferredSession],
    })).toBe('session-1');
  });
});
