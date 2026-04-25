import { describe, expect, it } from 'vitest';
import { formatSplitLabel, inferSplitLabelMode } from '../lib/units';

describe('split labels', () => {
  it('labels continuous run splits by position and marks the final partial split', () => {
    const splits = [
      { km: 1, label: '1 km', distance: 1 },
      { km: 2, label: '1 km', distance: 1 },
      { km: 3, label: '0.38 km', distance: 0.38 },
    ];
    const mode = inferSplitLabelMode({ type: 'EASY' }, splits);

    expect(mode).toBe('position');
    expect(splits.map((split) => formatSplitLabel(split, 'metric', { mode }))).toEqual([
      '1',
      '2',
      '+0.38',
    ]);
  });

  it('keeps interval splits as segment distances', () => {
    const splits = [
      { km: 1, label: 'Warmup', distance: 2 },
      { km: 2, label: 'Work', distance: 1.87 },
      { km: 3, label: 'Recovery', distance: 0.247 },
    ];
    const mode = inferSplitLabelMode({ type: 'INTERVAL' }, splits);

    expect(mode).toBe('segment');
    expect(splits.map((split) => formatSplitLabel(split, 'metric', { mode }))).toEqual([
      '2 km',
      '1.87 km',
      '247m',
    ]);
  });

  it('treats unmatched non-final short splits as structured segments', () => {
    const splits = [
      { km: 1, label: '2.0 km', distance: 2 },
      { km: 2, label: '400m', distance: 0.4 },
      { km: 3, label: '1.0 km', distance: 1 },
    ];

    expect(inferSplitLabelMode(null, splits)).toBe('segment');
  });

  it('keeps interval sessions in kilometre mode when the synced splits are only near-kilometre rows', () => {
    const splits = [
      { km: 1, distance: 1 },
      { km: 2, distance: 0.999 },
      { km: 3, distance: 0.998 },
      { km: 4, distance: 1 },
      { km: 5, distance: 0.393 },
    ];
    const mode = inferSplitLabelMode({ type: 'INTERVAL' }, splits);

    expect(mode).toBe('position');
    expect(splits.map((split) => formatSplitLabel(split, 'metric', { mode }))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '+0.39',
    ]);
  });
});
