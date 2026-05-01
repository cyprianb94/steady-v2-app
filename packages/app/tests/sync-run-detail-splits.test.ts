import { describe, expect, it } from 'vitest';
import type { Activity, PlannedSession } from '@steady/types';
import { shouldRefreshKilometreSplits } from '../features/sync/sync-run-detail';

function session(overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'session-1',
    type: 'EASY',
    date: '2026-04-30',
    distance: 6,
    pace: '6:30',
    ...overrides,
  };
}

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    userId: 'user-1',
    source: 'strava',
    externalId: 'external-1',
    startTime: '2026-04-30T18:31:00.000Z',
    distance: 6.1,
    duration: 2172,
    avgPace: 356,
    splits: [
      { km: 1, distance: 1, pace: 430, hr: 147 },
      { km: 2, distance: 1, pace: 333, hr: 152 },
      { km: 3, distance: 1, pace: 338, hr: 151 },
      { km: 4, distance: 1, pace: 355, hr: 150 },
      { km: 5, distance: 1, pace: 363, hr: 151 },
      { km: 6, distance: 1, pace: 624, hr: 152 },
      { km: 7, distance: 0.1, pace: 439, hr: 161 },
    ],
    ...overrides,
  };
}

describe('sync run detail split refresh', () => {
  it('refreshes stored Strava splits when elapsed split pace includes paused time', () => {
    expect(shouldRefreshKilometreSplits(activity(), session())).toBe(true);
  });

  it('does not refresh Apple Health runs through the Strava refresh path', () => {
    expect(shouldRefreshKilometreSplits(activity({ source: 'apple_health' }), session())).toBe(false);
  });
});
