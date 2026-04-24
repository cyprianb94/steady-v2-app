import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SessionEditor } from '../components/plan-builder/SessionEditor';

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
    const customInput = screen.getByPlaceholderText('Custom');
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
    const customInput = screen.getByPlaceholderText('Custom');
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
    const customInput = screen.getByPlaceholderText('Custom');
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
