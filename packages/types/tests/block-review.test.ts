import { describe, expect, it } from 'vitest';
import {
  buildBlockReviewModel,
  type PhaseName,
  type PlannedSession,
  type PlanWeek,
  type SessionType,
} from '../src';

function session(type: SessionType, dayIndex: number): PlannedSession {
  if (type === 'REST') {
    return { id: `s-${dayIndex}`, date: `2026-05-${String(dayIndex + 1).padStart(2, '0')}`, type };
  }

  if (type === 'INTERVAL') {
    return {
      id: `s-${dayIndex}`,
      date: `2026-05-${String(dayIndex + 1).padStart(2, '0')}`,
      type,
      reps: 6,
      repDist: 800,
      pace: '3:50',
    };
  }

  return {
    id: `s-${dayIndex}`,
    date: `2026-05-${String(dayIndex + 1).padStart(2, '0')}`,
    type,
    distance: type === 'LONG' ? 20 : 8,
    pace: '5:20',
  };
}

function week(
  weekNumber: number,
  phase: PhaseName,
  plannedKm: number,
  pattern: (SessionType | null)[] = ['EASY', 'INTERVAL', 'EASY', 'TEMPO', null, 'EASY', 'LONG'],
): PlanWeek {
  return {
    weekNumber,
    phase,
    plannedKm,
    sessions: pattern.map((type, dayIndex) => (type ? session(type, dayIndex) : null)),
  };
}

describe('buildBlockReviewModel', () => {
  it('groups weeks by phase while keeping contiguous phase-strip segments', () => {
    const model = buildBlockReviewModel({
      weeks: [
        week(1, 'BASE', 30),
        week(2, 'BUILD', 40),
        week(3, 'RECOVERY', 28),
        week(4, 'BUILD', 45),
        week(5, 'PEAK', 50),
        week(6, 'TAPER', 32),
      ],
      phases: { BASE: 1, BUILD: 2, RECOVERY: 1, PEAK: 1, TAPER: 1 },
      currentWeekIndex: 3,
    });

    const build = model.phases.find((phase) => phase.phase === 'BUILD');
    expect(build?.weekNumbers).toEqual([2, 4]);
    expect(build?.rangeLabel).toBe('W2, W4');
    expect(model.structureLabel).toBe('1w base · 2w build · 1w recovery · 1w peak · 1w taper');
    expect(model.phaseSegments.map((segment) => segment.phase)).toEqual([
      'BASE',
      'BUILD',
      'RECOVERY',
      'BUILD',
      'PEAK',
      'TAPER',
    ]);
    expect(model.phaseSegments[3]).toMatchObject({
      phase: 'BUILD',
      startWeekNumber: 4,
      endWeekNumber: 4,
      isCurrent: true,
    });
  });

  it('derives volume stats, curve points, and key review weeks', () => {
    const model = buildBlockReviewModel({
      weeks: [
        week(1, 'BASE', 30),
        week(2, 'BUILD', 42),
        week(3, 'PEAK', 55),
        week(4, 'TAPER', 33),
      ],
      progressionPct: 7,
      progressionEveryWeeks: 3,
    });

    expect(model.volume.stats).toMatchObject({
      totalWeeks: 4,
      startKm: 30,
      peakKm: 55,
      peakWeekNumber: 3,
      raceKm: 33,
      maxKm: 55,
    });
    expect(model.overload).toEqual({
      progressionPct: 7,
      progressionEveryWeeks: 3,
      hasProgression: true,
      label: '+7% every 3 weeks',
    });
    expect(model.keyWeeks.map((weekModel) => [weekModel.weekNumber, weekModel.title])).toEqual([
      [1, 'Settle into rhythm'],
      [3, 'Peak week'],
      [4, 'Race week'],
    ]);
    expect(model.volume.points[0]).toMatchObject({ weekNumber: 1, x: 0, isStart: true });
    expect(model.volume.points[3]).toMatchObject({ weekNumber: 4, x: 1, isRace: true });
    expect(model.volume.points[2].y).toBeLessThan(model.volume.points[0].y);
  });

  it('keeps configured zero-week phases in the structure label', () => {
    const model = buildBlockReviewModel({
      weeks: [
        week(1, 'BASE', 30),
        week(2, 'BUILD', 42),
        week(3, 'PEAK', 55),
        week(4, 'TAPER', 33),
      ],
      phases: { BASE: 1, BUILD: 1, RECOVERY: 0, PEAK: 1, TAPER: 1 },
    });

    expect(model.structureLabel).toBe('1w base · 1w build · 0w recovery · 1w peak · 1w taper');
  });

  it('normalises week rows for review components', () => {
    const model = buildBlockReviewModel({
      weeks: [
        week(1, 'BASE', 20, ['EASY', null, 'TEMPO', null, null, 'EASY', 'LONG']),
        week(2, 'BUILD', 40),
      ],
    });

    expect(model.weeks[0]).toMatchObject({
      id: 'week-1',
      weekIndex: 0,
      weekNumber: 1,
      phase: 'BASE',
      plannedKm: 20,
      volumeRatio: 0.5,
      isStartWeek: true,
    });
    expect(model.weeks[0].sessionTypes).toEqual([
      'EASY',
      'REST',
      'TEMPO',
      'REST',
      'REST',
      'EASY',
      'LONG',
    ]);
    expect(model.weeks[1]).toMatchObject({
      title: 'Peak week',
      detail: '40km · Highest load',
    });
  });

  it('handles flat and empty review models without special caller logic', () => {
    const flat = buildBlockReviewModel({
      weeks: [week(1, 'BASE', 20)],
      progressionPct: 0,
    });
    expect(flat.overload).toEqual({
      progressionPct: 0,
      progressionEveryWeeks: 2,
      hasProgression: false,
      label: 'Flat plan',
    });

    const empty = buildBlockReviewModel({ weeks: [] });
    expect(empty.weeks).toEqual([]);
    expect(empty.phases).toEqual([]);
    expect(empty.volume.stats).toMatchObject({
      totalWeeks: 0,
      startKm: 0,
      peakKm: 0,
      raceKm: 0,
      maxKm: 0,
    });
    expect(empty.structureLabel).toBe('');
  });
});
