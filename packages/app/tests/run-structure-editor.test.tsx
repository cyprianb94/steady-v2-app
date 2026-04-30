import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlannedSession } from '@steady/types';

import { RunStructureEditor } from '../components/plan-builder/RunStructureEditor';
import { SessionEditorScreen } from '../components/plan-builder/SessionEditorScreen';

function renderEditor(session: Partial<PlannedSession>, onSave = vi.fn()) {
  render(
    <RunStructureEditor
      dayIndex={6}
      session={session}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );

  return onSave;
}

describe('RunStructureEditor', () => {
  it('opens from the simple session editor CTA as a full-screen flow', () => {
    render(
      <SessionEditorScreen
        dayIndex={6}
        existing={{ type: 'LONG', distance: 26, pace: '5:10' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Add run structure'));

    expect(screen.getByTestId('run-structure-editor')).toBeTruthy();
    expect(screen.getByText('Run structure')).toBeTruthy();
  });

  it('saves marathon-pace blocks without changing the parent Long role', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    fireEvent.click(screen.getByText('Race-pace blocks'));

    expect(screen.getByText('3 x 3km marathon pace off 1km float')).toBeTruthy();

    fireEvent.click(screen.getByText('Save run structure'));

    expect(onSave).toHaveBeenCalledWith(6, expect.objectContaining({
      type: 'LONG',
      plannedVolume: { unit: 'km', value: 26 },
      distance: 26,
      runStructure: {
        items: [
          {
            kind: 'REPEAT',
            repeats: 3,
            segments: [
              expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 3 } }),
              expect.objectContaining({ kind: 'FLOAT', volume: { unit: 'km', value: 1 } }),
            ],
          },
        ],
      },
    }));
  });

  it('saves a fartlek ladder as multiple one-level repeat groups with seconds precision', () => {
    const onSave = renderEditor({
      type: 'INTERVAL',
      reps: 6,
      repDist: 800,
      recovery: { unit: 'min', value: 2 },
    });

    fireEvent.click(screen.getByText('Fartlek ladder'));
    fireEvent.click(screen.getByText('Save run structure'));

    expect(onSave.mock.calls[0][1].runStructure.items).toEqual([
      expect.objectContaining({
        kind: 'REPEAT',
        repeats: 4,
        segments: [
          expect.objectContaining({ volume: { unit: 'sec', value: 90 } }),
          expect.objectContaining({ volume: { unit: 'sec', value: 90 } }),
        ],
      }),
      expect.objectContaining({
        kind: 'REPEAT',
        repeats: 4,
        segments: [
          expect.objectContaining({ volume: { unit: 'min', value: 1 } }),
          expect.objectContaining({ volume: { unit: 'min', value: 1 } }),
        ],
      }),
      expect.objectContaining({
        kind: 'REPEAT',
        repeats: 4,
        segments: [
          expect.objectContaining({ volume: { unit: 'sec', value: 30 } }),
          expect.objectContaining({ volume: { unit: 'sec', value: 30 } }),
        ],
      }),
    ]);
  });

  it('allows plan-note-only saves without creating run structure', () => {
    const onSave = renderEditor({
      type: 'EASY',
      distance: 8,
      pace: '5:20',
    });

    fireEvent.click(screen.getByText('Remove'));
    fireEvent.change(screen.getByPlaceholderText('Add coach wording or context.'), {
      target: { value: 'Keep it relaxed after travel.' },
    });
    fireEvent.click(screen.getByText('Save run structure'));

    expect(onSave).toHaveBeenCalledWith(6, expect.objectContaining({
      type: 'EASY',
      planNote: 'Keep it relaxed after travel.',
      runStructure: undefined,
    }));
  });
});
