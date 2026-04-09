import { describe, expect, it } from 'vitest';
import {
  getBlockVolumeTone,
  getWeekVolumeSummary,
  type Activity,
  type PlanWeek,
  type PlannedSession,
} from '@steady/types';

function makeSession(overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: crypto.randomUUID(),
    type: 'EASY',
    date: '2026-04-07',
    distance: 8,
    pace: '5:20',
    ...overrides,
  };
}

function makeActivity(id: string, distance: number): Activity {
  return {
    id,
    userId: 'user-1',
    source: 'strava',
    externalId: `ext-${id}`,
    startTime: '2026-04-07T07:00:00Z',
    distance,
    duration: 3600,
    avgPace: 300,
    splits: [{ km: 1, pace: 300 }],
  };
}

describe('getWeekVolumeSummary', () => {
  const week: PlanWeek = {
    weekNumber: 2,
    phase: 'BUILD',
    plannedKm: 40,
    sessions: [
      makeSession({ distance: 8, actualActivityId: 'act-1' }),
      makeSession({ distance: 10, actualActivityId: 'act-2' }),
      makeSession({ distance: 6 }),
      null,
      null,
      null,
      null,
    ],
  };

  it('uses actual distance for past weeks when matched activities exist', () => {
    const activitiesById = new Map([
      ['act-1', makeActivity('act-1', 7.8)],
      ['act-2', makeActivity('act-2', 10.4)],
    ]);

    const summary = getWeekVolumeSummary(week, activitiesById, getBlockVolumeTone(0, 2));

    expect(summary).toMatchObject({
      plannedKm: 40,
      actualKm: 18.2,
      showActual: true,
      barKm: 18.2,
    });
  });

  it('falls back to planned distance when no matched activities are available', () => {
    const summary = getWeekVolumeSummary(week, new Map(), getBlockVolumeTone(0, 2));

    expect(summary).toMatchObject({
      plannedKm: 40,
      actualKm: null,
      showActual: false,
      barKm: 40,
    });
  });

  it('keeps future weeks planned-only even if activities exist', () => {
    const activitiesById = new Map([['act-1', makeActivity('act-1', 7.8)]]);

    const summary = getWeekVolumeSummary(week, activitiesById, getBlockVolumeTone(3, 2));

    expect(summary).toMatchObject({
      plannedKm: 40,
      actualKm: null,
      showActual: false,
      barKm: 40,
    });
  });
});
