import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  deriveTrainingPaceProfile,
  type PlannedSession,
  type TrainingPaceProfile,
} from '@steady/types';

import { RunStructureEditor } from '../components/plan-builder/RunStructureEditor';
import { SessionEditorScreen } from '../components/plan-builder/SessionEditorScreen';

function renderEditor(
  session: Partial<PlannedSession>,
  onSave = vi.fn(),
  trainingPaceProfile: TrainingPaceProfile | null = null,
) {
  render(
    <RunStructureEditor
      dayIndex={6}
      session={session}
      trainingPaceProfile={trainingPaceProfile}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );

  return onSave;
}

function dragHandle(testId: string, pageY: number) {
  const handle = screen.getByTestId(testId);
  fireEvent.mouseDown(handle, { clientY: 0 });
  fireEvent.mouseMove(handle, { clientY: pageY });
  fireEvent.mouseUp(handle);
}

function openTemplates() {
  fireEvent.click(screen.getByText('Change'));
}

function activeChipFor(label: string): Element | undefined {
  return screen.getAllByText(label).find((node) => (
    node.parentElement?.getAttribute('style')?.includes('border-color: rgb(24, 127, 122)')
  ));
}

function activeLongChipFor(label: string): Element | undefined {
  return screen.getAllByText(label).find((node) => (
    node.parentElement?.getAttribute('style')?.includes('border-color: rgb(27, 58, 107)')
  ));
}

describe('RunStructureEditor', () => {
  it('switches from simple to structured in the same edit flow', () => {
    render(
      <SessionEditorScreen
        dayIndex={6}
        existing={{ type: 'LONG', distance: 26, pace: '5:10' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Structured'));

    expect(screen.getByTestId('run-structure-editor')).toBeTruthy();
    expect(screen.getByText('26km long · Structured')).toBeTruthy();
  });

  it('opens an already structured run directly in the structure editor', () => {
    const onClose = vi.fn();

    render(
      <SessionEditorScreen
        dayIndex={6}
        existing={{
          type: 'LONG',
          distance: 15.8,
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
        }}
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(screen.getByTestId('run-structure-editor')).toBeTruthy();
    expect(screen.getByText('15.8km long · Structured')).toBeTruthy();

    fireEvent.click(screen.getByText('Cancel'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('converts a structured run to the simple editor only after confirmation', () => {
    const onSave = vi.fn();

    render(
      <SessionEditorScreen
        dayIndex={6}
        existing={{
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
        }}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Simple'));

    expect(screen.getByText('Use simple run?')).toBeTruthy();
    expect(screen.getByText('Distance: 15.8km from structure')).toBeTruthy();

    fireEvent.click(screen.getByText('Use simple run'));

    expect(screen.queryByTestId('run-structure-editor')).toBeNull();
    expect(screen.getByText('Distance')).toBeTruthy();
    expect(screen.getByText('15.8')).toBeTruthy();
    expect(screen.getByText('Structured')).toBeTruthy();

    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(6, expect.objectContaining({
      type: 'LONG',
      format: 'simple',
      distance: 15.8,
    }));
    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved.runStructure).toBeUndefined();
    expect(saved.plannedVolume).toBeUndefined();
  });

  it('saves marathon-pace blocks without changing the parent Long role', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Race-pace blocks'));

    expect(screen.getByText((text) => text.includes('5km warmup easy, 3× 3km marathon pace, 1km float'))).toBeTruthy();
    expect(screen.getByText('Adds up to')).toBeTruthy();
    expect(screen.getByText('Quality')).toBeTruthy();
    expect(screen.getByText('Repeats')).toBeTruthy();
    expect(screen.getAllByText('9km').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.queryByText('Calculated total')).toBeNull();
    expect(screen.queryByText('Add repeat')).toBeNull();

    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(6, expect.objectContaining({
      type: 'LONG',
      format: 'structured',
      plannedVolume: { unit: 'km', value: 26 },
      distance: 26,
      runStructure: {
        items: [
          expect.objectContaining({ kind: 'WARMUP', volume: { unit: 'km', value: 5 } }),
          {
            kind: 'REPEAT',
            repeats: 3,
            segments: [
              expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 3 } }),
              expect.objectContaining({ kind: 'FLOAT', volume: { unit: 'km', value: 1 } }),
            ],
          },
          expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 9 } }),
        ],
      },
    }));
  });

  it('does not duplicate the selected template when the picker is reopened', () => {
    renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Race-pace blocks'));
    openTemplates();

    expect(screen.getAllByText('Race-pace blocks')).toHaveLength(1);
  });

  it('builds progression runs as explicit effort segments', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 15,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Progression'));

    expect(screen.getByText((text) => text.includes('8km easy, 4km steady, 3km marathon pace'))).toBeTruthy();

    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved).toEqual(expect.objectContaining({
      type: 'LONG',
      format: 'structured',
      plannedVolume: { unit: 'km', value: 15 },
      distance: 15,
    }));
    expect(saved.runStructure?.items).toEqual([
      expect.objectContaining({
        kind: 'RUN',
        volume: { unit: 'km', value: 8 },
        intensityTarget: expect.objectContaining({ profileKey: 'easy' }),
      }),
      expect.objectContaining({
        kind: 'RUN',
        volume: { unit: 'km', value: 4 },
        intensityTarget: expect.objectContaining({ profileKey: 'steady' }),
      }),
      expect.objectContaining({
        kind: 'RUN',
        volume: { unit: 'km', value: 3 },
        intensityTarget: expect.objectContaining({ profileKey: 'marathon' }),
      }),
    ]);
    saved.runStructure?.items.forEach((item) => {
      if (item.kind === 'REPEAT') return;
      expect(item.progression).toBeUndefined();
    });
  });

  it('keeps a chosen template selected when opening a segment without changing it', () => {
    renderEditor({
      type: 'LONG',
      distance: 15,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Progression'));

    fireEvent.click(screen.getByTestId('run-structure-segment-0-single'));
    fireEvent.click(activeLongChipFor('Run')!);

    openTemplates();

    expect(screen.getByTestId('run-structure-template-progression').getAttribute('style')).toContain(
      'border-color: rgb(27, 58, 107)',
    );
  });

  it('marks template segment training paces as selected when a profile is available', () => {
    const onSave = renderEditor(
      {
        type: 'LONG',
        distance: 15,
        pace: '5:10',
      },
      vi.fn(),
      deriveTrainingPaceProfile({ raceDistance: 'Marathon', targetTime: '03:15:00' }),
    );

    openTemplates();
    fireEvent.click(screen.getByText('Progression'));

    fireEvent.click(screen.getByTestId('run-structure-segment-0-single'));
    expect(activeChipFor('Easy')).toBeTruthy();
    fireEvent.click(activeChipFor('Easy')!);

    openTemplates();
    expect(screen.getByTestId('run-structure-template-progression').getAttribute('style')).toContain(
      'border-color: rgb(27, 58, 107)',
    );

    fireEvent.click(screen.getByTestId('run-structure-segment-1-single'));
    expect(activeChipFor('Steady')).toBeTruthy();

    fireEvent.click(screen.getByTestId('run-structure-segment-2-single'));
    expect(activeChipFor('Race pace')).toBeTruthy();

    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved.runStructure?.items).toEqual([
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

  it('saves a fartlek ladder as multiple one-level repeat groups with seconds precision', () => {
    const onSave = renderEditor({
      type: 'INTERVAL',
      reps: 6,
      repDist: 800,
      recovery: { unit: 'min', value: 2 },
    });

    openTemplates();
    fireEvent.click(screen.getByText('Fartlek ladder'));
    fireEvent.click(screen.getByText('Update session'));

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

  it('shows a segment intensity cue once when the target already includes effort', () => {
    renderEditor({
      type: 'TEMPO',
      distance: 10,
    });

    expect(screen.getByText('4:15-4:25/km · controlled hard')).toBeTruthy();
    expect(screen.queryByText('4:15-4:25/km · controlled hard · controlled hard')).toBeNull();
  });

  it('uses the shared plan-builder drag flow to reorder top-level structure items', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Race-pace blocks'));
    dragHandle('run-structure-drag-handle-0', 120);
    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved.runStructure?.items[0]).toEqual(expect.objectContaining({
      kind: 'RUN',
      volume: { unit: 'km', value: 9 },
    }));
    expect(saved.runStructure?.items[2]).toEqual(expect.objectContaining({
      kind: 'WARMUP',
      volume: { unit: 'km', value: 5 },
    }));
  });

  it('uses the same drag flow inside repeat groups', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Race-pace blocks'));
    dragHandle('run-structure-repeat-segment-drag-handle-1-0', 70);
    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    const repeatGroup = saved.runStructure?.items[1];
    expect(repeatGroup).toEqual(expect.objectContaining({ kind: 'REPEAT' }));
    if (repeatGroup?.kind !== 'REPEAT') throw new Error('Expected repeat group');
    expect(repeatGroup.segments[0]).toEqual(expect.objectContaining({
      kind: 'FLOAT',
      volume: { unit: 'km', value: 1 },
    }));
    expect(repeatGroup.segments[1]).toEqual(expect.objectContaining({
      kind: 'RUN',
      volume: { unit: 'km', value: 3 },
    }));
  });

  it('lets each segment save its own target pace', () => {
    const onSave = renderEditor(
      {
        type: 'LONG',
        distance: 26,
        pace: '5:10',
      },
      vi.fn(),
      deriveTrainingPaceProfile({ raceDistance: 'Marathon', targetTime: '03:15:00' }),
    );

    fireEvent.click(screen.getByText('Run'));
    fireEvent.click(screen.getByText('Race pace'));
    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved.runStructure?.items[0]).toEqual(expect.objectContaining({
      kind: 'RUN',
      intensityTarget: expect.objectContaining({
        source: 'profile',
        profileKey: 'marathon',
      }),
    }));
  });

  it('locks the run-structure scroll view while a structure card is being dragged', () => {
    renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Race-pace blocks'));
    expect(screen.getByTestId('run-structure-scroll')).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId('run-structure-drag-handle-0'), { clientY: 0 });

    expect(screen.getByTestId('run-structure-scroll-locked')).toBeTruthy();
  });

  it('treats the structured total as the saved parent volume', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 18,
      plannedVolume: { unit: 'km', value: 18 },
      pace: '5:10',
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

    expect(screen.getByText('15.8km')).toBeTruthy();
    expect(screen.getByText('Structure adds up to 15.8km. Saving will update this session from 18km.')).toBeTruthy();

    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(6, expect.objectContaining({
      type: 'LONG',
      format: 'structured',
      distance: 15.8,
      plannedVolume: { unit: 'km', value: 15.8 },
    }));
  });

  it('requires a valid structure before saving structured mode', () => {
    const onSave = renderEditor({
      type: 'EASY',
      distance: 8,
      pace: '5:20',
    });

    fireEvent.click(screen.getByText('Remove'));
    fireEvent.change(screen.getByPlaceholderText('Add coach wording or context.'), {
      target: { value: 'Keep it relaxed after travel.' },
    });
    fireEvent.click(screen.getByText('Update session'));

    expect(screen.getByText('Add at least one valid segment before saving.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
});
