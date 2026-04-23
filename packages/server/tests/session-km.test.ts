import { describe, it, expect } from 'vitest';
import { sessionKm } from '../src/lib/session-km';
import type { PlannedSession } from '@steady/types';

function session(overrides: Partial<PlannedSession> & { type: PlannedSession['type'] }): PlannedSession {
  return { id: 'test', date: '2026-03-22', ...overrides };
}

describe('sessionKm', () => {
  it('returns 0 for null session', () => {
    expect(sessionKm(null)).toBe(0);
  });

  it('returns 0 for REST session', () => {
    expect(sessionKm(session({ type: 'REST' }))).toBe(0);
  });

  it('returns distance for EASY session', () => {
    expect(sessionKm(session({ type: 'EASY', distance: 10 }))).toBe(10);
  });

  it('returns distance for LONG session', () => {
    expect(sessionKm(session({ type: 'LONG', distance: 22 }))).toBe(22);
  });

  it('includes warmup and cooldown for TEMPO session', () => {
    const s = session({
      type: 'TEMPO',
      distance: 10,
      warmup: { unit: 'km', value: 2 },
      cooldown: { unit: 'km', value: 1.5 },
    });
    expect(sessionKm(s)).toBe(13.5);
  });

  it('calculates INTERVAL km: reps * repDist + recovery jog + warmup + cooldown', () => {
    const s = session({
      type: 'INTERVAL',
      reps: 6,
      repDist: 800,
      recovery: '90s',
      warmup: { unit: 'km', value: 1.5 },
      cooldown: { unit: 'km', value: 1 },
    });
    // 6 * 800/1000 = 4.8km reps
    // 6 * 0.27 = 1.62km recovery jog
    // 1.5km warmup + 1km cooldown
    // total = 4.8 + 1.62 + 1.5 + 1 = 8.92 → rounded to 8.9
    expect(sessionKm(s)).toBe(8.9);
  });

  it('includes recovery jog km for INTERVAL with 45s recovery', () => {
    const s = session({
      type: 'INTERVAL',
      reps: 4,
      repDist: 400,
      recovery: '45s',
    });
    // 4 * 400/1000 = 1.6km reps
    // 4 * 0.14 = 0.56km recovery
    // total = 1.6 + 0.56 = 2.16 → 2.2
    expect(sessionKm(s)).toBe(2.2);
  });

  it('includes recovery jog km for INTERVAL with 5min recovery', () => {
    const s = session({
      type: 'INTERVAL',
      reps: 3,
      repDist: 1600,
      recovery: '5min',
      warmup: { unit: 'km', value: 2 },
      cooldown: { unit: 'km', value: 1.5 },
    });
    // 3 * 1600/1000 = 4.8km reps
    // 3 * 0.91 = 2.73km recovery
    // 2km warmup + 1.5km cooldown
    // total = 4.8 + 2.73 + 2 + 1.5 = 11.03 → 11.0
    expect(sessionKm(s)).toBe(11);
  });

  it('returns distance without warmup/cooldown for EASY (no wu/cd fields)', () => {
    const s = session({ type: 'EASY', distance: 8 });
    expect(sessionKm(s)).toBe(8);
  });

  it('ignores minute-based warmup and cooldown in km totals', () => {
    const s = session({
      type: 'TEMPO',
      distance: 10,
      warmup: { unit: 'min', value: 15 },
      cooldown: { unit: 'min', value: 10 },
    });

    expect(sessionKm(s)).toBe(10);
  });

  it('falls back to 8km for malformed session without distance or reps', () => {
    const s = session({ type: 'EASY' });
    expect(sessionKm(s)).toBe(8);
  });

  it('handles INTERVAL without recovery field (no jog km added)', () => {
    const s = session({
      type: 'INTERVAL',
      reps: 5,
      repDist: 1000,
    });
    // 5 * 1000/1000 = 5.0km reps, no recovery, no wu/cd
    expect(sessionKm(s)).toBe(5);
  });
});
