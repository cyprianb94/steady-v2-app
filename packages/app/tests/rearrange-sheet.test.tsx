import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlannedSession } from '@steady/types';

import { RearrangeSheet } from '../components/block/RearrangeSheet';

function session(id: string, type: PlannedSession['type'], overrides: Partial<PlannedSession> = {}): PlannedSession {
  return { id, type, date: '2026-04-06', ...overrides };
}

const weekSessions: (PlannedSession | null)[] = [
  session('easy', 'EASY', { distance: 8, pace: '5:20' }),
  null,
  session('interval', 'INTERVAL', { reps: 6, repDist: 800, pace: '3:50' }),
  session('tempo', 'TEMPO', { distance: 10, pace: '4:20' }),
  null,
  session('long', 'LONG', { distance: 18, pace: '5:30' }),
  null,
];

describe('RearrangeSheet', () => {
  it('renders seven day slots with session labels', () => {
    render(
      <RearrangeSheet
        visible={true}
        weekNumber={4}
        sessions={weekSessions}
        onCancel={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    expect(screen.getByText('Week 4')).toBeTruthy();
    expect(screen.getAllByTestId(/rearrange-day-/)).toHaveLength(7);
    expect(screen.getByText('8km @ 5:20')).toBeTruthy();
    expect(screen.getAllByText('Rest')).toHaveLength(3);
    expect(screen.getByText('6×800m @ 3:50')).toBeTruthy();
  });

  it('swaps selected days and emits the swap log on done', () => {
    const onDone = vi.fn();
    render(
      <RearrangeSheet
        visible={true}
        weekNumber={4}
        sessions={weekSessions}
        onCancel={vi.fn()}
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByTestId('rearrange-day-0'));
    fireEvent.click(screen.getByTestId('rearrange-day-5'));
    fireEvent.click(screen.getByTestId('rearrange-done'));

    expect(onDone).toHaveBeenCalledTimes(1);
    const [sessions, swapLog] = onDone.mock.calls[0];
    expect(sessions[0]?.id).toBe('long');
    expect(sessions[5]?.id).toBe('easy');
    expect(swapLog).toEqual([{ from: 0, to: 5 }]);
  });

  it('highlights a selected day and deselects it when tapped again', () => {
    render(
      <RearrangeSheet
        visible={true}
        weekNumber={4}
        sessions={weekSessions}
        onCancel={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    const monday = screen.getByTestId('rearrange-day-0') as HTMLElement;
    fireEvent.click(monday);
    expect(monday.style.borderColor).toBe('rgb(196, 82, 42)');

    fireEvent.click(monday);
    expect(monday.style.borderColor).toBe('rgb(229, 221, 208)');
  });

  it('does not allow completed sessions to be moved', () => {
    const onDone = vi.fn();
    const sessions = [
      session('easy', 'EASY', { distance: 8, actualActivityId: 'act-1' }),
      null,
      session('long', 'LONG', { distance: 18 }),
      null,
      null,
      null,
      null,
    ];

    render(
      <RearrangeSheet
        visible={true}
        weekNumber={4}
        sessions={sessions}
        onCancel={vi.fn()}
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByTestId('rearrange-day-0'));
    fireEvent.click(screen.getByTestId('rearrange-day-2'));
    fireEvent.click(screen.getByTestId('rearrange-done'));

    const [nextSessions, swapLog] = onDone.mock.calls[0];
    expect(nextSessions[0]?.id).toBe('easy');
    expect(nextSessions[2]?.id).toBe('long');
    expect(swapLog).toEqual([]);
  });

  it('undo reverts the last swap before done', () => {
    const onDone = vi.fn();
    render(
      <RearrangeSheet
        visible={true}
        weekNumber={4}
        sessions={weekSessions}
        onCancel={vi.fn()}
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByTestId('rearrange-day-0'));
    fireEvent.click(screen.getByTestId('rearrange-day-5'));
    fireEvent.click(screen.getByTestId('rearrange-undo'));
    fireEvent.click(screen.getByTestId('rearrange-done'));

    const [sessions, swapLog] = onDone.mock.calls[0];
    expect(sessions[0]?.id).toBe('easy');
    expect(sessions[5]?.id).toBe('long');
    expect(swapLog).toEqual([]);
  });

  it('cancel exits without saving', () => {
    const onCancel = vi.fn();
    const onDone = vi.fn();
    render(
      <RearrangeSheet
        visible={true}
        weekNumber={4}
        sessions={weekSessions}
        onCancel={onCancel}
        onDone={onDone}
      />,
    );

    fireEvent.click(screen.getByTestId('rearrange-day-0'));
    fireEvent.click(screen.getByTestId('rearrange-day-5'));
    fireEvent.click(screen.getByTestId('rearrange-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('shows a conflict warning after a swap creates adjacent hard sessions', () => {
    const sessions = [
      session('interval', 'INTERVAL', { reps: 6, repDist: 800 }),
      null,
      session('tempo', 'TEMPO', { distance: 8 }),
      null,
      null,
      null,
      null,
    ];

    render(
      <RearrangeSheet
        visible={true}
        weekNumber={4}
        sessions={sessions}
        onCancel={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('rearrange-conflict-warning')).toBeNull();

    fireEvent.click(screen.getByTestId('rearrange-day-2'));
    fireEvent.click(screen.getByTestId('rearrange-day-1'));

    expect(screen.getByTestId('rearrange-conflict-warning')).toBeTruthy();
    expect(screen.getByText('Mon-Tue')).toBeTruthy();
  });
});
