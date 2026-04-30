import { describe, expect, it } from 'vitest';
import type { Activity, PlannedSession } from '../src';
import {
  buildWeeklyVolumeSummary,
  getWeeklyVolumeDayMetric,
} from '../src/lib/weekly-volume';

function session(overrides: Partial<PlannedSession>): PlannedSession {
  return {
    id: 'session-1',
    type: 'EASY',
    date: '2026-04-06',
    distance: 8,
    pace: '5:00',
    ...overrides,
  };
}

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: 'activity-1',
    userId: 'user-1',
    source: 'strava',
    externalId: 'strava-1',
    startTime: '2026-04-06T07:00:00.000Z',
    distance: 8.2,
    duration: 2480,
    avgPace: 302,
    splits: [],
    ...overrides,
  };
}

describe('buildWeeklyVolumeSummary', () => {
  it('summarises planned and actual distance for a week', () => {
    const summary = buildWeeklyVolumeSummary({
      today: '2026-04-08',
      weekStartDate: '2026-04-06',
      sessions: [
        session({ id: 'mon', actualActivityId: 'activity-1' }),
        null,
        session({ id: 'wed', date: '2026-04-08', distance: 10, type: 'TEMPO', pace: '4:20' }),
        null,
        null,
        session({ id: 'sat', date: '2026-04-11', distance: 12 }),
        session({ id: 'sun', date: '2026-04-12', type: 'LONG', distance: 20, pace: '5:15' }),
      ],
      activities: [activity({ id: 'activity-1', matchedSessionId: 'mon' })],
    });

    expect(summary.plannedDistanceKm).toBe(50);
    expect(summary.actualDistanceKm).toBe(8.2);
    expect(summary.days[0]).toMatchObject({
      plannedDistanceKm: 8,
      actualDistanceKm: 8.2,
      status: 'over',
    });
    expect(summary.days[1]).toMatchObject({
      plannedDistanceKm: 0,
      actualDistanceKm: 0,
      status: 'rest',
    });
  });

  it('keeps weekly actual distance aligned with the visible rounded day distances', () => {
    const summary = buildWeeklyVolumeSummary({
      today: '2026-04-08',
      weekStartDate: '2026-04-06',
      sessions: [
        session({ id: 'mon', actualActivityId: 'activity-1' }),
        session({ id: 'tue', date: '2026-04-07', actualActivityId: 'activity-2' }),
      ],
      activities: [
        activity({
          id: 'activity-1',
          matchedSessionId: 'mon',
          distance: 12.55,
        }),
        activity({
          id: 'activity-2',
          matchedSessionId: 'tue',
          startTime: '2026-04-07T07:00:00.000Z',
          distance: 9.19,
        }),
      ],
    });

    expect(summary.days[0].actualDistanceKm).toBe(12.6);
    expect(summary.days[1].actualDistanceKm).toBe(9.2);
    expect(summary.actualDistanceKm).toBe(21.8);
  });

  it('estimates planned time from planned pace and uses synced activity duration', () => {
    const summary = buildWeeklyVolumeSummary({
      today: '2026-04-06',
      weekStartDate: '2026-04-06',
      sessions: [session({ id: 'mon', actualActivityId: 'activity-1' })],
      activities: [activity({ id: 'activity-1', duration: 2500 })],
    });

    expect(summary.plannedSeconds).toBe(2400);
    expect(summary.actualSeconds).toBe(2500);
    expect(getWeeklyVolumeDayMetric(summary.days[0], 'time')).toEqual({
      planned: 2400,
      actual: 2500,
      over: 100,
    });
  });

  it('includes interval reps, recoveries, warm-up, and cool-down in planned time', () => {
    const summary = buildWeeklyVolumeSummary({
      today: '2026-04-06',
      weekStartDate: '2026-04-06',
      sessions: [
        session({
          id: 'intervals',
          type: 'INTERVAL',
          reps: 6,
          repDist: 800,
          recovery: '90s',
          warmup: { unit: 'km', value: 1 },
          cooldown: { unit: 'km', value: 1 },
          pace: '4:00',
          distance: undefined,
        }),
      ],
    });

    expect(summary.days[0].plannedSeconds).toBe(2352);
  });

  it('marks missed, planned, and upcoming days without actual activity', () => {
    const summary = buildWeeklyVolumeSummary({
      today: '2026-04-09',
      weekStartDate: '2026-04-06',
      sessions: [
        session({ id: 'mon' }),
        null,
        null,
        session({ id: 'thu', date: '2026-04-09' }),
        session({ id: 'fri', date: '2026-04-10' }),
      ],
    });

    expect(summary.days[0].status).toBe('missed');
    expect(summary.days[3].status).toBe('planned');
    expect(summary.days[4].status).toBe('upcoming');
  });

  it('keeps future linked-only sessions out of actual volume but counts past linked sessions while the snapshot catches up', () => {
    const summary = buildWeeklyVolumeSummary({
      today: '2026-04-09',
      weekStartDate: '2026-04-06',
      sessions: [
        session({ id: 'mon', actualActivityId: 'pending-mon' }),
        null,
        null,
        null,
        session({ id: 'fri', date: '2026-04-10', actualActivityId: 'pending-fri' }),
      ],
    });

    expect(summary.days[0]).toMatchObject({
      actualDistanceKm: 8,
      actualSeconds: 2400,
      status: 'completed',
    });
    expect(summary.days[4]).toMatchObject({
      actualDistanceKm: 0,
      actualSeconds: 0,
      status: 'upcoming',
    });
    expect(summary.actualDistanceKm).toBe(8);
  });

  it('counts an explicit cross-date match against the linked session', () => {
    const summary = buildWeeklyVolumeSummary({
      today: '2026-04-09',
      weekStartDate: '2026-04-06',
      sessions: [
        null,
        null,
        session({ id: 'wed', date: '2026-04-08', actualActivityId: 'activity-1' }),
      ],
      activities: [
        activity({
          id: 'activity-1',
          matchedSessionId: 'wed',
          startTime: '2026-04-07T18:00:00.000Z',
          distance: 8.2,
          duration: 2480,
        }),
      ],
    });

    expect(summary.days[2]).toMatchObject({
      actualDistanceKm: 8.2,
      actualSeconds: 2480,
      status: 'over',
    });
    expect(summary.actualDistanceKm).toBe(8.2);
  });

  it('ignores a passive cross-date matched-session activity', () => {
    const summary = buildWeeklyVolumeSummary({
      today: '2026-04-09',
      weekStartDate: '2026-04-06',
      sessions: [
        null,
        null,
        session({ id: 'wed', date: '2026-04-08' }),
      ],
      activities: [
        activity({
          id: 'activity-1',
          matchedSessionId: 'wed',
          startTime: '2026-04-07T18:00:00.000Z',
          distance: 8.2,
          duration: 2480,
        }),
      ],
    });

    expect(summary.days[2]).toMatchObject({
      actualDistanceKm: 0,
      actualSeconds: 0,
      status: 'missed',
    });
    expect(summary.actualDistanceKm).toBe(0);
  });

  it('exposes exact distance overrun for chart tooltips', () => {
    const summary = buildWeeklyVolumeSummary({
      today: '2026-04-06',
      weekStartDate: '2026-04-06',
      sessions: [session({ id: 'mon', actualActivityId: 'activity-1' })],
      activities: [activity({ id: 'activity-1', distance: 10.7 })],
    });

    expect(getWeeklyVolumeDayMetric(summary.days[0], 'distance')).toEqual({
      planned: 8,
      actual: 10.7,
      over: 2.7,
    });
  });
});
