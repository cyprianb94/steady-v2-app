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
    expect(resolution.completionStatusForSession(session)).toBe('completed');
    expect(resolution.statusForDay(session, 0, 0)).toBe('completed');
  });

  it('keeps a linked session completed when the activity snapshot is temporarily unavailable', () => {
    const resolution = createActivityResolution([]);
    const session = {
      id: 'session-1',
      type: 'EASY' as const,
      date: '2026-04-15',
      distance: 8,
      pace: '5:20',
      actualActivityId: 'activity-1',
    };

    expect(resolution.isSessionComplete(session)).toBe(true);
    expect(resolution.completionStatusForSession(session)).toBe('completed');
    expect(resolution.statusForDay(session, 0, 0)).toBe('completed');
  });

  it('treats a linked run as completed even if an old skipped marker is still present', () => {
    const resolution = createActivityResolution([]);
    const session = {
      id: 'session-1',
      type: 'EASY' as const,
      date: '2026-04-15',
      distance: 8,
      pace: '5:20',
      actualActivityId: 'activity-1',
      skipped: {
        reason: 'busy' as const,
        markedAt: '2026-04-15T12:00:00.000Z',
      },
    };

    expect(resolution.statusForDay(session, 0, 0)).toBe('completed');
  });

  it('keeps an explicit cross-date link openable so the runner can review or unmatch it', () => {
    const resolution = createActivityResolution([
      {
        id: 'activity-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-12T16:04:00.000Z',
        distance: 12,
        duration: 4316,
        avgPace: 359,
        avgHR: 150,
        splits: [],
        matchedSessionId: 'session-1',
      },
    ]);
    const session = {
      id: 'session-1',
      type: 'LONG' as const,
      date: '2026-04-20',
      distance: 20,
      pace: '5:10',
      actualActivityId: 'activity-1',
    };

    expect(resolution.activityForSession(session)).toMatchObject({ id: 'activity-1' });
    expect(resolution.activityIdForSession(session)).toBe('activity-1');
    expect(resolution.isSessionComplete(session)).toBe(true);
    expect(resolution.completionStatusForSession(session)).toBe('off-target');
    expect(resolution.statusForDay(session, 0, 0)).toBe('off-target');
    expect(resolution.weekActualKm([session])).toBe(12);
  });

  it('ignores a passive matched-session activity when its local date no longer matches the session date', () => {
    const resolution = createActivityResolution([
      {
        id: 'activity-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-12T16:04:00.000Z',
        distance: 12,
        duration: 4316,
        avgPace: 359,
        avgHR: 150,
        splits: [],
        matchedSessionId: 'session-1',
      },
    ]);
    const session = {
      id: 'session-1',
      type: 'LONG' as const,
      date: '2026-04-20',
      distance: 20,
      pace: '5:10',
    };

    expect(resolution.activityForSession(session)).toBeUndefined();
    expect(resolution.activityIdForSession(session)).toBeNull();
    expect(resolution.isSessionComplete(session)).toBe(false);
    expect(resolution.completionStatusForSession(session)).toBeNull();
    expect(resolution.statusForDay(session, 0, 0)).toBe('today');
    expect(resolution.weekActualKm([session])).toBe(0);
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

  it('keeps a range-target run completed when the actual pace lands inside the band', () => {
    const resolution = createActivityResolution([
      {
        id: 'activity-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-15T07:15:00.000Z',
        distance: 10,
        duration: 2450,
        avgPace: 245,
        splits: [],
        matchedSessionId: 'session-1',
      },
    ]);

    expect(
      resolution.statusForDay(
        {
          id: 'session-1',
          type: 'TEMPO',
          date: '2026-04-15',
          distance: 10,
          pace: '4:05',
          intensityTarget: {
            source: 'manual',
            mode: 'both',
            profileKey: 'threshold',
            paceRange: { min: '4:00', max: '4:10' },
            effortCue: 'controlled hard',
          },
          actualActivityId: 'activity-1',
        },
        0,
        0,
      ),
    ).toBe('completed');
  });

  it('marks a range-target run off-target when the actual pace is faster than the band', () => {
    const resolution = createActivityResolution([
      {
        id: 'activity-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-15T07:15:00.000Z',
        distance: 10,
        duration: 2350,
        avgPace: 235,
        splits: [],
        matchedSessionId: 'session-1',
      },
    ]);

    expect(
      resolution.statusForDay(
        {
          id: 'session-1',
          type: 'TEMPO',
          date: '2026-04-15',
          distance: 10,
          pace: '4:05',
          intensityTarget: {
            source: 'manual',
            mode: 'both',
            profileKey: 'threshold',
            paceRange: { min: '4:00', max: '4:10' },
            effortCue: 'controlled hard',
          },
          actualActivityId: 'activity-1',
        },
        0,
        0,
      ),
    ).toBe('off-target');
  });

  it('keeps easy effort-led sessions completed when the run is slower than a guardrail', () => {
    const resolution = createActivityResolution([
      {
        id: 'activity-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-15T07:15:00.000Z',
        distance: 8,
        duration: 3000,
        avgPace: 375,
        avgHR: 136,
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
          pace: '5:45',
          intensityTarget: {
            source: 'profile',
            mode: 'both',
            profileKey: 'recovery',
            paceRange: { min: '5:30', max: '6:00' },
            effortCue: 'very easy',
          },
          actualActivityId: 'activity-1',
        },
        0,
        0,
      ),
    ).toBe('completed');
  });

  it('marks easy effort-led sessions off-target when the run is faster than the guardrail', () => {
    const resolution = createActivityResolution([
      {
        id: 'activity-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-15T07:15:00.000Z',
        distance: 8,
        duration: 2560,
        avgPace: 320,
        avgHR: 146,
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
          pace: '5:45',
          intensityTarget: {
            source: 'profile',
            mode: 'both',
            profileKey: 'recovery',
            paceRange: { min: '5:30', max: '6:00' },
            effortCue: 'very easy',
          },
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

  it('keeps weekly actual distance aligned with rounded row distances', () => {
    const resolution = createActivityResolution([
      {
        id: 'activity-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-15T07:15:00.000Z',
        distance: 12.55,
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
        distance: 9.19,
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
    ).toBe(21.8);
  });

  it('falls back to the planned distance when a linked activity id exists but the activity snapshot has not loaded yet', () => {
    const resolution = createActivityResolution([]);

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
    ).toBe(20);
  });

  it('keeps the linked activity id available for navigation while the activity snapshot has not loaded yet', () => {
    const resolution = createActivityResolution([]);

    expect(
      resolution.activityIdForSession({
        id: 'session-1',
        actualActivityId: 'activity-1',
      }),
    ).toBe('activity-1');
  });
  it('keeps future linked-only sessions upcoming until a date-valid activity is available', () => {
    const resolution = createActivityResolution([], { today: '2026-04-16' });
    const session = {
      id: 'session-1',
      type: 'LONG' as const,
      date: '2026-04-19',
      distance: 20,
      pace: '5:05',
      actualActivityId: 'activity-1',
    };

    expect(resolution.activityIdForSession(session)).toBeNull();
    expect(resolution.isSessionComplete(session)).toBe(false);
    expect(resolution.completionStatusForSession(session)).toBeNull();
    expect(resolution.statusForDay(session, 6, 2)).toBe('upcoming');
  });

  it('does not count future linked-only sessions toward weekly actual load', () => {
    const resolution = createActivityResolution([], { today: '2026-04-16' });

    expect(
      resolution.weekActualKm([
        {
          id: 'session-1',
          type: 'EASY',
          date: '2026-04-14',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'activity-1',
        },
        {
          id: 'session-2',
          type: 'LONG',
          date: '2026-04-19',
          distance: 20,
          pace: '5:05',
          actualActivityId: 'activity-2',
        },
      ]),
    ).toBe(8);
  });
});
