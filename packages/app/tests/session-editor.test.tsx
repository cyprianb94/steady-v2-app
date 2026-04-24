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

    fireEvent.click(screen.getByText('Target pace'));
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
      recovery: '90s',
      pace: '3:42',
    }));
  });
});
