import { describe, expect, it } from 'vitest';
import { C } from '../constants/colours';

describe('semantic colour language', () => {
  it('exposes the approved metric colour tokens for the run-detail pilot', () => {
    expect({
      distance: C.metricDistance,
      pace: C.metricPace,
      time: C.metricTime,
      heartRate: C.metricHeartRate,
      elevation: C.metricElevation,
      effort: C.metricEffort,
      fuelling: C.metricFuelling,
      shoes: C.metricShoes,
    }).toEqual({
      distance: '#3D55A4',
      pace: '#187F7A',
      time: '#9D711F',
      heartRate: '#BD433B',
      elevation: '#607B38',
      effort: '#765098',
      fuelling: '#A5612F',
      shoes: '#577080',
    });
  });
});
