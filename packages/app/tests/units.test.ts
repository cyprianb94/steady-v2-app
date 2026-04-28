import { describe, expect, it } from 'vitest';
import type { PlannedSession } from '@steady/types';
import {
  formatCompactSessionLabel,
  formatIntensityTargetDisplay,
  formatSessionLabel,
  formatSplitLabel,
  inferSplitLabelMode,
} from '../lib/units';

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

describe('intensity target display', () => {
  it('formats pace ranges and effort cues through one shared display helper', () => {
    expect(formatIntensityTargetDisplay(
      {
        source: 'manual',
        mode: 'both',
        paceRange: { min: '4:25', max: '4:15' },
        effortCue: 'controlled hard',
      },
      'metric',
    )).toBe('4:15-4:25 · controlled hard');

    expect(formatIntensityTargetDisplay(
      {
        source: 'manual',
        mode: 'both',
        paceRange: { min: '4:25', max: '4:15' },
        effortCue: 'controlled hard',
      },
      'metric',
      { withUnit: true },
    )).toBe('4:15-4:25/km · controlled hard');
  });

  it('uses effort cues without inventing missing pace placeholders', () => {
    const recoverySession: PlannedSession = {
      id: 'recovery-easy',
      type: 'EASY',
      date: '2026-04-10',
      distance: 5,
      pace: '6:10',
      intensityTarget: {
        source: 'manual',
        mode: 'effort',
        profileKey: 'recovery',
        effortCue: 'very easy',
      },
    };

    expect(formatIntensityTargetDisplay(recoverySession, 'metric', { withUnit: true })).toBe('very easy');
    expect(formatSessionLabel(recoverySession, 'metric')).toBe('5km easy · very easy');
  });

  it('keeps legacy single-pace sessions readable with the standard pace separator', () => {
    expect(formatSessionLabel(
      {
        id: 'legacy-easy',
        type: 'EASY',
        date: '2026-04-10',
        distance: 8,
        pace: '5:20',
      },
      'metric',
    )).toBe('8km easy · 5:20');
  });

  it('treats normalized legacy pace-only targets as compatibility display', () => {
    expect(formatSessionLabel(
      {
        id: 'normalized-legacy-easy',
        type: 'EASY',
        date: '2026-04-10',
        distance: 8,
        pace: '5:20',
        intensityTarget: {
          source: 'manual',
          mode: 'pace',
          pace: '5:20',
        },
      },
      'metric',
    )).toBe('8km easy · 5:20');
  });

  it('formats interval pace ranges without hand-rolled screen parsing', () => {
    const session: PlannedSession = {
      id: 'interval-range',
      type: 'INTERVAL',
      date: '2026-04-11',
      reps: 10,
      repDuration: { unit: 'km', value: 1 },
      pace: '4:05',
      intensityTarget: {
        source: 'manual',
        mode: 'both',
        paceRange: { min: '4:00', max: '4:10' },
        effortCue: 'hard repeatable',
      },
    };

    expect(formatSessionLabel(session, 'metric')).toBe('10×1km · 4:00-4:10 · hard repeatable');
    expect(formatCompactSessionLabel(session, 'metric')).toBe('10×1km · 4:00-4:10');
  });
});
