import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  deriveTrainingPaceProfile,
  type PlannedSession,
  type TrainingPaceProfile,
} from '@steady/types';

import { RunStructureEditor } from '../components/plan-builder/RunStructureEditor';
import { SessionEditorScreen } from '../components/plan-builder/SessionEditorScreen';
import { useDirectListReorder } from '../features/plan-builder/use-direct-list-reorder';

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

function longPressDrag(testId: string, pageY: number) {
  vi.useFakeTimers();
  const target = screen.getByTestId(testId);
  fireEvent.mouseDown(target, { clientX: 0, clientY: 0 });
  act(() => {
    vi.advanceTimersByTime(400);
  });
  fireEvent.mouseMove(target, { clientX: 0, clientY: pageY });
  fireEvent.mouseUp(target);
  vi.useRealTimers();
}

function longPressDragWithHover(testId: string, pageY: number) {
  vi.useFakeTimers();
  const target = screen.getByTestId(testId);
  fireEvent.mouseDown(target, { clientX: 0, clientY: 0 });
  act(() => {
    vi.advanceTimersByTime(400);
  });
  fireEvent.mouseMove(target, { clientX: 0, clientY: pageY });
  return () => {
    fireEvent.mouseUp(target);
    vi.useRealTimers();
  };
}

function advanceHeldDragAnimation() {
  act(() => {
    vi.advanceTimersByTime(220);
  });
}

function swipeLeft(testId: string, dx = -150) {
  const target = screen.getByTestId(testId);
  fireEvent.mouseDown(target, { clientX: 0 });
  fireEvent.mouseMove(target, { clientX: dx });
  fireEvent.mouseUp(target);
}

function hoverSwipeLeft(testId: string, dx: number) {
  const target = screen.getByTestId(testId);
  fireEvent.mouseDown(target, { clientX: 0 });
  fireEvent.mouseMove(target, { clientX: dx });
  return () => fireEvent.mouseUp(target);
}

function openTemplates() {
  const toggle = screen.queryByText('Change') ?? screen.queryByText('Browse');
  if (!toggle) {
    throw new Error('Template picker toggle not found');
  }
  fireEvent.click(toggle);
}

function activeChipFor(label: string): Element | undefined {
  return screen.getAllByText(label).find((node) => (
    node.parentElement?.getAttribute('style')?.includes('border-color: rgb(24, 127, 122)')
  ));
}

const directListReorderHarnessItems = [0, 1, 2];

function DirectListReorderHarness() {
  const order = useDirectListReorder<number>({
    initialItems: directListReorderHarnessItems,
    canCombineItem: (_dragged, _target, fromIndex, targetIndex) => fromIndex !== targetIndex,
    combineItems: (items) => items,
  });

  function registerBaseLayouts() {
    order.registerSlotLayout(0, 0, 58);
    order.registerSlotLayout(1, 68, 58);
    order.registerSlotLayout(2, 136, 58);
  }

  function registerVariableLayouts() {
    order.registerSlotLayout(0, 0, 58);
    order.registerSlotLayout(1, 68, 58);
    order.registerSlotLayout(2, 136, 220);
  }

  function moveTo(dy: number) {
    order.updateDrag(dy);
  }

  return (
    <div>
      <button
        type="button"
        data-testid="reorder-start"
        onClick={() => {
          registerBaseLayouts();
          order.recordTouchStart(0);
          order.beginDrag(2);
        }}
      >
        start
      </button>
      <button
        type="button"
        data-testid="reorder-start-large-bottom"
        onClick={() => {
          registerVariableLayouts();
          order.recordTouchStart(0);
          order.beginDrag(2);
        }}
      >
        start large bottom
      </button>
      <button
        type="button"
        data-testid="reorder-start-top"
        onClick={() => {
          registerBaseLayouts();
          order.recordTouchStart(0);
          order.beginDrag(0);
        }}
      >
        start top
      </button>
      <button
        type="button"
        data-testid="reorder-move-before-entry"
        onClick={() => moveTo(-20)}
      >
        move before entry
      </button>
      <button
        type="button"
        data-testid="reorder-move-entry-cushion"
        onClick={() => moveTo(-36)}
      >
        move entry cushion
      </button>
      <button
        type="button"
        data-testid="reorder-move-entry"
        onClick={() => moveTo(-58)}
      >
        move entry
      </button>
      <button
        type="button"
        data-testid="reorder-move-through"
        onClick={() => moveTo(-90)}
      >
        move
      </button>
      <button
        type="button"
        data-testid="reorder-move-down-before-entry"
        onClick={() => moveTo(20)}
      >
        move down before entry
      </button>
      <button
        type="button"
        data-testid="reorder-move-down-entry-cushion"
        onClick={() => moveTo(36)}
      >
        move down entry cushion
      </button>
      <button
        type="button"
        data-testid="reorder-move-down-entry"
        onClick={() => moveTo(58)}
      >
        move down entry
      </button>
      <button
        type="button"
        data-testid="reorder-move-down-through"
        onClick={() => moveTo(90)}
      >
        move down through
      </button>
      <button
        type="button"
        data-testid="reorder-report-moved-layout"
        onClick={() => order.registerSlotLayout(2, 78, 58)}
      >
        report moved layout
      </button>
      <div data-testid="reorder-over-index">
        {order.dragState?.overIndex ?? 'none'}
      </div>
      <div data-testid="reorder-combine-index">
        {order.dragState?.combineIndex ?? 'none'}
      </div>
      <div data-testid="reorder-preview-1">
        {order.previewOffsetForIndex(1)}
      </div>
    </div>
  );
}

function activeNeutralChipFor(label: string): Element | undefined {
  return screen.getAllByText(label).find((node) => (
    node.parentElement?.getAttribute('style')?.includes('border-color: rgb(61, 48, 40)')
  ));
}

const unsupportedStructuredFormatExplanation =
  'Structured runs are available for Easy, Interval, Tempo, and Long sessions.';
const recoveryClearPreview =
  'Saving as Recovery will clear this structure. Switch back before saving to keep your structured draft.';
const simpleClearPreview =
  'Saving as Simple will clear this structure. Switch back before saving to keep your structured draft.';

function structuredLongSession(): Partial<PlannedSession> {
  return {
    type: 'LONG',
    distance: 15,
    plannedVolume: { unit: 'km', value: 15 },
    pace: '5:10',
    runStructure: {
      items: [
        {
          kind: 'RUN',
          volume: { unit: 'km', value: 12 },
          intensityTarget: {
            source: 'manual',
            mode: 'effort',
            profileKey: 'easy',
            effortCue: 'conversational',
          },
        },
        {
          kind: 'RUN',
          volume: { unit: 'km', value: 3 },
          intensityTarget: {
            source: 'manual',
            mode: 'effort',
            profileKey: 'marathon',
            effortCue: 'race pace',
          },
        },
      ],
    },
  };
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

  it('keeps the Structured tab visible but disabled with an explanation for Recovery sessions', () => {
    render(
      <SessionEditorScreen
        dayIndex={1}
        existing={{
          type: 'RECOVERY',
          format: 'structured',
          plannedVolume: { unit: 'min', value: 35 },
          runStructure: {
            items: [
              { kind: 'RUN', volume: { unit: 'km', value: 6 } },
            ],
          },
        }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('run-structure-editor')).toBeNull();
    expect(screen.getByText('Format')).toBeTruthy();
    expect(screen.getByText('Simple')).toBeTruthy();
    expect(screen.getByText('Structured')).toBeTruthy();
    expect(screen.getByText(unsupportedStructuredFormatExplanation)).toBeTruthy();

    fireEvent.click(screen.getByText('Structured'));

    expect(screen.queryByTestId('run-structure-editor')).toBeNull();
    expect(screen.getByText('Duration')).toBeTruthy();
  });

  it('keeps the Structured tab visible but disabled with an explanation for Rest days', () => {
    render(
      <SessionEditorScreen
        dayIndex={1}
        existing={{
          type: 'REST',
          format: 'structured',
          runStructure: {
            items: [
              { kind: 'RUN', volume: { unit: 'km', value: 6 } },
            ],
          },
        }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('run-structure-editor')).toBeNull();
    expect(screen.getByText('Format')).toBeTruthy();
    expect(screen.getByText('Simple')).toBeTruthy();
    expect(screen.getByText('Structured')).toBeTruthy();
    expect(screen.getByText(unsupportedStructuredFormatExplanation)).toBeTruthy();
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

  it('previews a Recovery switch as clear-on-save and restores the structured draft when switching back', () => {
    const onSave = vi.fn();

    render(
      <SessionEditorScreen
        dayIndex={6}
        existing={structuredLongSession()}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText((text) => text.includes('12km easy, 3km marathon pace'))).toBeTruthy();

    fireEvent.click(screen.getByText('Recovery'));

    expect(screen.getByText(recoveryClearPreview)).toBeTruthy();

    fireEvent.click(screen.getByText('Long'));

    expect(screen.getByText((text) => text.includes('12km easy, 3km marathon pace'))).toBeTruthy();

    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved).toMatchObject({
      type: 'LONG',
      format: 'structured',
      distance: 15,
      runStructure: {
        items: [
          expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 12 } }),
          expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 3 } }),
        ],
      },
    });
  });

  it('clears structure only on save when a structured draft is switched to Recovery', () => {
    const onSave = vi.fn();

    render(
      <SessionEditorScreen
        dayIndex={6}
        existing={structuredLongSession()}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Recovery'));
    expect(screen.getByText(recoveryClearPreview)).toBeTruthy();

    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved).toMatchObject({
      type: 'RECOVERY',
      format: 'simple',
      plannedVolume: { unit: 'min', value: 35 },
    });
    expect(saved).not.toHaveProperty('runStructure');
    expect(saved).not.toHaveProperty('distance');
    expect(saved).not.toHaveProperty('pace');
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

    expect(screen.getByText('Switch to Simple?')).toBeTruthy();
    expect(screen.getByText('Distance: 15.8km from structure')).toBeTruthy();

    fireEvent.click(screen.getByText('Use simple run'));

    expect(screen.queryByTestId('run-structure-editor')).toBeNull();
    expect(screen.getByText('Distance')).toBeTruthy();
    expect(screen.getByText('15.8')).toBeTruthy();
    expect(screen.getByText('Structured')).toBeTruthy();
    expect(screen.getByText(simpleClearPreview)).toBeTruthy();
    expect(screen.queryByText(recoveryClearPreview)).toBeNull();

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

    expect(screen.getByText('3 rounds · 12km')).toBeTruthy();
    expect(screen.getByText('What kind of run is this?')).toBeTruthy();
    expect(screen.getByText('Simple keeps it as a single run. Structured breaks it into segments.')).toBeTruthy();
    expect(screen.getByText('Distance')).toBeTruthy();
    expect(screen.getByText('Time')).toBeTruthy();
    expect(screen.getByText('Quality')).toBeTruthy();
    expect(screen.queryByText('Adds up to')).toBeNull();
    expect(screen.queryByText('Repeats')).toBeNull();
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
    expect(screen.queryByText('Pick a starting structure. You can edit anything afterwards.')).toBeNull();
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
    fireEvent.click(activeNeutralChipFor('Run')!);

    openTemplates();

    expect(screen.getByTestId('run-structure-template-progression')).toBeTruthy();
    expect(screen.getByText('Selected ✓')).toBeTruthy();
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
    expect(screen.getByTestId('run-structure-template-progression')).toBeTruthy();
    expect(screen.getByText('Selected ✓')).toBeTruthy();

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
    longPressDrag('run-structure-segment-swipe-0-single', 120);
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

  it('shows a swap target while dragging past another top-level structure item', () => {
    renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Race-pace blocks'));

    expect(screen.queryByTestId('run-structure-drag-handle-0')).toBeNull();

    const finishDrag = longPressDragWithHover('run-structure-segment-swipe-0-single', 120);
    advanceHeldDragAnimation();

    expect(screen.getByTestId('run-structure-item-0').getAttribute('style')).toContain('top: 120px');
    expect(screen.getByTestId('run-structure-item-2').getAttribute('style')).toMatch(/top: -\d/);
    expect(screen.getByTestId('run-structure-swap-target-2')).toBeTruthy();

    finishDrag();
  });

  it('uses drag-and-drop grouping guidance instead of a duplicate group button', () => {
    renderEditor({
      type: 'LONG',
      distance: 18,
      plannedVolume: { unit: 'km', value: 18 },
      pace: '5:10',
      runStructure: {
        items: [
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 1 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 17 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
        ],
      },
    });

    expect(screen.getByText('Drag and drop segments together to create a repeat group.')).toBeTruthy();
    expect(screen.queryByText('Group last 2 segments')).toBeNull();
  });

  it('uses the same drag flow inside repeat groups', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Race-pace blocks'));
    longPressDrag('run-structure-segment-swipe-1-0', 70);
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

  it('drops a top-level segment onto a repeat group to add it instead of swapping', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Race-pace blocks'));

    const finishDrag = longPressDragWithHover('run-structure-segment-swipe-2-single', -58);

    expect(screen.getByText('Drop to add to group')).toBeTruthy();

    finishDrag();
    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    const repeatGroup = saved.runStructure?.items[1];
    expect(saved.runStructure?.items).toHaveLength(2);
    expect(repeatGroup).toEqual(expect.objectContaining({ kind: 'REPEAT' }));
    if (repeatGroup?.kind !== 'REPEAT') throw new Error('Expected repeat group');
    expect(repeatGroup.segments).toEqual([
      expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 3 } }),
      expect.objectContaining({ kind: 'FLOAT', volume: { unit: 'km', value: 1 } }),
      expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 9 } }),
    ]);
  });

  it('drops an adjacent segment onto a loose segment to create a repeat group', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 18,
      plannedVolume: { unit: 'km', value: 18 },
      pace: '5:10',
      runStructure: {
        items: [
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 1 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 1 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 16 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
        ],
      },
    });

    const finishDrag = longPressDragWithHover('run-structure-segment-swipe-0-single', 58);

    expect(screen.getByText('Drop to group')).toBeTruthy();

    finishDrag();
    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    const repeatGroup = saved.runStructure?.items[0];
    expect(saved.runStructure?.items).toHaveLength(2);
    expect(repeatGroup).toEqual(expect.objectContaining({
      kind: 'REPEAT',
      repeats: 2,
    }));
    if (repeatGroup?.kind !== 'REPEAT') throw new Error('Expected repeat group');
    expect(repeatGroup.segments).toEqual([
      expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 1 } }),
      expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 1 } }),
    ]);
    expect(saved.runStructure?.items[1]).toEqual(expect.objectContaining({
      kind: 'RUN',
      volume: { unit: 'km', value: 16 },
    }));
  });

  it('moves a dragged segment past the entry group zone to reorder without grouping', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 6,
      plannedVolume: { unit: 'km', value: 6 },
      pace: '5:10',
      runStructure: {
        items: [
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 1 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 2 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 3 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
        ],
      },
    });

    const finishDrag = longPressDragWithHover('run-structure-segment-swipe-2-single', -90);

    expect(screen.queryByText('Drop to group')).toBeNull();
    expect(screen.getByTestId('run-structure-swap-target-1')).toBeTruthy();

    finishDrag();
    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved.runStructure?.items).toEqual([
      expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 1 } }),
      expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 3 } }),
      expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 2 } }),
    ]);
  });

  it('groups a dragged segment with a non-adjacent loose segment from the centre zone', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 6,
      plannedVolume: { unit: 'km', value: 6 },
      pace: '5:10',
      runStructure: {
        items: [
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 1 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 2 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 3 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
        ],
      },
    });

    const finishDrag = longPressDragWithHover('run-structure-segment-swipe-2-single', -116);

    expect(screen.getByText('Drop to group')).toBeTruthy();

    finishDrag();
    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved.runStructure?.items).toHaveLength(2);
    expect(saved.runStructure?.items[0]).toEqual(expect.objectContaining({
      kind: 'REPEAT',
      repeats: 2,
      segments: [
        expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 1 } }),
        expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 3 } }),
      ],
    }));
    expect(saved.runStructure?.items[1]).toEqual(expect.objectContaining({
      kind: 'RUN',
      volume: { unit: 'km', value: 2 },
    }));
  });

  it('keeps grouping aligned to the dragged card when native layout reports the moved row', () => {
    render(<DirectListReorderHarness />);

    fireEvent.click(screen.getByTestId('reorder-start'));
    fireEvent.click(screen.getByTestId('reorder-move-entry'));
    expect(screen.getByTestId('reorder-combine-index').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('reorder-report-moved-layout'));
    fireEvent.click(screen.getByTestId('reorder-move-entry'));

    expect(screen.getByTestId('reorder-combine-index').textContent).toBe('1');
  });

  it('uses directional zones so grouping is offered before swapping when dragging upward', () => {
    render(<DirectListReorderHarness />);

    fireEvent.click(screen.getByTestId('reorder-start'));
    fireEvent.click(screen.getByTestId('reorder-move-before-entry'));
    expect(screen.getByTestId('reorder-over-index').textContent).toBe('2');
    expect(screen.getByTestId('reorder-combine-index').textContent).toBe('none');

    fireEvent.click(screen.getByTestId('reorder-move-entry-cushion'));
    expect(screen.getByTestId('reorder-over-index').textContent).toBe('1');
    expect(screen.getByTestId('reorder-combine-index').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('reorder-move-entry'));
    expect(screen.getByTestId('reorder-over-index').textContent).toBe('1');
    expect(screen.getByTestId('reorder-combine-index').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('reorder-move-through'));
    expect(screen.getByTestId('reorder-over-index').textContent).toBe('1');
    expect(screen.getByTestId('reorder-combine-index').textContent).toBe('none');
  });

  it('uses directional zones so grouping is offered before swapping when dragging downward', () => {
    render(<DirectListReorderHarness />);

    fireEvent.click(screen.getByTestId('reorder-start-top'));
    fireEvent.click(screen.getByTestId('reorder-move-down-before-entry'));
    expect(screen.getByTestId('reorder-over-index').textContent).toBe('0');
    expect(screen.getByTestId('reorder-combine-index').textContent).toBe('none');

    fireEvent.click(screen.getByTestId('reorder-move-down-entry-cushion'));
    expect(screen.getByTestId('reorder-over-index').textContent).toBe('1');
    expect(screen.getByTestId('reorder-combine-index').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('reorder-move-down-entry'));
    expect(screen.getByTestId('reorder-over-index').textContent).toBe('1');
    expect(screen.getByTestId('reorder-combine-index').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('reorder-move-down-through'));
    expect(screen.getByTestId('reorder-over-index').textContent).toBe('1');
    expect(screen.getByTestId('reorder-combine-index').textContent).toBe('none');
  });

  it('moves a smaller target far enough to make room for a dragged larger item', () => {
    render(<DirectListReorderHarness />);

    fireEvent.click(screen.getByTestId('reorder-start-large-bottom'));
    fireEvent.click(screen.getByTestId('reorder-move-through'));

    expect(screen.getByTestId('reorder-over-index').textContent).toBe('1');
    expect(screen.getByTestId('reorder-combine-index').textContent).toBe('none');
    expect(screen.getByTestId('reorder-preview-1').textContent).toBe('149');
  });

  it('swipes a loose segment left to delete it', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 18,
      plannedVolume: { unit: 'km', value: 18 },
      pace: '5:10',
      runStructure: {
        items: [
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 1 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 17 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
        ],
      },
    });

    expect(screen.queryByText('Remove')).toBeNull();

    swipeLeft('run-structure-segment-swipe-0-single');
    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved.runStructure?.items).toEqual([
      expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 17 } }),
    ]);
  });

  it('arms the swipe action only after the delete threshold', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 18,
      plannedVolume: { unit: 'km', value: 18 },
      pace: '5:10',
      runStructure: {
        items: [
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 1 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
          {
            kind: 'RUN',
            volume: { unit: 'km', value: 17 },
            intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'conversational' },
          },
        ],
      },
    });

    const cancelSwipe = hoverSwipeLeft('run-structure-segment-swipe-0-single', -30);
    expect(screen.getByTestId('run-structure-scroll-locked')).toBeTruthy();
    expect(screen.getByTestId('run-structure-segment-swipe-0-single-action-idle')).toBeTruthy();
    cancelSwipe();
    expect(screen.getByTestId('run-structure-scroll')).toBeTruthy();
    fireEvent.click(screen.getByTestId('run-structure-segment-0-single'));
    expect(screen.queryByText('Segment type')).toBeNull();

    const commitSwipe = hoverSwipeLeft('run-structure-segment-swipe-0-single', -130);
    expect(screen.getByTestId('run-structure-scroll-locked')).toBeTruthy();
    expect(screen.getByTestId('run-structure-segment-swipe-0-single-action-armed')).toBeTruthy();
    commitSwipe();
    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved.runStructure?.items).toHaveLength(1);
  });

  it('drags a segment out of a repeat group to ungroup it', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Race-pace blocks'));

    const finishDrag = longPressDragWithHover('run-structure-segment-swipe-1-1', 130);

    expect(screen.queryByText('Release to ungroup')).toBeNull();

    finishDrag();
    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved.runStructure?.items).toHaveLength(4);
    expect(saved.runStructure?.items[1]).toEqual(expect.objectContaining({
      kind: 'REPEAT',
      repeats: 3,
      segments: [
        expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 3 } }),
      ],
    }));
    expect(saved.runStructure?.items[2]).toEqual(expect.objectContaining({
      kind: 'FLOAT',
      volume: { unit: 'km', value: 1 },
    }));
  });

  it('previews an ungrouped repeat segment outside the group while dragging', () => {
    renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Race-pace blocks'));

    const finishDrag = longPressDragWithHover('run-structure-segment-swipe-1-1', 130);
    advanceHeldDragAnimation();

    const extractedPreview = screen.getByTestId('run-structure-repeat-item-1-1');
    expect(extractedPreview.getAttribute('style')).toContain('position: absolute');
    expect(extractedPreview.getAttribute('style')).toContain('left: -24px');
    expect(screen.getByTestId('run-structure-group-swipe-1').getAttribute('style')).toContain('overflow: visible');
    expect(screen.getByTestId('run-structure-item-2').getAttribute('style')).toContain('top: 76px');
    expect(screen.queryByText('Release to ungroup')).toBeNull();

    finishDrag();
  });

  it('creates a larger live slot above a repeat group while extracting upward', () => {
    renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Race-pace blocks'));

    const finishDrag = longPressDragWithHover('run-structure-segment-swipe-1-0', -130);
    advanceHeldDragAnimation();

    const extractedPreview = screen.getByTestId('run-structure-repeat-item-1-0');
    expect(extractedPreview.getAttribute('style')).toContain('position: absolute');
    expect(screen.getByTestId('run-structure-item-1').getAttribute('style')).toContain('top: 76px');

    finishDrag();
  });

  it('drags a repeat segment below a group to ungroup it after the group', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 31,
      plannedVolume: { unit: 'km', value: 31 },
      pace: '5:10',
      runStructure: {
        items: [
          {
            kind: 'REPEAT',
            repeats: 2,
            segments: [
              {
                kind: 'RUN',
                volume: { unit: 'km', value: 15 },
                intensityTarget: { source: 'manual', mode: 'effort', profileKey: 'easy', effortCue: 'very easy' },
              },
            ],
          },
        ],
      },
    });

    const finishDrag = longPressDragWithHover('run-structure-segment-swipe-0-0', 72);

    expect(screen.queryByText('Release to ungroup')).toBeNull();

    finishDrag();
    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved.runStructure?.items).toEqual([
      expect.objectContaining({
        kind: 'RUN',
        volume: { unit: 'km', value: 15 },
      }),
    ]);
  });

  it('collapses and expands repeat groups without changing totals or saved structure', () => {
    const onSave = renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Race-pace blocks'));

    expect(screen.getByText('3 rounds · 12km')).toBeTruthy();
    expect(screen.getByTestId('run-structure-segment-1-0')).toBeTruthy();
    expect(screen.getAllByText('26km').length).toBeGreaterThan(0);
    expect(screen.queryByText('Collapse group')).toBeNull();
    expect(screen.queryByText('Expand group')).toBeNull();

    fireEvent.click(screen.getByTestId('run-structure-repeat-toggle-1'));

    expect(screen.queryByTestId('run-structure-segment-1-0')).toBeNull();
    expect(screen.getByText('3 rounds · 12km')).toBeTruthy();
    expect(screen.getAllByText('26km').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('run-structure-repeat-toggle-1'));

    expect(screen.getByTestId('run-structure-segment-1-0')).toBeTruthy();

    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(saved.runStructure?.items[1]).toEqual(expect.objectContaining({
      kind: 'REPEAT',
      repeats: 3,
      segments: [
        expect.objectContaining({ kind: 'RUN', volume: { unit: 'km', value: 3 } }),
        expect.objectContaining({ kind: 'FLOAT', volume: { unit: 'km', value: 1 } }),
      ],
    }));
  });

  it('expands collapsed repeat groups after top-level structure shape changes', () => {
    renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    openTemplates();
    fireEvent.click(screen.getByText('Race-pace blocks'));
    fireEvent.click(screen.getByTestId('run-structure-repeat-toggle-1'));

    expect(screen.queryByTestId('run-structure-segment-1-0')).toBeNull();

    swipeLeft('run-structure-segment-swipe-2-single');

    expect(screen.queryByText('Collapse group')).toBeNull();
    expect(screen.queryByText('Expand group')).toBeNull();
    expect(screen.getByTestId('run-structure-segment-1-0')).toBeTruthy();
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

    const firstSegment = screen.getByTestId('run-structure-segment-swipe-0-single');
    vi.useFakeTimers();
    fireEvent.mouseDown(firstSegment, { clientX: 0, clientY: 0 });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();

    expect(screen.getByTestId('run-structure-scroll-locked')).toBeTruthy();
  });

  it('does not expand a segment from the press that ends a drag gesture', () => {
    renderEditor({
      type: 'LONG',
      distance: 26,
      pace: '5:10',
    });

    const firstSegmentSwipe = screen.getByTestId('run-structure-segment-swipe-0-single');
    const firstSegmentPress = screen.getByTestId('run-structure-segment-0-single');
    vi.useFakeTimers();
    fireEvent.mouseDown(firstSegmentSwipe, { clientX: 0, clientY: 0 });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.mouseUp(firstSegmentSwipe);
    fireEvent.click(firstSegmentPress);

    expect(screen.queryByText('Segment type')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(230);
    });
    vi.useRealTimers();
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

  it('does not show a target pace after a structured segment changes to Rest', () => {
    renderEditor({
      type: 'TEMPO',
      runStructure: {
        items: [
          {
            kind: 'RUN',
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
    });

    expect(screen.getByText('4:15-4:25/km · controlled hard')).toBeTruthy();

    fireEvent.click(screen.getByTestId('run-structure-segment-0-single'));
    const restOptions = screen.getAllByText('Rest');
    fireEvent.click(restOptions[restOptions.length - 1]);

    expect(screen.queryByText('4:15-4:25/km · controlled hard')).toBeNull();
    expect(screen.getByText('No pace target')).toBeTruthy();
  });

  it('requires a valid structure before saving structured mode', () => {
    const onSave = renderEditor({
      type: 'EASY',
      distance: 8,
      pace: '5:20',
    });

    swipeLeft('run-structure-segment-swipe-0-single');
    fireEvent.change(screen.getByPlaceholderText('Add plan wording or context.'), {
      target: { value: 'Keep it relaxed after travel.' },
    });
    fireEvent.click(screen.getByText('Update session'));

    expect(screen.getByText('Add at least one valid segment before saving.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
});
