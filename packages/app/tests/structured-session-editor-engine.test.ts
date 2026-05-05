import { describe, expect, it } from 'vitest';
import {
  deriveTrainingPaceProfile,
  sessionKm,
  summariseRunStructure,
  type PlannedSession,
} from '@steady/types';
import {
  applyStructuredSessionTemplate,
  buildStructuredSessionSave,
  convertStructuredSessionDraftToSimple,
  createStructuredSessionDraft,
  getStructuredSessionTemplatesForType,
  sessionTypeSupportsStructuredFormat,
} from '../features/plan-builder/structured-session-editor-engine';

describe('structured session editor engine', () => {
  it('reports structured format support by session type', () => {
    expect(sessionTypeSupportsStructuredFormat('EASY')).toBe(true);
    expect(sessionTypeSupportsStructuredFormat('INTERVAL')).toBe(true);
    expect(sessionTypeSupportsStructuredFormat('TEMPO')).toBe(true);
    expect(sessionTypeSupportsStructuredFormat('LONG')).toBe(true);
    expect(sessionTypeSupportsStructuredFormat('RECOVERY')).toBe(false);
    expect(sessionTypeSupportsStructuredFormat('REST')).toBe(false);
  });

  it('offers structured templates only for run session types that support structure', () => {
    expect(getStructuredSessionTemplatesForType('EASY').map((template) => template.key)).toEqual([
      'fast-finish',
      'progression',
      'strides',
      'custom',
    ]);
    expect(getStructuredSessionTemplatesForType('INTERVAL').map((template) => template.key)).toEqual([
      'cruise-intervals',
      'short-reps',
      'fartlek-ladder',
      'custom',
    ]);
    expect(getStructuredSessionTemplatesForType('TEMPO').map((template) => template.key)).toEqual([
      'fast-finish',
      'progression',
      'cruise-intervals',
      'custom',
    ]);
    expect(getStructuredSessionTemplatesForType('LONG').map((template) => template.key)).toEqual([
      'fast-finish',
      'progression',
      'race-pace-blocks',
      'custom',
    ]);

    expect(getStructuredSessionTemplatesForType('RECOVERY')).toEqual([]);
    expect(getStructuredSessionTemplatesForType('REST')).toEqual([]);
  });

  it('turns simple interval fields into an editable structured repeat', () => {
    const draft = createStructuredSessionDraft({
      type: 'INTERVAL',
      reps: 5,
      repDuration: { unit: 'km', value: 1 },
      recovery: { unit: 'min', value: 2 },
      pace: '3:50',
    });

    expect(draft.session).toMatchObject({
      type: 'INTERVAL',
      format: 'structured',
    });
    expect(draft.items).toEqual([
      {
        kind: 'REPEAT',
        repeats: 5,
        segments: [
          expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 1 } }),
          expect.objectContaining({ kind: 'RECOVERY', volume: { unit: 'min', value: 2 } }),
        ],
      },
    ]);
  });

  it('applies templates and materializes parent volume from the structured total', () => {
    const templated = applyStructuredSessionTemplate({
      templateKey: 'race-pace-blocks',
      session: {
        type: 'LONG',
        distance: 26,
        pace: '5:10',
      },
    });
    const saved = buildStructuredSessionSave({
      session: templated.session,
      items: templated.items,
      planNote: 'Keep the floats honest.',
    }) as Partial<PlannedSession>;

    expect(saved).toMatchObject({
      type: 'LONG',
      format: 'structured',
      distance: 26,
      plannedVolume: { unit: 'km', value: 26 },
      planNote: 'Keep the floats honest.',
    });
    expect(sessionKm(saved as PlannedSession)).toBe(26);
    expect(summariseRunStructure(saved as PlannedSession)).toBe(
      '5km warmup easy, 3× 3km marathon pace, 1km float, 9km easy',
    );
  });

  it('hydrates profile-backed template targets without changing the structure shape', () => {
    const profile = deriveTrainingPaceProfile({
      raceDistance: 'Marathon',
      targetTime: '03:15:00',
    });

    const templated = applyStructuredSessionTemplate({
      templateKey: 'progression',
      session: {
        type: 'LONG',
        distance: 15,
        pace: '5:10',
      },
      trainingPaceProfile: profile,
    });

    expect(templated.items).toEqual([
      expect.objectContaining({
        intensityTarget: expect.objectContaining({ source: 'profile', profileKey: 'easy' }),
      }),
      expect.objectContaining({
        intensityTarget: expect.objectContaining({ source: 'profile', profileKey: 'steady' }),
      }),
      expect.objectContaining({
        intensityTarget: expect.objectContaining({ source: 'profile', profileKey: 'marathon' }),
      }),
    ]);
  });

  it('converts a structured draft back to a simple session and clears structured fields', () => {
    const draft = createStructuredSessionDraft({
      type: 'LONG',
      distance: 18,
      plannedVolume: { unit: 'km', value: 18 },
      pace: '5:10',
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
    });

    const simple = convertStructuredSessionDraftToSimple({
      session: draft.session,
      items: draft.items,
      planNote: 'Keep it relaxed.',
    });

    expect(simple).toMatchObject({
      type: 'LONG',
      format: 'simple',
      distance: 15.8,
      planNote: 'Keep it relaxed.',
    });
    expect(simple).not.toHaveProperty('plannedVolume');
    expect(simple).not.toHaveProperty('runStructure');
  });

  it('saves Recovery as simple duration and clears stale structured fields', () => {
    const simple = convertStructuredSessionDraftToSimple({
      session: {
        type: 'RECOVERY',
        distance: 12,
        pace: '5:10',
        plannedVolume: { unit: 'min', value: 35 },
        reps: 5,
        warmup: { unit: 'km', value: 2 },
        runStructure: {
          items: [
            { kind: 'RUN', volume: { unit: 'km', value: 10 } },
          ],
        },
      },
      items: [
        { kind: 'RUN', volume: { unit: 'km', value: 10 } },
      ],
      planNote: 'Keep this very gentle.',
    });

    expect(simple).toMatchObject({
      type: 'RECOVERY',
      format: 'simple',
      plannedVolume: { unit: 'min', value: 35 },
      planNote: 'Keep this very gentle.',
    });
    expect(simple).not.toHaveProperty('distance');
    expect(simple).not.toHaveProperty('pace');
    expect(simple).not.toHaveProperty('reps');
    expect(simple).not.toHaveProperty('warmup');
    expect(simple).not.toHaveProperty('runStructure');
  });

  it('saves Rest as a simple rest state and clears all run metrics', () => {
    const saved = buildStructuredSessionSave({
      session: {
        type: 'REST',
        distance: 8,
        pace: '5:20',
        plannedVolume: { unit: 'km', value: 8 },
        reps: 6,
        warmup: { unit: 'km', value: 1 },
        cooldown: { unit: 'km', value: 1 },
        runStructure: {
          items: [
            { kind: 'RUN', volume: { unit: 'km', value: 8 } },
          ],
        },
      },
      items: [
        { kind: 'RUN', volume: { unit: 'km', value: 8 } },
      ],
      planNote: 'Full rest.',
    });

    expect(saved).toMatchObject({
      type: 'REST',
      format: 'simple',
      planNote: 'Full rest.',
    });
    expect(saved).not.toHaveProperty('distance');
    expect(saved).not.toHaveProperty('pace');
    expect(saved).not.toHaveProperty('plannedVolume');
    expect(saved).not.toHaveProperty('runStructure');
    expect(saved).not.toHaveProperty('reps');
    expect(saved).not.toHaveProperty('warmup');
    expect(saved).not.toHaveProperty('cooldown');
  });
});
