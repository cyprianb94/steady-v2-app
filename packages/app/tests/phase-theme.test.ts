import { describe, it, expect } from 'vitest';
import { getPhaseColors, type PhaseColors } from '../lib/phase-theme';
import type { PhaseName } from '@steady/types';

const ALL_PHASES: PhaseName[] = ['BASE', 'BUILD', 'RECOVERY', 'PEAK', 'TAPER'];

describe('getPhaseColors', () => {
  it('returns distinct color sets for all 5 phases', () => {
    const colorSets = ALL_PHASES.map((p) => getPhaseColors(p));

    // Each phase must have the required keys
    for (const colors of colorSets) {
      expect(colors).toHaveProperty('surface');
      expect(colors).toHaveProperty('accent');
      expect(colors).toHaveProperty('border');
      expect(colors).toHaveProperty('badge');
      expect(colors).toHaveProperty('badgeText');
    }

    // No two phases should share the same accent
    const accents = colorSets.map((c) => c.accent);
    expect(new Set(accents).size).toBe(5);
  });

  it('defaults to BASE colors when no phase is provided', () => {
    const fallback = getPhaseColors(undefined);
    const base = getPhaseColors('BASE');
    expect(fallback).toEqual(base);
  });
});
