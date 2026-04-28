import { describe, expect, it } from 'vitest';
import type { PlannedSession } from '@steady/types';
import { materializeEditedSession } from '../features/plan-builder/session-editing';

const existingEasy: PlannedSession = {
  id: 'session-1',
  type: 'EASY',
  date: '2026-04-06',
  distance: 8,
  pace: '5:20',
  intensityTarget: {
    source: 'manual',
    mode: 'effort',
    profileKey: 'easy',
    effortCue: 'conversational',
  },
};

describe('session edit materialization', () => {
  it('preserves existing intensity metadata for same-type edits', () => {
    const updated = materializeEditedSession(
      existingEasy,
      { type: 'EASY', distance: 10, pace: '5:20' },
      { id: 'fallback', date: 'preview', type: 'EASY' },
    );

    expect(updated).toMatchObject({
      id: 'session-1',
      type: 'EASY',
      distance: 10,
      intensityTarget: existingEasy.intensityTarget,
    });
  });

  it('drops stale target metadata when the session type changes and keeps legacy pace writable', () => {
    const updated = materializeEditedSession(
      existingEasy,
      {
        type: 'INTERVAL',
        reps: 6,
        repDuration: { unit: 'km', value: 0.8 },
        recovery: { unit: 'min', value: 1.5 },
        pace: '3:50',
      },
      { id: 'fallback', date: 'preview', type: 'EASY' },
    );

    expect(updated).toMatchObject({
      id: 'session-1',
      type: 'INTERVAL',
      pace: '3:50',
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        pace: '3:50',
      },
    });
  });
});
