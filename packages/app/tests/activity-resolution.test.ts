import { describe, expect, it } from 'vitest';
import { createActivityResolution } from '../features/run/activity-resolution';

describe('createActivityResolution', () => {
  it('resolves sessions by actualActivityId first and falls back to legacy matched IDs', () => {
    const resolution = createActivityResolution([
      {
        id: 'activity-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-15T07:15:00.000Z',
        distance: 10.5,
        duration: 3200,
        avgPace: 305,
        splits: [],
        matchedSessionId: 'session-1',
      },
    ]);

    expect(
      resolution.activityForSession({
        id: 'session-1',
        actualActivityId: 'activity-1',
      }),
    ).toMatchObject({ id: 'activity-1' });

    expect(
      resolution.activityForSession({
        id: 'session-1',
        actualActivityId: 'missing-activity',
      }),
    ).toMatchObject({ id: 'activity-1' });
  });

  it('marks materially short completed runs as off-target once distance drifts past 5%', () => {
    const resolution = createActivityResolution([
      {
        id: 'activity-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-15T07:15:00.000Z',
        distance: 5.5,
        duration: 2200,
        avgPace: 400,
        splits: [],
        matchedSessionId: 'session-1',
      },
    ]);

    expect(
      resolution.statusForDay(
        {
          id: 'session-1',
          type: 'EASY',
          date: '2026-04-15',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'activity-1',
        },
        0,
        0,
      ),
    ).toBe('off-target');
  });

  it('treats a matched activity as completed even before the plan refresh stamps actualActivityId', () => {
    const resolution = createActivityResolution([
      {
        id: 'activity-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-15T07:15:00.000Z',
        distance: 8.1,
        duration: 2620,
        avgPace: 317,
        splits: [],
        matchedSessionId: 'session-1',
      },
    ]);

    const session = {
      id: 'session-1',
      type: 'EASY' as const,
      date: '2026-04-15',
      distance: 8,
      pace: '5:20',
    };

    expect(resolution.isSessionComplete(session)).toBe(true);
    expect(resolution.statusForDay(session, 0, 0)).toBe('completed');
  });

  it('keeps completed runs on target when distance lands exactly on the 5% boundary', () => {
    const resolution = createActivityResolution([
      {
        id: 'activity-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-15T07:15:00.000Z',
        distance: 7.6,
        duration: 2432,
        avgPace: 320,
        splits: [],
        matchedSessionId: 'session-1',
      },
    ]);

    expect(
      resolution.statusForDay(
        {
          id: 'session-1',
          type: 'EASY',
          date: '2026-04-15',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'activity-1',
        },
        0,
        0,
      ),
    ).toBe('completed');
  });

  it('marks completed runs off-target when pace drifts past the 5% tolerance', () => {
    const resolution = createActivityResolution([
      {
        id: 'activity-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-15T07:15:00.000Z',
        distance: 8,
        duration: 2704,
        avgPace: 338,
        splits: [],
        matchedSessionId: 'session-1',
      },
    ]);

    expect(
      resolution.statusForDay(
        {
          id: 'session-1',
          type: 'EASY',
          date: '2026-04-15',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'activity-1',
        },
        0,
        0,
      ),
    ).toBe('off-target');
  });

  it('computes weekly actual distance from resolved activities', () => {
    const resolution = createActivityResolution([
      {
        id: 'activity-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-15T07:15:00.000Z',
        distance: 8.2,
        duration: 2600,
        avgPace: 317,
        splits: [],
        matchedSessionId: 'session-1',
      },
      {
        id: 'activity-2',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-2',
        startTime: '2026-04-17T07:15:00.000Z',
        distance: 12.4,
        duration: 4100,
        avgPace: 330,
        splits: [],
        matchedSessionId: 'session-2',
      },
    ]);

    expect(
      resolution.weekActualKm([
        {
          id: 'session-1',
          type: 'EASY',
          date: '2026-04-15',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'activity-1',
        },
        {
          id: 'session-2',
          type: 'LONG',
          date: '2026-04-17',
          distance: 12,
          pace: '5:05',
          actualActivityId: 'activity-2',
        },
      ]),
    ).toBe(20.6);
  });
});
