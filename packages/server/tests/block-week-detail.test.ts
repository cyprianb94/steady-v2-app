import { describe, expect, it } from 'vitest';
import {
  buildBlockWeekDayDetails,
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

describe('buildBlockWeekDayDetails', () => {
  it('returns seven day rows with readable session labels', () => {
    const week: PlanWeek = {
      weekNumber: 3,
      phase: 'BUILD',
      plannedKm: 42,
      sessions: [
        makeSession({ type: 'EASY', date: '2026-04-06', distance: 8 }),
        makeSession({ type: 'INTERVAL', date: '2026-04-07', reps: 6, repDist: 800, recovery: '90s' }),
        { ...makeSession({ type: 'REST', date: '2026-04-08' }), distance: undefined, pace: undefined },
        makeSession({ type: 'TEMPO', date: '2026-04-09', distance: 10 }),
        makeSession({ type: 'EASY', date: '2026-04-10', distance: 6, actualActivityId: 'act-1' }),
        makeSession({ type: 'LONG', date: '2026-04-11', distance: 18 }),
        null,
      ],
    };

    const details = buildBlockWeekDayDetails(week);

    expect(details).toHaveLength(7);
    expect(details[0]).toMatchObject({
      dayLabel: 'Mon',
      sessionLabel: 'Easy Run',
      distanceLabel: '8km',
      status: 'upcoming',
    });
    expect(details[1]).toMatchObject({
      dayLabel: 'Tue',
      sessionLabel: 'Intervals',
      distanceLabel: '6×800m',
    });
    expect(details[3]).toMatchObject({
      dayLabel: 'Thu',
      sessionLabel: 'Tempo',
      distanceLabel: '10km',
    });
  });

  it('treats rest slots as muted rows with no distance', () => {
    const week: PlanWeek = {
      weekNumber: 1,
      phase: 'BASE',
      plannedKm: 30,
      sessions: [null, null, null, null, null, null, null],
    };

    const details = buildBlockWeekDayDetails(week);

    expect(details[2]).toMatchObject({
      dayLabel: 'Wed',
      sessionLabel: 'Rest',
      distanceLabel: null,
      status: 'upcoming',
      isRest: true,
    });
  });

  it('marks rows with matched activities as completed', () => {
    const week: PlanWeek = {
      weekNumber: 4,
      phase: 'PEAK',
      plannedKm: 50,
      sessions: [
        makeSession({ date: '2026-04-13' }),
        makeSession({ date: '2026-04-14', actualActivityId: 'act-42' }),
        null,
        null,
        null,
        null,
        null,
      ],
    };

    const details = buildBlockWeekDayDetails(week);

    expect(details[1].status).toBe('completed');
  });
});
