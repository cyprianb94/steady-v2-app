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
  it('uses target comparison metadata when a session has a pace range', () => {
    const model = buildTargetAwareSplitsModel({
      session: {
        id: 'tempo-1',
        type: 'TEMPO',
        date: '2026-04-29',
        distance: 8,
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
    expect(model.rows.map((row) => row.targetStatus)).toEqual([null, null]);
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
    expect(model.comparisonHeader).toBe('VS TARGET');
    expect(model.rows.map((row) => row.kind)).toEqual(['split', 'split', 'split']);
    expect(model.rows.map((row) => row.label)).toEqual(['1', '2', '3']);
    expect(model.rows.every((row) => row.targetStatus === null && row.elapsedLabel === null)).toBe(true);
  });
});
