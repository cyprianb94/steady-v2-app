import { describe, expect, it } from 'vitest';
import type { PlannedSession } from '../src';
import {
  detectIntensityTargetType,
  formatIntensityTarget,
  getSessionIntensityTarget,
  intensityTargetContext,
  normalizeIntensityTarget,
  normalizePace,
  normalizePaceRange,
  normalizeSessionIntensityTarget,
  parsePaceSeconds,
  representativePace,
  representativePaceSeconds,
  representativeSessionPaceSeconds,
} from '../src';

function session(overrides: Partial<PlannedSession>): PlannedSession {
  return {
    id: 'session-1',
    type: 'EASY',
    date: '2026-04-06',
    distance: 8,
    ...overrides,
  };
}

describe('pace parsing and range normalization', () => {
  it('normalizes stored pace strings and parses them to seconds', () => {
    expect(normalizePace('04:05 /km')).toBe('4:05');
    expect(parsePaceSeconds('4:20')).toBe(260);
    expect(parsePaceSeconds('4:99')).toBeNull();
  });

  it('normalizes pace ranges and safely orders swapped bounds', () => {
    expect(normalizePaceRange({ min: '5:45', max: '5:15' })).toEqual({
      min: '5:15',
      max: '5:45',
    });
    expect(normalizePaceRange({ min: 'fast', max: '5:15' })).toBeUndefined();
  });
});

describe('intensity target normalization', () => {
  it('treats legacy single-pace sessions as manual pace targets while preserving pace', () => {
    const normalized = normalizeSessionIntensityTarget(session({ pace: '5:20' }));

    expect(normalized.pace).toBe('5:20');
    expect(normalized.intensityTarget).toEqual({
      source: 'manual',
      mode: 'pace',
      pace: '5:20',
    });
    expect(getSessionIntensityTarget(normalized)).toEqual(normalized.intensityTarget);
  });

  it('normalizes a structured single pace and keeps legacy pace writable', () => {
    const normalized = normalizeSessionIntensityTarget(session({
      pace: undefined,
      intensityTarget: {
        source: 'profile',
        mode: 'pace',
        profileKey: 'steady',
        pace: '4:55',
      },
    }));

    expect(normalized.pace).toBe('4:55');
    expect(normalized.intensityTarget).toMatchObject({
      source: 'profile',
      mode: 'pace',
      profileKey: 'steady',
      pace: '4:55',
    });
    expect(representativeSessionPaceSeconds(normalized)).toBe(295);
  });

  it('normalizes range targets and exposes a representative midpoint pace', () => {
    const target = normalizeIntensityTarget({
      source: 'manual',
      mode: 'pace',
      profileKey: 'easy',
      paceRange: { min: '5:45', max: '5:15' },
      effortCue: 'conversational',
    });

    expect(target).toEqual({
      source: 'manual',
      mode: 'pace',
      profileKey: 'easy',
      paceRange: { min: '5:15', max: '5:45' },
      effortCue: 'conversational',
    });
    expect(representativePaceSeconds(target)).toBe(330);
    expect(representativePace(target)).toBe('5:30');
    expect(detectIntensityTargetType(target)).toBe('paceRange');
  });

  it('keeps effort-only sessions pace-free when no legacy fallback exists', () => {
    const normalized = normalizeSessionIntensityTarget(session({
      pace: undefined,
      intensityTarget: {
        source: 'profile',
        mode: 'effort',
        profileKey: 'recovery',
        effortCue: 'very easy',
      },
    }));

    expect(normalized.pace).toBeUndefined();
    expect(normalized.intensityTarget).toEqual({
      source: 'profile',
      mode: 'effort',
      profileKey: 'recovery',
      effortCue: 'very easy',
    });
    expect(representativeSessionPaceSeconds(normalized)).toBeNull();
    expect(formatIntensityTarget(normalized)).toBe('very easy');
  });

  it('supports both pace and effort cues for threshold-style targets', () => {
    const target = normalizeIntensityTarget({
      source: 'manual',
      mode: 'both',
      profileKey: 'threshold',
      paceRange: { min: '4:10', max: '4:25' },
      effortCue: 'controlled hard',
    });

    expect(detectIntensityTargetType(target)).toBe('both');
    expect(formatIntensityTarget(target)).toBe('4:10-4:25 /km, controlled hard');
    expect(intensityTargetContext(target)).toBe('target 4:10-4:25 /km, controlled hard');
  });

  it('falls back safely when malformed target data is present', () => {
    const normalized = normalizeSessionIntensityTarget(session({
      pace: '5:40',
      intensityTarget: {
        source: 'wat' as never,
        mode: 'both',
        profileKey: 'missing' as never,
        paceRange: { min: 'bad', max: '5:00' },
        effortCue: 'gentle' as never,
      },
    }));

    expect(normalized.intensityTarget).toEqual({
      source: 'manual',
      mode: 'pace',
      pace: '5:40',
    });
    expect(normalized.pace).toBe('5:40');
  });
});
