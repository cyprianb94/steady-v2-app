import { describe, expect, it } from 'vitest';
import { mapStravaActivitySplits } from '../src/lib/strava-activity-splits';
import type { StravaActivity } from '../src/lib/strava-client';

function activity(overrides: Partial<StravaActivity>): StravaActivity {
  return {
    id: 101,
    sport_type: 'Run',
    start_date: '2026-04-25T07:00:00Z',
    distance: 10000,
    moving_time: 3000,
    elapsed_time: 3000,
    ...overrides,
  };
}

describe('mapStravaActivitySplits', () => {
  it('prefers structured laps over kilometre splits when Strava has interval segments', () => {
    const splits = mapStravaActivitySplits(activity({
      splits_metric: [
        { split: 1, distance: 1000, elapsed_time: 367, average_heartrate: 144 },
        { split: 2, distance: 1000, elapsed_time: 338, average_heartrate: 147 },
      ],
      laps: [
        { lap_index: 0, name: 'Warmup', distance: 2000, elapsed_time: 707, average_heartrate: 146 },
        { lap_index: 1, name: 'Work', distance: 1870, elapsed_time: 480, average_heartrate: 173 },
        { lap_index: 2, name: 'Recovery', distance: 247, elapsed_time: 90, average_heartrate: 174 },
      ],
    }));

    expect(splits).toEqual([
      expect.objectContaining({ km: 1, label: 'Warmup', distance: 2, pace: 354, hr: 146 }),
      expect.objectContaining({ km: 2, label: 'Work', distance: 1.87, pace: 257, hr: 173 }),
      expect.objectContaining({ km: 3, label: 'Recovery', distance: 0.247, pace: 364, hr: 174 }),
    ]);
  });

  it('keeps kilometre splits when laps look like automatic one-kilometre laps', () => {
    const splits = mapStravaActivitySplits(activity({
      splits_metric: [
        { split: 1, distance: 1000, elapsed_time: 300, average_heartrate: 148 },
        { split: 2, distance: 1000, elapsed_time: 310, average_heartrate: 151 },
      ],
      laps: [
        { lap_index: 0, name: 'Lap 1', distance: 1000, elapsed_time: 301, average_heartrate: 148 },
        { lap_index: 1, name: 'Lap 2', distance: 1000, elapsed_time: 311, average_heartrate: 151 },
      ],
    }));

    expect(splits).toEqual([
      expect.objectContaining({ km: 1, distance: 1, pace: 300, hr: 148 }),
      expect.objectContaining({ km: 2, distance: 1, pace: 310, hr: 151 }),
    ]);
    expect(splits[0]?.label).toBeUndefined();
    expect(splits[1]?.label).toBeUndefined();
  });
});
