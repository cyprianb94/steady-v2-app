import { describe, expect, it } from 'vitest';
import type { PlannedSession, RunStructure } from '../src';
import {
  deriveSessionDemand,
  deriveSessionFocus,
  normalizeSessionDurations,
  normalizeRunStructure,
  resolveSessionFormat,
  sessionKm,
  sessionSupportsFormat,
  structuredSessionVolume,
  summariseRunStructure,
} from '../src';

function session(overrides: Partial<PlannedSession>): PlannedSession {
  return {
    id: 'session-1',
    type: 'EASY',
    date: '2026-04-06',
    ...overrides,
  };
}

describe('structured session model', () => {
  it('keeps structured format available only for run sessions that support it', () => {
    expect(sessionSupportsFormat('EASY', 'structured')).toBe(true);
    expect(sessionSupportsFormat('INTERVAL', 'structured')).toBe(true);
    expect(sessionSupportsFormat('TEMPO', 'structured')).toBe(true);
    expect(sessionSupportsFormat('LONG', 'structured')).toBe(true);
    expect(sessionSupportsFormat('RECOVERY', 'structured')).toBe(false);
    expect(sessionSupportsFormat('REST', 'structured')).toBe(false);

    expect(resolveSessionFormat(session({
      type: 'LONG',
      format: 'simple',
      runStructure: {
        items: [{ kind: 'RUN', volume: { unit: 'km', value: 15 } }],
      },
    }))).toBe('structured');
    expect(resolveSessionFormat(session({
      type: 'RECOVERY',
      format: 'structured',
      runStructure: {
        items: [{ kind: 'RUN', volume: { unit: 'km', value: 5 } }],
      },
    }))).toBe('simple');
    expect(resolveSessionFormat(session({
      type: 'REST',
      format: 'structured',
      runStructure: {
        items: [{ kind: 'RUN', volume: { unit: 'km', value: 5 } }],
      },
    }))).toBe('simple');
  });

  it('represents marathon-pace long-run blocks without changing the parent role', () => {
    const structured = session({
      type: 'LONG',
      plannedVolume: { unit: 'km', value: 26 },
      runStructure: {
        items: [
          {
            kind: 'WARMUP',
            volume: { unit: 'km', value: 5 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
          {
            kind: 'REPEAT',
            repeats: 3,
            segments: [
              {
                kind: 'RUN',
                volume: { unit: 'km', value: 3 },
                intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'marathon', effortCue: 'race pace' },
              },
              {
                kind: 'FLOAT',
                volume: { unit: 'km', value: 1 },
              },
            ],
          },
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 9 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
        ],
      },
    });

    expect(structured.type).toBe('LONG');
    expect(summariseRunStructure(structured)).toBe('5km warmup easy, 3× 3km marathon pace, 1km float, 9km easy');
    expect(deriveSessionFocus(structured)).toBe('Long run · Marathon pace');
    expect(deriveSessionDemand(structured).level).toBe('demanding');
    expect(sessionKm(structured)).toBe(26);
  });

  it('uses the structured total instead of stale parent distance once structure exists', () => {
    const structured = session({
      type: 'LONG',
      distance: 18,
      plannedVolume: { unit: 'km', value: 18 },
      runStructure: {
        items: [
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 13 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
          {
            kind: 'REPEAT',
            repeats: 2,
            segments: [
              {
                kind: 'RECOVERY',
                volume: { unit: 'km', value: 0.4 },
                intensityTarget: { source: 'manual', mode: 'pace', pace: '4:22' },
              },
              {
                kind: 'RUN',
                volume: { unit: 'km', value: 1 },
                intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
              },
            ],
          },
        ],
      },
    });

    expect(structuredSessionVolume(structured)).toMatchObject({
      exactKm: 15.8,
      structuredExactKm: 15.8,
    });
    expect(sessionKm(structured)).toBe(15.8);
  });

  it('keeps seconds-level short reps precise in fartlek ladders', () => {
    const fartlek = session({
      type: 'INTERVAL',
      runStructure: {
        items: [
          onOff(4, { unit: 'sec', value: 90 }),
          onOff(4, { unit: 'min', value: 1 }),
          onOff(4, { unit: 'sec', value: 30 }),
        ],
      },
    });

    expect(summariseRunStructure(fartlek)).toBe(
      '4× 1.5min run, 1.5min recovery, 4× 1min run, 1min recovery, 4× 30s run, 30s recovery',
    );
    expect(structuredSessionVolume(fartlek)).toMatchObject({
      exactKm: 0,
      estimatedKm: 0,
      structuredSeconds: 1440,
    });
  });

  it('represents threshold cruise intervals as time-based structured work', () => {
    const cruise = session({
      type: 'TEMPO',
      runStructure: {
        items: [
          {
            kind: 'REPEAT',
            repeats: 3,
            segments: [
              {
                kind: 'RUN',
                volume: { unit: 'min', value: 10 },
                intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'threshold', effortCue: 'controlled hard' },
              },
              {
                kind: 'RECOVERY',
                volume: { unit: 'min', value: 2 },
                intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
              },
            ],
          },
        ],
      },
    });

    expect(summariseRunStructure(cruise)).toBe('3× 10min threshold, 2min jog');
    expect(deriveSessionFocus(cruise)).toBe('Tempo · Threshold');
    expect(structuredSessionVolume(cruise)).toMatchObject({
      structuredSeconds: 2160,
    });
  });

  it('counts structured Rest segment time without estimating distance from stale pace targets', () => {
    const tempoWithRest = session({
      type: 'TEMPO',
      runStructure: {
        items: [
          {
            kind: 'REPEAT',
            repeats: 3,
            segments: [
              {
                kind: 'RUN',
                volume: { unit: 'min', value: 8 },
                intensityTarget: {
                  source: 'manual',
                  mode: 'both',
                  profileKey: 'threshold',
                  paceRange: { min: '4:25', max: '4:15' },
                  effortCue: 'controlled hard',
                },
              },
              {
                kind: 'REST',
                volume: { unit: 'min', value: 3 },
                intensityTarget: {
                  source: 'manual',
                  mode: 'both',
                  profileKey: 'threshold',
                  paceRange: { min: '4:25', max: '4:15' },
                  effortCue: 'controlled hard',
                },
              },
            ],
          },
        ],
      },
    });

    expect(normalizeRunStructure(tempoWithRest.runStructure)?.items).toEqual([
      {
        kind: 'REPEAT',
        repeats: 3,
        segments: [
          expect.objectContaining({
            kind: 'RUN',
            intensityTarget: expect.objectContaining({ profileKey: 'threshold' }),
          }),
          {
            kind: 'REST',
            volume: { unit: 'min', value: 3 },
          },
        ],
      },
    ]);
    expect(structuredSessionVolume(tempoWithRest)).toMatchObject({
      structuredSeconds: 1980,
      structuredEstimatedKm: 5.5,
      estimatedKm: 5.5,
    });
  });

  it('keeps easy runs with strides easy for demand while preserving seconds', () => {
    const strides = session({
      type: 'EASY',
      distance: 8,
      runStructure: {
        items: [
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 8 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
          {
            kind: 'REPEAT',
            repeats: 6,
            segments: [
              {
                kind: 'STRIDE',
                volume: { unit: 'sec', value: 20 },
                intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'interval', effortCue: 'hard repeatable' },
              },
            ],
          },
        ],
      },
    });

    expect(summariseRunStructure(strides)).toBe('8km easy, 6× 20s strides');
    expect(deriveSessionFocus(strides)).toBe('Easy run · Strides');
    expect(deriveSessionDemand(strides)).toMatchObject({
      level: 'easy',
      isQuality: false,
    });
    expect(structuredSessionVolume(strides)).toMatchObject({
      exactKm: 8,
      structuredSeconds: 120,
    });
  });

  it('represents time-led progression runs without fake fixed chunks', () => {
    const progression = session({
      type: 'LONG',
      plannedVolume: { unit: 'min', value: 60 },
      runStructure: {
        items: [
          {
            kind: 'RUN',
            volume: { unit: 'min', value: 60 },
            progression: {
              from: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
              to: { source: 'manual', mode: 'effort', profileKey: 'marathon', effortCue: 'race pace' },
            },
          },
        ],
      },
    });

    expect(summariseRunStructure(progression)).toBe('60min progression easy to marathon pace');
    expect(deriveSessionFocus(progression)).toBe('Long run · Progression');
    expect(structuredSessionVolume(progression)).toMatchObject({
      plannedMinutes: 60,
      structuredSeconds: 3600,
    });
  });

  it('distinguishes plan note from structure-driven totals and demand', () => {
    const noted = session({
      type: 'LONG',
      distance: 18,
      planNote: 'Coach note: keep this relaxed even if you feel good.',
    });

    expect(summariseRunStructure(noted)).toBeNull();
    expect(structuredSessionVolume(noted)).toMatchObject({
      exactKm: 18,
      estimatedKm: 0,
      plannedMinutes: 0,
    });
    expect(deriveSessionFocus(noted)).toBe('Long run');
  });

  it('normalizes recovery sessions as a first-class very-easy role', () => {
    const recovery = session({
      type: 'RECOVERY',
      plannedVolume: { unit: 'min', value: 35 },
      intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'recovery', effortCue: 'very easy' },
    });

    expect(deriveSessionFocus(recovery)).toBe('Recovery run');
    expect(deriveSessionDemand(recovery).level).toBe('recovery');
    expect(structuredSessionVolume(recovery)).toMatchObject({
      exactKm: 0,
      estimatedKm: 0,
      plannedMinutes: 35,
      structuredSeconds: 0,
    });
  });

  it.each(['RECOVERY', 'REST'] as const)('normalizes %s sessions to simple format and drops stale structure', (type) => {
    const normalized = normalizeSessionDurations(session({
      type,
      format: 'structured',
      plannedVolume: type === 'RECOVERY' ? { unit: 'min', value: 35 } : undefined,
      runStructure: {
        items: [
          { kind: 'RUN', volume: { unit: 'km', value: 8 } },
        ],
      },
    }));

    expect(normalized).toMatchObject({
      type,
      format: 'simple',
    });
    expect(normalized).not.toHaveProperty('runStructure');
  });

  it('normalizes unsupported structured Recovery and Rest sessions to their simple save shapes', () => {
    const recovery = normalizeSessionDurations(session({
      type: 'RECOVERY',
      format: 'structured',
      distance: 6,
      pace: '5:50',
      plannedVolume: { unit: 'min', value: 35 },
      intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'recovery', effortCue: 'very easy' },
      reps: 4,
      repDist: 800,
      warmup: { unit: 'km', value: 1 },
      cooldown: { unit: 'km', value: 1 },
      runStructure: {
        items: [{ kind: 'RUN', volume: { unit: 'km', value: 6 } }],
      },
    }));
    const rest = normalizeSessionDurations(session({
      type: 'REST',
      format: 'structured',
      distance: 8,
      pace: '5:20',
      plannedVolume: { unit: 'km', value: 8 },
      intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
      reps: 5,
      repDist: 1000,
      repDuration: { unit: 'km', value: 1 },
      recovery: { unit: 'min', value: 2 },
      warmup: { unit: 'km', value: 1 },
      cooldown: { unit: 'km', value: 1 },
      runStructure: {
        items: [{ kind: 'RUN', volume: { unit: 'km', value: 8 } }],
      },
    }));

    expect(recovery).toMatchObject({
      type: 'RECOVERY',
      format: 'simple',
      plannedVolume: { unit: 'min', value: 35 },
      intensityTarget: expect.objectContaining({ profileKey: 'recovery', effortCue: 'very easy' }),
    });
    expect(recovery).not.toHaveProperty('distance');
    expect(recovery).not.toHaveProperty('pace');
    expect(recovery).not.toHaveProperty('runStructure');
    expect(recovery).not.toHaveProperty('reps');
    expect(recovery).not.toHaveProperty('repDist');
    expect(recovery).not.toHaveProperty('warmup');
    expect(recovery).not.toHaveProperty('cooldown');

    expect(rest).toMatchObject({
      type: 'REST',
      format: 'simple',
    });
    expect(rest).not.toHaveProperty('distance');
    expect(rest).not.toHaveProperty('pace');
    expect(rest).not.toHaveProperty('plannedVolume');
    expect(rest).not.toHaveProperty('intensityTarget');
    expect(rest).not.toHaveProperty('runStructure');
    expect(rest).not.toHaveProperty('reps');
    expect(rest).not.toHaveProperty('repDist');
    expect(rest).not.toHaveProperty('repDuration');
    expect(rest).not.toHaveProperty('recovery');
    expect(rest).not.toHaveProperty('warmup');
    expect(rest).not.toHaveProperty('cooldown');
  });

  it('rejects nested repeat groups in v1 normalization', () => {
    const invalid = {
      items: [
        {
          kind: 'REPEAT',
          repeats: 2,
          segments: [
            {
              kind: 'REPEAT',
              repeats: 2,
              segments: [
                { kind: 'RUN', volume: { unit: 'km', value: 1 } },
              ],
            },
          ],
        },
      ],
    } as unknown as RunStructure;

    expect(normalizeRunStructure(invalid)).toBeUndefined();
  });
});

function onOff(
  repeats: number,
  volume: { unit: 'min' | 'sec'; value: number },
): RunStructure['items'][number] {
  return {
    kind: 'REPEAT',
    repeats,
    segments: [
      { kind: 'RUN', volume },
      { kind: 'RECOVERY', volume },
    ],
  };
}
