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
} from '../features/plan-builder/structured-session-editor-engine';

describe('structured session editor engine', () => {
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
      '5km easy, 3 x 3km marathon pace off 1km float, 9km easy',
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
});
