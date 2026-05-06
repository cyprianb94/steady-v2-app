import { describe, expect, it } from 'vitest';
import type { PlannedSession } from '@steady/types';
import {
  formatDurationClock,
  formatDurationHoursMinutes,
  formatCompactSessionLabel,
  formatIntensityTargetDisplay,
  formatSessionLabel,
  formatSessionTitle,
  formatSplitLabel,
  inferSplitLabelMode,
} from '../lib/units';

describe('duration formatting', () => {
  it('keeps sync-run clock labels unchanged', () => {
    expect(formatDurationClock(2827)).toBe('47:07');
    expect(formatDurationClock(3723)).toBe('1:02:03');
  });

  it('keeps sync-run picker hour/minute labels unchanged', () => {
    expect(formatDurationHoursMinutes(2827)).toBe('47m');
    expect(formatDurationHoursMinutes(3900)).toBe('1h 5m');
    expect(formatDurationHoursMinutes(3600)).toBe('1h 0m');
  });
});

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

  it('formats structured distance instead of stale parent distance', () => {
    const session: PlannedSession = {
      id: 'structured-long',
      type: 'LONG',
      date: '2026-04-11',
      distance: 18,
      plannedVolume: { unit: 'km', value: 18 },
      intensityTarget: {
        source: 'manual',
        mode: 'effort',
        profileKey: 'easy',
        effortCue: 'conversational',
      },
      runStructure: {
        items: [
          { kind: 'RUN', volume: { unit: 'km', value: 13 } },
          {
            kind: 'REPEAT',
            repeats: 2,
            segments: [
              { kind: 'RECOVERY', volume: { unit: 'km', value: 0.4 } },
              { kind: 'RUN', volume: { unit: 'km', value: 1 } },
            ],
          },
        ],
      },
    };

    expect(formatSessionTitle(session, 'metric')).toBe('15.8km Long Run');
    expect(formatCompactSessionLabel(session, 'metric')).toBe('Long 15.8km · conversational');
  });

  it('uses run structure as canonical label for structured-only intervals', () => {
    const session: PlannedSession = {
      id: 'fartlek-ladder',
      type: 'INTERVAL',
      date: '2026-04-11',
      runStructure: {
        items: [
          {
            kind: 'REPEAT',
            repeats: 4,
            segments: [
              { kind: 'RUN', volume: { unit: 'sec', value: 90 } },
              { kind: 'RECOVERY', volume: { unit: 'sec', value: 90 } },
            ],
          },
          {
            kind: 'REPEAT',
            repeats: 4,
            segments: [
              { kind: 'RUN', volume: { unit: 'sec', value: 30 } },
              { kind: 'RECOVERY', volume: { unit: 'sec', value: 30 } },
            ],
          },
        ],
      },
    };

    expect(formatSessionLabel(session, 'metric')).toBe(
      '4× 1.5min run, 1.5min recovery, 4× 30s run, 30s recovery',
    );
    expect(formatCompactSessionLabel(session, 'metric')).toBe(
      '4× 1.5min run, 1.5min recovery, 4× 30s run, 30s recovery',
    );
    expect(formatSessionTitle(session, 'metric')).toBe(
      '4× 1.5min run, 1.5min recovery, 4× 30s run, 30s recovery',
    );
  });
});
