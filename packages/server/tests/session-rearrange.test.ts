import { describe, expect, it } from 'vitest';
import { detectHardSessionConflicts, swapSessions, type PlannedSession } from '@steady/types';

function session(id: string, type: PlannedSession['type']): PlannedSession {
  return { id, type, date: '2026-04-06' };
}

describe('swapSessions', () => {
  it('returns a new week layout with two session positions exchanged', () => {
    const easy = session('easy', 'EASY');
    const long = session('long', 'LONG');
    const sessions: (PlannedSession | null)[] = [easy, null, long, null, null, null, null];

    const result = swapSessions(sessions, 0, 2);

    expect(result).toEqual([long, null, easy, null, null, null, null]);
    expect(result).not.toBe(sessions);
  });

  it('returns the original layout when either day index is out of bounds', () => {
    const sessions: (PlannedSession | null)[] = [
      session('easy', 'EASY'),
      null,
      session('long', 'LONG'),
      null,
      null,
      null,
      null,
    ];

    expect(swapSessions(sessions, -1, 2)).toBe(sessions);
    expect(swapSessions(sessions, 0, 7)).toBe(sessions);
  });

  it('returns the original layout when swapping a day with itself', () => {
    const sessions: (PlannedSession | null)[] = [
      session('easy', 'EASY'),
      null,
      session('long', 'LONG'),
      null,
      null,
      null,
      null,
    ];

    expect(swapSessions(sessions, 2, 2)).toBe(sessions);
  });

  it('swaps a session with a rest day slot', () => {
    const easy = session('easy', 'EASY');
    const sessions: (PlannedSession | null)[] = [easy, null, null, null, null, null, null];

    expect(swapSessions(sessions, 0, 1)).toEqual([null, easy, null, null, null, null, null]);
  });
});

describe('detectHardSessionConflicts', () => {
  it('returns a conflict for adjacent interval and tempo sessions', () => {
    const sessions: (PlannedSession | null)[] = [
      null,
      session('interval', 'INTERVAL'),
      session('tempo', 'TEMPO'),
      null,
      null,
      null,
      null,
    ];

    expect(detectHardSessionConflicts(sessions)).toEqual([
      {
        firstDayIndex: 1,
        secondDayIndex: 2,
        firstType: 'INTERVAL',
        secondType: 'TEMPO',
      },
    ]);
  });

  it('returns a conflict for adjacent interval sessions', () => {
    const sessions: (PlannedSession | null)[] = [
      session('interval-1', 'INTERVAL'),
      session('interval-2', 'INTERVAL'),
      null,
      null,
      null,
      null,
      null,
    ];

    expect(detectHardSessionConflicts(sessions)).toEqual([
      {
        firstDayIndex: 0,
        secondDayIndex: 1,
        firstType: 'INTERVAL',
        secondType: 'INTERVAL',
      },
    ]);
  });

  it('does not return conflicts when easy, rest, or empty days separate hard sessions', () => {
    const sessions: (PlannedSession | null)[] = [
      session('interval-1', 'INTERVAL'),
      session('easy', 'EASY'),
      session('tempo', 'TEMPO'),
      session('rest', 'REST'),
      session('interval-2', 'INTERVAL'),
      null,
      session('tempo-2', 'TEMPO'),
    ];

    expect(detectHardSessionConflicts(sessions)).toEqual([]);
  });

  it('does not treat Sunday and Monday as adjacent within the same week', () => {
    const sessions: (PlannedSession | null)[] = [
      session('monday-interval', 'INTERVAL'),
      null,
      null,
      null,
      null,
      null,
      session('sunday-tempo', 'TEMPO'),
    ];

    expect(detectHardSessionConflicts(sessions)).toEqual([]);
  });
});
