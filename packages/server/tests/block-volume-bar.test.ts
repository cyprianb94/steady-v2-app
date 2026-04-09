import { describe, expect, it } from 'vitest';
import { getBlockVolumeTone, getWeekVolumeRatio } from '@steady/types';

describe('block volume helpers', () => {
  it('computes a clamped ratio relative to the peak week volume', () => {
    expect(getWeekVolumeRatio(42, 60)).toBeCloseTo(0.7);
    expect(getWeekVolumeRatio(80, 60)).toBe(1);
    expect(getWeekVolumeRatio(0, 60)).toBe(0);
  });

  it('returns the correct visual tone relative to the current week', () => {
    expect(getBlockVolumeTone(1, 3)).toBe('past');
    expect(getBlockVolumeTone(3, 3)).toBe('current');
    expect(getBlockVolumeTone(5, 3)).toBe('future');
  });
});
