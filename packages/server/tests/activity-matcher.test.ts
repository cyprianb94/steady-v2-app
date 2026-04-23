import { describe, it, expect } from 'vitest';
import { matchActivity } from '../src/lib/activity-matcher';
import type { Activity, PlannedSession, PlanWeek } from '@steady/types';

// --- Helpers ---

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'act-1',
    userId: 'u1',
    source: 'strava',
    externalId: 'ext-1',
    startTime: '2026-03-22T07:00:00Z',
    distance: 8,
    duration: 45 * 60, // 45 min
    avgPace: 338, // ~5:38/km
    splits: [],
    ...overrides,
  };
}

function makeSession(overrides: Partial<PlannedSession> & { type: PlannedSession['type'] }): PlannedSession {
  return { id: `s-${overrides.type}-${Math.random().toString(36).slice(2, 6)}`, date: '2026-03-22', ...overrides };
}

function weekWith(...sessions: (PlannedSession | null)[]): PlanWeek {
  return { weekNumber: 1, phase: 'BUILD', sessions, plannedKm: 0 };
}

// --- Tests ---

describe('matchActivity — date matching', () => {
  it('matches activity to session on same date', () => {
    const session = makeSession({ type: 'EASY', distance: 8 });
    const week = weekWith(session);
    const activity = makeActivity({ startTime: '2026-03-22T07:00:00Z' });

    expect(matchActivity(activity, [week])).toBe(session);
  });

  it('returns null when no session on that date', () => {
    const session = makeSession({ type: 'EASY', distance: 8, date: '2026-03-23' });
    const week = weekWith(session);
    const activity = makeActivity({ startTime: '2026-03-22T07:00:00Z' });

    expect(matchActivity(activity, [week])).toBeNull();
  });

  it('skips REST sessions', () => {
    const rest = makeSession({ type: 'REST' });
    const week = weekWith(rest);
    const activity = makeActivity();

    expect(matchActivity(activity, [week])).toBeNull();
  });
});

describe('matchActivity — short activity filter', () => {
  it('returns null for activities under 20 minutes', () => {
    const session = makeSession({ type: 'EASY', distance: 5 });
    const week = weekWith(session);
    const activity = makeActivity({ duration: 15 * 60, distance: 3 });

    expect(matchActivity(activity, [week])).toBeNull();
  });

  it('matches activities exactly 20 minutes', () => {
    const session = makeSession({ type: 'EASY', distance: 5 });
    const week = weekWith(session);
    const activity = makeActivity({ duration: 20 * 60, distance: 4 });

    expect(matchActivity(activity, [week])).toBe(session);
  });
});

describe('matchActivity — already matched exclusion', () => {
  it('skips sessions with actualActivityId set', () => {
    const matched = makeSession({ type: 'EASY', distance: 8, actualActivityId: 'act-prev' });
    const unmatched = makeSession({ type: 'EASY', distance: 10 });
    const week = weekWith(matched, unmatched);
    const activity = makeActivity({ distance: 8 });

    const result = matchActivity(activity, [week]);
    expect(result).toBe(unmatched);
  });

  it('skips sessions in alreadyMatchedIds set', () => {
    const s1 = makeSession({ type: 'EASY', distance: 8 });
    const s2 = makeSession({ type: 'EASY', distance: 10 });
    const week = weekWith(s1, s2);
    const activity = makeActivity({ distance: 8 });

    const result = matchActivity(activity, [week], new Set([s1.id]));
    expect(result).toBe(s2);
  });
});

describe('matchActivity — type inference: INTERVAL', () => {
  it('infers INTERVAL from high pace variation + elevated HR', () => {
    const intervalSession = makeSession({
      type: 'INTERVAL',
      reps: 6,
      repDist: 800,
      warmup: { unit: 'km', value: 1.5 },
      cooldown: { unit: 'km', value: 1 },
    });
    const easySession = makeSession({ type: 'EASY', distance: 7 });
    const week = weekWith(intervalSession, easySession);

    // Simulate interval activity: alternating fast/slow splits
    const splits = [
      { km: 1, pace: 300, hr: 170 }, // warmup
      { km: 2, pace: 210, hr: 185 }, // fast rep
      { km: 3, pace: 360, hr: 150 }, // recovery
      { km: 4, pace: 215, hr: 183 }, // fast rep
      { km: 5, pace: 355, hr: 148 }, // recovery
      { km: 6, pace: 208, hr: 187 }, // fast rep
      { km: 7, pace: 320, hr: 160 }, // cooldown
    ];
    const activity = makeActivity({ distance: 7, avgHR: 168, splits, duration: 35 * 60 });

    expect(matchActivity(activity, [week])).toBe(intervalSession);
  });
});

describe('matchActivity — type inference: TEMPO', () => {
  it('infers TEMPO from sustained high HR', () => {
    const tempoSession = makeSession({
      type: 'TEMPO',
      distance: 10,
      warmup: { unit: 'km', value: 2 },
      cooldown: { unit: 'km', value: 1.5 },
    });
    const easySession = makeSession({ type: 'EASY', distance: 10 });
    const week = weekWith(tempoSession, easySession);

    const splits = Array.from({ length: 10 }, (_, i) => ({
      km: i + 1,
      pace: 260,
      hr: i < 2 ? 155 : 172, // warmup then sustained high
    }));
    const activity = makeActivity({ distance: 13, avgHR: 170, splits, duration: 55 * 60 });

    expect(matchActivity(activity, [week])).toBe(tempoSession);
  });

  it('infers TEMPO from avgHR when no split HR data', () => {
    const tempoSession = makeSession({
      type: 'TEMPO',
      distance: 10,
      warmup: { unit: 'km', value: 2 },
      cooldown: { unit: 'km', value: 1.5 },
    });
    const easySession = makeSession({ type: 'EASY', distance: 10 });
    const week = weekWith(tempoSession, easySession);

    const activity = makeActivity({ distance: 13, avgHR: 170, splits: [], duration: 55 * 60 });

    expect(matchActivity(activity, [week])).toBe(tempoSession);
  });
});

describe('matchActivity — type inference: LONG', () => {
  it('infers LONG from distance >16km', () => {
    const longSession = makeSession({ type: 'LONG', distance: 22 });
    const easySession = makeSession({ type: 'EASY', distance: 10 });
    const week = weekWith(longSession, easySession);

    const activity = makeActivity({ distance: 20, avgHR: 145, duration: 110 * 60 });

    expect(matchActivity(activity, [week])).toBe(longSession);
  });
});

describe('matchActivity — type inference: EASY', () => {
  it('infers EASY for moderate distance and HR', () => {
    const easySession = makeSession({ type: 'EASY', distance: 8 });
    const week = weekWith(easySession);

    const activity = makeActivity({ distance: 8, avgHR: 140, duration: 45 * 60 });

    expect(matchActivity(activity, [week])).toBe(easySession);
  });
});

describe('matchActivity — disambiguation by distance', () => {
  it('picks closest distance when multiple same-type sessions', () => {
    const s1 = makeSession({ type: 'EASY', distance: 6 });
    const s2 = makeSession({ type: 'EASY', distance: 12 });
    const week = weekWith(s1, s2);

    const activity = makeActivity({ distance: 11, avgHR: 140 });

    expect(matchActivity(activity, [week])).toBe(s2);
  });

  it('disambiguates INTERVAL by expected distance (reps * repDist + wu + cd)', () => {
    const s1 = makeSession({
      type: 'INTERVAL',
      reps: 4,
      repDist: 400,
      warmup: { unit: 'km', value: 1.5 },
      cooldown: { unit: 'km', value: 1 },
    });
    // expected: 4*0.4 + 1.5 + 1 = 4.1km
    const s2 = makeSession({
      type: 'INTERVAL',
      reps: 6,
      repDist: 1000,
      warmup: { unit: 'km', value: 2 },
      cooldown: { unit: 'km', value: 1.5 },
    });
    // expected: 6*1 + 2 + 1.5 = 9.5km
    const week = weekWith(s1, s2);

    // Simulate interval activity with high pace variation
    const splits = Array.from({ length: 8 }, (_, i) => ({
      km: i + 1,
      pace: i % 2 === 0 ? 220 : 360,
      hr: i % 2 === 0 ? 180 : 150,
    }));
    const activity = makeActivity({ distance: 8.5, avgHR: 165, splits, duration: 50 * 60 });

    expect(matchActivity(activity, [week])).toBe(s2);
  });
});

describe('matchActivity — across multiple weeks', () => {
  it('searches all weeks for the matching date', () => {
    const s1 = makeSession({ type: 'EASY', distance: 8, date: '2026-03-15' });
    const s2 = makeSession({ type: 'LONG', distance: 20, date: '2026-03-22' });
    const week1 = weekWith(s1);
    const week2 = weekWith(s2);

    const activity = makeActivity({ distance: 19, duration: 100 * 60 });

    expect(matchActivity(activity, [week1, week2])).toBe(s2);
  });
});
