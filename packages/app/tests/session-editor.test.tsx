import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import * as Haptics from 'expo-haptics';
import { describe, expect, it, vi } from 'vitest';

import { SessionEditor } from '../components/plan-builder/SessionEditor';
import type { PlannedSession } from '@steady/types';

function renderSessionEditor(existing: Partial<PlannedSession>) {
  render(
    <SessionEditor
      dayIndex={1}
      existing={existing}
      onSave={vi.fn()}
      onClose={vi.fn()}
      presentation="screen"
    />,
  );
}

function expectCustomInputBlank() {
  const customInput = screen.getByTestId('editable-chip-custom-input') as HTMLInputElement;
  expect(customInput.value).toBe('');
  return customInput;
}

const intervalSession = {
  type: 'INTERVAL' as const,
  reps: 6,
  repDist: 800,
  recovery: '90s' as const,
  pace: '3:50',
  warmup: { unit: 'km' as const, value: 1.5 },
  cooldown: { unit: 'km' as const, value: 1 },
};

describe('SessionEditor custom field editing', () => {
  it.each([
    {
      label: 'Distance',
      existing: { type: 'LONG' as const, distance: 20, pace: '5:10' },
    },
    {
      label: 'Repetitions',
      existing: intervalSession,
    },
    {
      label: 'Rep target pace',
      existing: intervalSession,
    },
    {
      label: 'Recovery between reps',
      existing: intervalSession,
    },
    {
      label: 'Warm-up',
      existing: intervalSession,
    },
    {
      label: 'Cool-down',
      existing: intervalSession,
    },
  ])('opens $label custom input empty instead of copying the selected value', ({ label, existing }) => {
    renderSessionEditor(existing);

    fireEvent.click(screen.getByText(label));
    fireEvent.click(screen.getByText('Custom...'));

    expectCustomInputBlank();
  });

  it('opens a previously selected custom target pace as an empty input for replacement', () => {
    renderSessionEditor(intervalSession);

    fireEvent.click(screen.getByText('Rep target pace'));
    fireEvent.click(screen.getByText('Custom...'));
    fireEvent.change(expectCustomInputBlank(), {
      target: { value: '3:42' },
    });
    fireEvent.blur(screen.getByTestId('editable-chip-custom-input'));

    fireEvent.click(screen.getByText('3:42 /km'));

    expectCustomInputBlank();
  });
});

describe('SessionEditor haptics', () => {
  it('emits selection haptics only when chip values change', () => {
    vi.mocked(Haptics.selectionAsync).mockClear();

    renderSessionEditor(intervalSession);

    fireEvent.click(screen.getByText('Tempo'));
    fireEvent.click(screen.getByText('Target pace'));
    fireEvent.click(screen.getByText('4:15 /km'));
    fireEvent.click(screen.getByText('Warm-up'));
    fireEvent.click(screen.getAllByText('MIN')[0]);
    fireEvent.click(screen.getByText('Custom...'));

    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);
  });
});

describe('SessionEditor keyboard-safe custom duration editing', () => {
  it.each([
    { label: 'Warm-up', field: 'warmup' as const },
    { label: 'Cool-down', field: 'cooldown' as const },
  ])('saves a custom $label value while rendered in the keyboard-safe frame', ({ label, field }) => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={1}
        existing={{
          type: 'INTERVAL',
          reps: 6,
          repDist: 800,
          recovery: '90s',
          pace: '3:50',
          warmup: { unit: 'km', value: 1.5 },
          cooldown: { unit: 'km', value: 1 },
        }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    expect(screen.getByTestId('session-editor-keyboard-frame')).toBeTruthy();

    fireEvent.click(screen.getByText(label));
    fireEvent.click(screen.getByText('Custom...'));
    expect(screen.queryByPlaceholderText('Custom km')).toBeNull();
    const customInput = screen.getByTestId('editable-chip-custom-input');
    fireEvent.change(customInput, {
      target: { value: '2.5' },
    });
    fireEvent.blur(customInput);

    expect(screen.getByText('2.5 km')).toBeTruthy();
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(1, expect.objectContaining({
      [field]: { unit: 'km', value: 2.5 },
    }));
  });
});

describe('SessionEditor warmup and cooldown availability', () => {
  it.each([
    { type: 'EASY' as const, distance: 8, pace: '5:20' },
    { type: 'LONG' as const, distance: 16, pace: '5:10' },
  ])('hides and strips workout bookends for $type sessions', ({ type, distance, pace }) => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={0}
        existing={{
          type,
          distance,
          pace,
          warmup: { unit: 'km', value: 1.5 },
          cooldown: { unit: 'km', value: 1 },
        }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    expect(screen.queryByText('Warm-up')).toBeNull();
    expect(screen.queryByText('Cool-down')).toBeNull();

    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1];
    expect(saved).toMatchObject({ type, distance, pace });
    expect(saved).not.toHaveProperty('warmup');
    expect(saved).not.toHaveProperty('cooldown');
  });
});

describe('SessionEditor target pace editing', () => {
  it('saves a changed target pace for tempo sessions', () => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={3}
        existing={{ type: 'TEMPO', distance: 10, pace: '4:20' }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    fireEvent.click(screen.getByText('Target pace'));
    fireEvent.click(screen.getByText('4:15 /km'));
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(3, expect.objectContaining({
      type: 'TEMPO',
      distance: 10,
      pace: '4:15',
    }));
  });

  it('saves a custom target pace for interval sessions', () => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={1}
        existing={{
          type: 'INTERVAL',
          reps: 6,
          repDist: 800,
          recovery: '90s',
          pace: '3:50',
        }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    fireEvent.click(screen.getByText('Rep target pace'));
    fireEvent.click(screen.getByText('Custom...'));
    expect(screen.queryByPlaceholderText('Custom pace')).toBeNull();
    const customInput = screen.getByTestId('editable-chip-custom-input');
    fireEvent.change(customInput, {
      target: { value: '3:42' },
    });
    fireEvent.blur(customInput);

    expect(screen.getByText('3:42 /km')).toBeTruthy();
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(1, expect.objectContaining({
      type: 'INTERVAL',
      reps: 6,
      repDist: 800,
      repDuration: { unit: 'km', value: 0.8 },
      recovery: { unit: 'min', value: 1.5 },
      pace: '3:42',
    }));
  });

  it.each([
    { type: 'EASY' as const, distance: 8, pace: '5:20', nextPace: '5:15' },
    { type: 'LONG' as const, distance: 16, pace: '5:10', nextPace: '5:05' },
  ])('saves a changed target pace for $type sessions', ({ type, distance, pace, nextPace }) => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={0}
        existing={{ type, distance, pace }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    fireEvent.click(screen.getByText('Target pace'));
    fireEvent.click(screen.getByText(`${nextPace} /km`));
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(0, expect.objectContaining({
      type,
      distance,
      pace: nextPace,
    }));
  });
});

describe('SessionEditor distance editing', () => {
  it('keeps a visible custom distance option for default long runs', () => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={6}
        existing={{ type: 'LONG', distance: 20, pace: '5:10' }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    fireEvent.click(screen.getByText('Distance'));

    expect(screen.getByText('20 km')).toBeTruthy();
    fireEvent.click(screen.getByText('Custom...'));
    const customInput = screen.getByTestId('editable-chip-custom-input');
    fireEvent.change(customInput, {
      target: { value: '21' },
    });
    fireEvent.blur(customInput);

    expect(screen.getByText('21 km')).toBeTruthy();
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(6, expect.objectContaining({
      type: 'LONG',
      distance: 21,
      pace: '5:10',
    }));
  });
});

describe('SessionEditor interval notebook rows', () => {
  it('saves custom repetition duration and recovery without the old rep distance section', () => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={1}
        existing={{
          type: 'INTERVAL',
          reps: 6,
          repDist: 800,
          recovery: '90s',
          pace: '3:50',
        }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    expect(screen.queryByText('Rep distance')).toBeNull();

    fireEvent.click(screen.getByText('Repetitions'));
    fireEvent.click(screen.getAllByText('MIN')[0]);
    fireEvent.click(screen.getByText('4 min'));

    fireEvent.click(screen.getByText('Recovery between reps'));
    fireEvent.click(screen.getByText('Custom...'));
    const customInput = screen.getByTestId('editable-chip-custom-input');
    fireEvent.change(customInput, {
      target: { value: '2.5' },
    });
    fireEvent.blur(customInput);

    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(1, expect.objectContaining({
      type: 'INTERVAL',
      reps: 6,
      repDuration: { unit: 'min', value: 4 },
      recovery: { unit: 'min', value: 2.5 },
      pace: '3:50',
    }));
  });
});
