import { describe, expect, it } from 'vitest';
import {
  buildBlockReviewModel,
  type PhaseName,
  type PlannedSession,
  type PlanWeek,
} from '@steady/types';
import {
  buildReviewVolumeChartModel,
  weekIndexFromX,
} from '../features/block-review/review-volume-chart-model';

function session(id: string, distance: number): PlannedSession {
  return {
    id,
    type: 'EASY',
    date: '2026-05-01',
    distance,
  };
}

function week(weekNumber: number, phase: PhaseName, plannedKm: number): PlanWeek {
  return {
    weekNumber,
    phase,
    plannedKm,
    sessions: [session(`w${weekNumber}`, plannedKm), null, null, null, null, null, null],
  };
}

describe('review volume chart model', () => {
  it('builds deterministic chart geometry from the shared block review model', () => {
    const model = buildBlockReviewModel({
      weeks: [
        week(1, 'BASE', 30),
        week(2, 'BUILD', 45),
        week(3, 'BUILD', 60),
        week(4, 'TAPER', 42),
      ],
      currentWeekIndex: 1,
    });

    const chart = buildReviewVolumeChartModel(model, 300);

    expect(chart.axisMax).toBe(100);
    expect(chart.points.map((point) => ({
      weekNumber: point.weekNumber,
      phase: point.phase,
      km: point.km,
      x: point.x,
      y: point.y,
    }))).toEqual([
      { weekNumber: 1, phase: 'BASE', km: 30, x: 0, y: 92 },
      { weekNumber: 2, phase: 'BUILD', km: 45, x: 100, y: 77 },
      { weekNumber: 3, phase: 'BUILD', km: 60, x: 200, y: 62 },
      { weekNumber: 4, phase: 'TAPER', km: 42, x: 300, y: 80 },
    ]);
    expect(chart.ticks.map((tick) => tick.value)).toEqual([100, 50, 0]);
    expect(chart.phaseMarkers.map((marker) => marker.weekNumber)).toEqual([1, 2, 4]);
    expect(chart.gradientStops.map((stop) => [stop.key, stop.offset])).toEqual([
      ['BASE-1-start', '0.00%'],
      ['BASE-1-end', '33.33%'],
      ['BUILD-2-start', '33.33%'],
      ['BUILD-2-end', '100.00%'],
      ['TAPER-4-start', '100.00%'],
      ['TAPER-4-end', '100.00%'],
    ]);
    expect(chart.pathD).toBe('M 0 92 C 18 89.30 64 82.40 100 77 C 136 71.60 164 61.46 200 62 C 236 62.54 282 76.76 300 80');
  });

  it('handles empty and single-week models without caller special cases', () => {
    expect(buildReviewVolumeChartModel(buildBlockReviewModel({ weeks: [] }), 300)).toMatchObject({
      points: [],
      pathD: '',
      gradientStops: [],
      phaseMarkers: [],
      ticks: [],
      axisMax: 1,
    });

    const single = buildReviewVolumeChartModel(
      buildBlockReviewModel({ weeks: [week(1, 'BASE', 40)] }),
      280,
    );

    expect(single.points).toHaveLength(1);
    expect(single.points[0]).toMatchObject({ weekNumber: 1, x: 0, y: 42 });
    expect(single.pathD).toBe('M 0 42');
    expect(weekIndexFromX(-10, 280, 1)).toBe(0);
    expect(weekIndexFromX(320, 280, 1)).toBe(0);
  });

  it('selects the nearest week from scrub position inside chart bounds', () => {
    expect(weekIndexFromX(-20, 300, 4)).toBe(0);
    expect(weekIndexFromX(0, 300, 4)).toBe(0);
    expect(weekIndexFromX(149, 300, 4)).toBe(1);
    expect(weekIndexFromX(151, 300, 4)).toBe(2);
    expect(weekIndexFromX(400, 300, 4)).toBe(3);
  });
});
