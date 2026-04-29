import { describe, expect, it } from 'vitest';
import type { Activity, PlannedSession } from '../src';
import { buildStructuredQualitySummary } from '../src';

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    userId: 'user-1',
    source: 'garmin',
    externalId: 'garmin-1',
    startTime: '2026-04-10T07:00:00Z',
    distance: 7,
    duration: 2100,
    avgPace: 300,
    avgHR: 150,
    splits: [],
    ...overrides,
  };
}

function makeSession(overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'session-1',
    type: 'INTERVAL',
    date: '2026-04-10',
    reps: 4,
    repDist: 800,
    recovery: { unit: 'km', value: 0.4 },
    warmup: { unit: 'km', value: 1.2 },
    cooldown: { unit: 'km', value: 1 },
    intensityTarget: {
      source: 'manual',
      mode: 'pace',
      paceRange: { min: '3:45', max: '3:55' },
    },
    ...overrides,
  };
}

describe('buildStructuredQualitySummary', () => {
  it('summarises interval quality from work reps only', () => {
    const summary = buildStructuredQualitySummary(
      makeSession(),
      makeActivity({
        distance: 7,
        duration: 2181,
        avgPace: 312,
        avgHR: 151,
        splits: [
          { km: 1, label: 'Warm up', distance: 1.2, pace: 360, hr: 132 },
          { km: 2, label: 'Rep 1', distance: 0.8, pace: 230, hr: 166 },
          { km: 3, label: 'Recovery 1', distance: 0.4, pace: 390, hr: 150 },
          { km: 4, label: 'Rep 2', distance: 0.8, pace: 232, hr: 168 },
          { km: 5, label: 'Recovery 2', distance: 0.4, pace: 395, hr: 149 },
          { km: 6, label: 'Rep 3', distance: 0.8, pace: 234, hr: 170 },
          { km: 7, label: 'Recovery 3', distance: 0.4, pace: 400, hr: 148 },
          { km: 8, label: 'Rep 4', distance: 0.8, pace: 224, hr: 172 },
          { km: 9, label: 'Recovery 4', distance: 0.4, pace: 410, hr: 147 },
          { km: 10, label: 'Cool down', distance: 1, pace: 370, hr: 140 },
        ],
      }),
    );

    expect(summary).toEqual({
      status: 'available',
      sessionType: 'INTERVAL',
      qualityDistanceKm: 3.2,
      averagePaceSecondsPerKm: 230,
      averageHeartRateBpm: 169,
      intervalReps: {
        planned: 4,
        found: 4,
        inTargetRange: 3,
      },
      targetPaceRange: {
        min: '3:45',
        max: '3:55',
        minSecondsPerKm: 225,
        maxSecondsPerKm: 235,
      },
    });
  });

  it('does not use full-run averages when interval lap data is insufficient', () => {
    expect(
      buildStructuredQualitySummary(
        makeSession(),
        makeActivity({
          distance: 7,
          duration: 2181,
          avgPace: 312,
          avgHR: 151,
          splits: [],
        }),
      ),
    ).toEqual({
      status: 'unavailable',
      sessionType: 'INTERVAL',
      reason: 'insufficient-structured-data',
    });
  });

  it('does not treat same-distance warmup and cooldown splits as interval reps', () => {
    expect(
      buildStructuredQualitySummary(
        makeSession({
          reps: 3,
          repDist: 1000,
          recovery: { unit: 'km', value: 0.5 },
          warmup: { unit: 'km', value: 1 },
          cooldown: { unit: 'km', value: 1 },
        }),
        makeActivity({
          distance: 5.5,
          duration: 1850,
          avgPace: 336,
          avgHR: 150,
          splits: [
            { km: 1, distance: 1, pace: 360, hr: 132 },
            { km: 2, distance: 1, pace: 238, hr: 166 },
            { km: 3, distance: 1, pace: 241, hr: 170 },
            { km: 4, distance: 1, pace: 244, hr: 172 },
            { km: 5, distance: 1, pace: 370, hr: 140 },
          ],
        }),
      ),
    ).toEqual({
      status: 'unavailable',
      sessionType: 'INTERVAL',
      reason: 'insufficient-structured-data',
    });
  });

  it('summarises interval reps when recorded recovery distances vary', () => {
    const summary = buildStructuredQualitySummary(
      makeSession({
        reps: 6,
        repDist: 400,
        recovery: { unit: 'min', value: 1 },
        warmup: { unit: 'km', value: 2 },
        cooldown: undefined,
        intensityTarget: {
          source: 'manual',
          mode: 'pace',
          paceRange: { min: '3:35', max: '3:50' },
        },
      }),
      makeActivity({
        splits: [
          { km: 1, distance: 2.01, pace: 435, hr: 139 },
          { km: 2, distance: 0.405, pace: 225, hr: 180 },
          { km: 3, distance: 0.258, pace: 344, hr: 169 },
          { km: 4, distance: 0.405, pace: 215, hr: 184 },
          { km: 5, distance: 0.197, pace: 452, hr: 171 },
          { km: 6, distance: 0.399, pace: 218, hr: 184 },
          { km: 7, distance: 0.210, pace: 424, hr: 172 },
          { km: 8, distance: 0.394, pace: 223, hr: 182 },
          { km: 9, distance: 0.190, pace: 467, hr: 171 },
          { km: 10, distance: 0.399, pace: 226, hr: 182 },
          { km: 11, distance: 0.207, pace: 431, hr: 173 },
          { km: 12, distance: 0.411, pace: 217, hr: 185 },
          { km: 13, distance: 0.243, pace: 366, hr: 179 },
          { km: 14, distance: 2, pace: 355, hr: 155 },
          { km: 15, distance: 1.43, pace: 363, hr: 150 },
        ],
      }),
    );

    expect(summary).toMatchObject({
      status: 'available',
      sessionType: 'INTERVAL',
      qualityDistanceKm: 2.41,
      averagePaceSecondsPerKm: 221,
      averageHeartRateBpm: 183,
      intervalReps: {
        planned: 6,
        found: 6,
        inTargetRange: 6,
      },
    });
  });

  it('does not mistake same-distance warmup and cooldown laps for interval work reps', () => {
    const summary = buildStructuredQualitySummary(
      makeSession({
        reps: 3,
        warmup: { unit: 'km', value: 0.8 },
        cooldown: { unit: 'km', value: 0.8 },
      }),
      makeActivity({
        splits: [
          { km: 1, label: 'Warm up', distance: 0.8, pace: 360, hr: 132 },
          { km: 2, label: 'Rep 1', distance: 0.8, pace: 230, hr: 166 },
          { km: 3, label: 'Recovery 1', distance: 0.4, pace: 390, hr: 150 },
          { km: 4, label: 'Rep 2', distance: 0.8, pace: 232, hr: 168 },
          { km: 5, label: 'Recovery 2', distance: 0.4, pace: 395, hr: 149 },
          { km: 6, label: 'Rep 3', distance: 0.8, pace: 234, hr: 170 },
          { km: 7, label: 'Recovery 3', distance: 0.4, pace: 400, hr: 148 },
          { km: 8, label: 'Cool down', distance: 0.8, pace: 370, hr: 140 },
        ],
      }),
    );

    expect(summary).toMatchObject({
      status: 'available',
      sessionType: 'INTERVAL',
      qualityDistanceKm: 2.4,
      averagePaceSecondsPerKm: 232,
      averageHeartRateBpm: 168,
      intervalReps: {
        planned: 3,
        found: 3,
        inTargetRange: 3,
      },
    });
  });

  it('keeps target range fields unknown when the planned session has no pace target', () => {
    const summary = buildStructuredQualitySummary(
      makeSession({
        reps: 2,
        warmup: undefined,
        cooldown: undefined,
        intensityTarget: undefined,
        pace: undefined,
      }),
      makeActivity({
        splits: [
          { km: 1, label: 'Rep 1', distance: 0.8, pace: 230, hr: 166 },
          { km: 2, label: 'Recovery 1', distance: 0.4, pace: 390, hr: 150 },
          { km: 3, label: 'Rep 2', distance: 0.8, pace: 232, hr: 168 },
          { km: 4, label: 'Recovery 2', distance: 0.4, pace: 395, hr: 149 },
        ],
      }),
    );

    expect(summary).toMatchObject({
      status: 'available',
      sessionType: 'INTERVAL',
      targetPaceRange: null,
      intervalReps: {
        planned: 2,
        found: 2,
        inTargetRange: null,
      },
    });
  });

  it.each(['EASY', 'LONG'] as const)('returns not-applicable for %s sessions', (type) => {
    expect(
      buildStructuredQualitySummary(
        makeSession({
          type,
          reps: undefined,
          repDist: undefined,
          recovery: undefined,
          warmup: undefined,
          cooldown: undefined,
          distance: type === 'EASY' ? 8 : 24,
          pace: '5:20',
        }),
        makeActivity({ avgPace: 320, avgHR: 142 }),
      ),
    ).toEqual({
      status: 'not-applicable',
      sessionType: type,
      reason: 'not-structured-quality-session',
    });
  });

  it('summarises tempo quality from the planned tempo block only', () => {
    const summary = buildStructuredQualitySummary(
      makeSession({
        type: 'TEMPO',
        reps: undefined,
        repDist: undefined,
        recovery: undefined,
        distance: 5,
        warmup: { unit: 'km', value: 2 },
        cooldown: { unit: 'km', value: 1 },
        intensityTarget: {
          source: 'manual',
          mode: 'both',
          paceRange: { min: '4:05', max: '4:15' },
          effortCue: 'controlled hard',
        },
      }),
      makeActivity({
        distance: 8,
        duration: 2360,
        avgPace: 295,
        avgHR: 153,
        splits: [
          { km: 1, distance: 1, pace: 360, hr: 132 },
          { km: 2, distance: 1, pace: 345, hr: 140 },
          { km: 3, distance: 1, pace: 250, hr: 162 },
          { km: 4, distance: 1, pace: 248, hr: 164 },
          { km: 5, distance: 1, pace: 252, hr: 165 },
          { km: 6, distance: 1, pace: 251, hr: 166 },
          { km: 7, distance: 1, pace: 249, hr: 163 },
          { km: 8, distance: 1, pace: 355, hr: 142 },
        ],
      }),
    );

    expect(summary).toEqual({
      status: 'available',
      sessionType: 'TEMPO',
      qualityDistanceKm: 5,
      averagePaceSecondsPerKm: 250,
      averageHeartRateBpm: 164,
      targetPaceRange: {
        min: '4:05',
        max: '4:15',
        minSecondsPerKm: 245,
        maxSecondsPerKm: 255,
      },
    });
  });

  it('does not use full-run averages when tempo block data is insufficient', () => {
    expect(
      buildStructuredQualitySummary(
        makeSession({
          type: 'TEMPO',
          reps: undefined,
          repDist: undefined,
          recovery: undefined,
          distance: 5,
          warmup: { unit: 'min', value: 10 },
          cooldown: { unit: 'km', value: 1 },
        }),
        makeActivity({
          distance: 8,
          duration: 2360,
          avgPace: 295,
          avgHR: 153,
          splits: [
            { km: 1, distance: 1, pace: 360, hr: 132 },
            { km: 2, distance: 1, pace: 345, hr: 140 },
            { km: 3, distance: 1, pace: 250, hr: 162 },
          ],
        }),
      ),
    ).toEqual({
      status: 'unavailable',
      sessionType: 'TEMPO',
      reason: 'insufficient-structured-data',
    });
  });
});
