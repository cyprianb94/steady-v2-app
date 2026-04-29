import { describe, expect, it } from 'vitest';
import type { ActivitySplit, PlannedSession } from '@steady/types';
import { buildTargetAwareSplitsModel } from '../features/run/target-aware-splits';

const intervalSession: PlannedSession = {
  id: 'interval-1',
  type: 'INTERVAL',
  date: '2026-04-29',
  reps: 3,
  repDist: 400,
  warmup: { unit: 'km', value: 1 },
  recovery: { unit: 'km', value: 0.2 },
  cooldown: { unit: 'km', value: 1 },
  intensityTarget: {
    source: 'manual',
    mode: 'pace',
    paceRange: { min: '3:50', max: '4:00' },
  },
};

function split(
  km: number,
  distance: number,
  pace: number,
  hr?: number,
): ActivitySplit {
  return {
    km,
    distance,
    pace,
    hr,
  };
}

describe('buildTargetAwareSplitsModel', () => {
  it('uses target comparison metadata when a tempo session has a pace range', () => {
    const model = buildTargetAwareSplitsModel({
      session: {
        id: 'tempo-1',
        type: 'TEMPO',
        date: '2026-04-29',
        distance: 2,
        intensityTarget: {
          source: 'manual',
          mode: 'pace',
          paceRange: { min: '4:15', max: '4:25' },
        },
      },
      splits: [split(1, 1, 260), split(2, 1, 262)],
      units: 'metric',
    });

    expect(model.comparisonMode).toBe('target');
    expect(model.comparisonHeader).toBe('VS TARGET');
    expect(model.summaryLabel).toBe('per km');
    expect(model.rows.map((row) => row.targetStatus)).toEqual(['on-target', 'on-target']);
  });

  it('uses average comparison for easy run kilometre splits even when the session has a pace range', () => {
    const model = buildTargetAwareSplitsModel({
      session: {
        id: 'easy-1',
        type: 'EASY',
        date: '2026-04-29',
        distance: 3,
        intensityTarget: {
          source: 'manual',
          mode: 'pace',
          paceRange: { min: '5:30', max: '6:05' },
        },
      },
      splits: [split(1, 1, 350), split(2, 1, 365), split(3, 0.6, 360)],
      units: 'metric',
    });

    expect(model.comparisonMode).toBe('average');
    expect(model.comparisonHeader).toBe('VS AVERAGE');
    expect(model.summaryLabel).toBe('per km');
    expect(model.rows.map((row) => row.label)).toEqual(['1', '2', '+0.6']);
    expect(model.rows.every((row) => row.targetStatus === null && row.comparisonLabel === null)).toBe(true);
  });

  it('classifies interval work reps separately from warmup, recoveries, and cooldown', () => {
    const model = buildTargetAwareSplitsModel({
      session: intervalSession,
      splits: [
        split(1, 1, 360, 132),
        split(2, 0.4, 245, 165),
        split(3, 0.2, 390, 144),
        split(4, 0.4, 243, 168),
        split(5, 0.2, 395, 146),
        split(6, 0.4, 225, 171),
        split(7, 0.2, 400, 148),
        split(8, 1, 370, 138),
      ],
      units: 'metric',
    });

    expect(model.summaryLabel).toBe('segments');
    expect(model.rows.map((row) => row.kind)).toEqual([
      'warmup',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'recovery',
      'cooldown',
    ]);
    expect(model.rows.map((row) => row.targetStatus)).toEqual([
      null,
      'slow',
      null,
      'slow',
      null,
      'fast',
      null,
      null,
    ]);
    expect(model.rows.filter((row) => row.kind !== 'work').every((row) => row.comparisonLabel === null)).toBe(true);
  });

  it('exposes elapsed split time for work reps alongside pace and heart rate', () => {
    const model = buildTargetAwareSplitsModel({
      session: intervalSession,
      splits: [
        split(1, 1, 360, 132),
        split(2, 0.4, 238, 165),
        split(3, 0.2, 390, 144),
        split(4, 0.4, 243, 168),
        split(5, 0.2, 395, 146),
        split(6, 0.4, 236, 171),
        split(7, 0.2, 400, 148),
        split(8, 1, 370, 138),
      ],
      units: 'metric',
    });

    const workRows = model.rows.filter((row) => row.kind === 'work');

    expect(workRows.map((row) => ({
      label: row.label,
      paceLabel: row.paceLabel,
      heartRateLabel: row.heartRateLabel,
      elapsedLabel: row.elapsedLabel,
      comparisonLabel: row.comparisonLabel,
    }))).toEqual([
      { label: 'Rep 1', paceLabel: '3:58', heartRateLabel: '165 bpm', elapsedLabel: '1:35', comparisonLabel: 'ON TARGET' },
      { label: 'Rep 2', paceLabel: '4:03', heartRateLabel: '168 bpm', elapsedLabel: '1:37', comparisonLabel: 'SLOW' },
      { label: 'Rep 3', paceLabel: '3:56', heartRateLabel: '171 bpm', elapsedLabel: '1:34', comparisonLabel: 'ON TARGET' },
    ]);
  });

  it('classifies interval reps when recorded recovery distances vary', () => {
    const model = buildTargetAwareSplitsModel({
      session: {
        ...intervalSession,
        reps: 6,
        repDist: 400,
        warmup: { unit: 'km', value: 2 },
        recovery: { unit: 'min', value: 1 },
        cooldown: undefined,
        intensityTarget: {
          source: 'manual',
          mode: 'pace',
          paceRange: { min: '3:35', max: '3:50' },
        },
      },
      splits: [
        split(1, 2.01, 435, 139),
        split(2, 0.405, 225, 180),
        split(3, 0.258, 344, 169),
        split(4, 0.405, 215, 184),
        split(5, 0.197, 452, 171),
        split(6, 0.399, 218, 184),
        split(7, 0.210, 424, 172),
        split(8, 0.394, 223, 182),
        split(9, 0.190, 467, 171),
        split(10, 0.399, 226, 182),
        split(11, 0.207, 431, 173),
        split(12, 0.411, 217, 185),
        split(13, 0.243, 366, 179),
        split(14, 2, 355, 155),
        split(15, 1.43, 363, 150),
      ],
      units: 'metric',
    });

    expect(model.summaryLabel).toBe('segments');
    expect(model.comparisonHeader).toBe('VS TARGET');
    expect(model.rows.map((row) => row.kind)).toEqual([
      'warmup',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'recovery',
      'split',
      'split',
    ]);
    expect(model.rows.filter((row) => row.kind === 'work').map((row) => ({
      label: row.label,
      elapsedLabel: row.elapsedLabel,
      comparisonLabel: row.comparisonLabel,
      heartRateLabel: row.heartRateLabel,
    }))).toEqual([
      { label: 'Rep 1', elapsedLabel: '1:31', comparisonLabel: 'ON TARGET', heartRateLabel: '180 bpm' },
      { label: 'Rep 2', elapsedLabel: '1:27', comparisonLabel: 'ON TARGET', heartRateLabel: '184 bpm' },
      { label: 'Rep 3', elapsedLabel: '1:27', comparisonLabel: 'ON TARGET', heartRateLabel: '184 bpm' },
      { label: 'Rep 4', elapsedLabel: '1:28', comparisonLabel: 'ON TARGET', heartRateLabel: '182 bpm' },
      { label: 'Rep 5', elapsedLabel: '1:30', comparisonLabel: 'ON TARGET', heartRateLabel: '182 bpm' },
      { label: 'Rep 6', elapsedLabel: '1:29', comparisonLabel: 'ON TARGET', heartRateLabel: '185 bpm' },
    ]);
    expect(model.rows.filter((row) => row.kind !== 'work').every((row) => row.targetStatus === null)).toBe(true);
  });

  it('degrades to generic split rows when interval lap distances cannot be inferred', () => {
    const model = buildTargetAwareSplitsModel({
      session: intervalSession,
      splits: [
        split(1, 1, 330, 140),
        split(2, 1, 332, 144),
        split(3, 1, 334, 146),
      ],
      units: 'metric',
    });

    expect(model.summaryLabel).toBe('per km');
    expect(model.comparisonMode).toBe('average');
    expect(model.comparisonHeader).toBe('VS AVERAGE');
    expect(model.rows.map((row) => row.kind)).toEqual(['split', 'split', 'split']);
    expect(model.rows.map((row) => row.label)).toEqual(['1', '2', '3']);
    expect(model.rows.every((row) => row.targetStatus === null && row.elapsedLabel === null)).toBe(true);
  });
});
