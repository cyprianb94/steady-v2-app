import { describe, it, expect } from 'vitest';
import { normalizeSessionIds } from '@steady/types';
import type { PlanWeek, PlannedSession } from '@steady/types';

function makeSession(id: string): PlannedSession {
  return { id, type: 'EASY', date: '2026-01-06', distance: 8 };
}

function makeWeek(weekNumber: number, sessions: (PlannedSession | null)[]): PlanWeek {
  return { weekNumber, phase: 'BASE', sessions, plannedKm: 32 };
}

describe('normalizeSessionIds', () => {
  it('assigns w{weekNumber}d{dayIndex} to each non-null session', () => {
    const week = makeWeek(1, [makeSession('old-id'), null, makeSession('other-id')]);
    const [result] = normalizeSessionIds([week]);

    expect(result.sessions[0]!.id).toBe('w1d0');
    expect(result.sessions[2]!.id).toBe('w1d2');
  });

  it('leaves null slots as null', () => {
    const week = makeWeek(2, [makeSession('s1'), null, makeSession('s2')]);
    const [result] = normalizeSessionIds([week]);

    expect(result.sessions[1]).toBeNull();
  });

  it('preserves all other session fields unchanged', () => {
    const session = makeSession('original');
    const week = makeWeek(1, [session]);
    const [result] = normalizeSessionIds([week]);

    const normalized = result.sessions[0]!;
    expect(normalized.type).toBe(session.type);
    expect(normalized.date).toBe(session.date);
    expect(normalized.distance).toBe(session.distance);
  });

  it('produces unique IDs across multiple weeks', () => {
    const weeks = [
      makeWeek(1, [makeSession('a'), makeSession('b')]),
      makeWeek(2, [makeSession('c'), makeSession('d')]),
    ];
    const result = normalizeSessionIds(weeks);

    const ids = result
      .flatMap((w) => w.sessions)
      .filter(Boolean)
      .map((s) => s!.id);

    expect(ids).toEqual(['w1d0', 'w1d1', 'w2d0', 'w2d1']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is idempotent', () => {
    const week = makeWeek(3, [makeSession('x')]);
    const once = normalizeSessionIds([week]);
    const twice = normalizeSessionIds(once);

    expect(twice[0].sessions[0]!.id).toBe('w3d0');
  });
});
