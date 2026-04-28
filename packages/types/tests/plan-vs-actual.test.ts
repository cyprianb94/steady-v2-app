import { describe, expect, it } from 'vitest';
import type { Activity, PlannedSession } from '../src';
import { summariseVsPlan } from '../src/plan-vs-actual';

function makeSession(overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'session-1',
    type: 'EASY',
    date: '2026-04-10',
    distance: 8,
    pace: '5:30',
    ...overrides,
  };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    userId: 'user-1',
    source: 'strava',
    externalId: 'strava-1',
    startTime: '2026-04-10T07:00:00Z',
    distance: 8.12,
    duration: 2647,
    avgPace: 326,
    avgHR: 142,
    splits: [],
    ...overrides,
  };
}

describe('summariseVsPlan', () => {
  it.each([
    ['on-target', makeActivity()],
    ['crushed-it', makeActivity({ distance: 8.6, avgPace: 320, avgHR: 148 })],
    ['eased-in', makeActivity({ avgPace: 341, avgHR: 138 })],
    ['cut-short', makeActivity({ distance: 6.7, duration: 2234, avgPace: 333, avgHR: 144 })],
    ['bonus-effort', makeActivity({ distance: 8.6, duration: 2891, avgPace: 336, avgHR: 146 })],
    ['under-distance', makeActivity({ distance: 7.4, duration: 2457, avgPace: 332, avgHR: 145 })],
    ['over-pace', makeActivity({ avgPace: 324, avgHR: 147 })],
    ['hr-high', makeActivity({ avgPace: 330, avgHR: 151 })],
  ] as const)('returns %s for the expected fixture', (headline, activity) => {
    expect(summariseVsPlan(makeSession(), activity).headline).toBe(headline);
  });

  it('keeps runs within exactly ±5% distance tolerance on target', () => {
    expect(
      summariseVsPlan(makeSession(), makeActivity({ distance: 7.6, duration: 2478, avgPace: 326 })).headline,
    ).toBe('on-target');
    expect(
      summariseVsPlan(makeSession(), makeActivity({ distance: 8.4, duration: 2738, avgPace: 326 })).headline,
    ).toBe('on-target');
  });

  it('treats exactly 15% short as cut-short', () => {
    expect(
      summariseVsPlan(makeSession(), makeActivity({ distance: 6.8, duration: 2248, avgPace: 330 })).headline,
    ).toBe('cut-short');
  });

  it('treats exactly 5 sec/km fast and 10 sec/km slow as on-target boundaries', () => {
    expect(summariseVsPlan(makeSession(), makeActivity({ avgPace: 325, avgHR: 145 })).headline).toBe('on-target');
    expect(summariseVsPlan(makeSession(), makeActivity({ avgPace: 340, avgHR: 145 })).headline).toBe('on-target');
  });

  it('treats heart rate at 150 as on-target and above 150 as hr-high', () => {
    expect(summariseVsPlan(makeSession(), makeActivity({ avgHR: 150, avgPace: 330 })).headline).toBe('on-target');
    expect(summariseVsPlan(makeSession(), makeActivity({ avgHR: 151, avgPace: 330 })).headline).toBe('hr-high');
  });

  it('returns verdicts in distance, pace, hr order with stable fact strings', () => {
    expect(summariseVsPlan(makeSession(), makeActivity()).verdicts).toEqual([
      { kind: 'distance', status: 'ok', fact: 'On target distance' },
      { kind: 'pace', status: 'ok', fact: 'Pace 4 sec/km faster than planned' },
      { kind: 'hr', status: 'ok', fact: 'HR sat in Zone 2 throughout' },
    ]);
  });

  it('renders planned-vs-actual rows with the expected labels and units', () => {
    expect(summariseVsPlan(makeSession(), makeActivity()).rows).toEqual([
      { label: 'Distance', planned: '8.0 km', actual: '8.12 km' },
      { label: 'Pace', planned: '5:30', actual: '5:26' },
      { label: 'Heart rate', planned: 'Zone 2', actual: '142 bpm' },
    ]);
  });

  it('treats a structured pace range as a band for pace verdicts', () => {
    const session = makeSession({
      type: 'TEMPO',
      distance: 10,
      pace: '4:05',
      intensityTarget: {
        source: 'manual',
        mode: 'both',
        profileKey: 'threshold',
        paceRange: { min: '4:00', max: '4:10' },
        effortCue: 'controlled hard',
      },
    });

    expect(summariseVsPlan(session, makeActivity({ distance: 10, avgPace: 245, avgHR: 164 })).headline).toBe('on-target');
    expect(summariseVsPlan(session, makeActivity({ distance: 10, avgPace: 235, avgHR: 164 })).headline).toBe('over-pace');
    expect(summariseVsPlan(session, makeActivity({ distance: 10, avgPace: 260, avgHR: 164 })).headline).toBe('eased-in');
    expect(summariseVsPlan(session, makeActivity({ distance: 10, avgPace: 245, avgHR: 164 })).rows).toContainEqual({
      label: 'Pace',
      planned: '4:00-4:10',
      actual: '4:05',
    });
  });

  it('does not invent a pace grade for effort-only targets', () => {
    const result = summariseVsPlan(
      makeSession({
        pace: undefined,
        intensityTarget: {
          source: 'manual',
          mode: 'effort',
          profileKey: 'easy',
          effortCue: 'conversational',
        },
      }),
      makeActivity({ distance: 8.1, avgPace: 410, avgHR: 142 }),
    );

    expect(result.headline).toBe('on-target');
    expect(result.verdicts.some((verdict) => verdict.kind === 'pace')).toBe(false);
    expect(result.rows.some((row) => row.label === 'Pace')).toBe(false);
  });

  it('does not punish easy effort-led sessions for being slower than a pace guardrail', () => {
    const session = makeSession({
      pace: '5:45',
      intensityTarget: {
        source: 'profile',
        mode: 'both',
        profileKey: 'recovery',
        paceRange: { min: '5:30', max: '6:00' },
        effortCue: 'very easy',
      },
    });

    expect(summariseVsPlan(session, makeActivity({ distance: 8, avgPace: 375, avgHR: 136 })).headline).toBe('on-target');
    expect(summariseVsPlan(session, makeActivity({ distance: 8, avgPace: 320, avgHR: 146 })).headline).toBe('over-pace');
  });

  it('is pure for identical inputs', () => {
    const session = makeSession();
    const activity = makeActivity();

    expect(summariseVsPlan(session, activity)).toEqual(summariseVsPlan(session, activity));
  });
});
