import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../lib/trpc', () => ({ trpc: {} }));

import { CompactDayRow } from '../components/home/CompactDayRow';

describe('CompactDayRow', () => {
  it('renders day name, session label for a planned session', () => {
    render(
      <CompactDayRow
        dayName="Thu"
        session={{
          id: 's1',
          type: 'EASY',
          date: '2026-04-10',
          distance: 8,
          pace: '5:20',
        }}
      />,
    );

    expect(screen.getByText('Thu')).toBeTruthy();
    expect(screen.getByText('8km · 5:20')).toBeTruthy();
    expect(screen.getByText('Easy Run')).toBeTruthy();
  });

  it('renders interval rows with reps first and workout type after', () => {
    render(
      <CompactDayRow
        dayName="Tue"
        session={{
          id: 's-interval',
          type: 'INTERVAL',
          date: '2026-04-08',
          reps: 6,
          repDist: 800,
          pace: '3:50',
        }}
      />,
    );

    expect(screen.getByText('6×800m · 3:50')).toBeTruthy();
    expect(screen.getByText('Intervals')).toBeTruthy();
  });

  it('shows a checkmark when session has actualActivityId', () => {
    render(
      <CompactDayRow
        dayName="Wed"
        session={{
          id: 's2',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'act-1',
        }}
      />,
    );

    expect(screen.getByTestId('day-row-check')).toBeTruthy();
  });

  it('shows missed state for an unfinished past session', () => {
    render(
      <CompactDayRow
        dayName="Tue"
        status="missed"
        session={{
          id: 's3',
          type: 'TEMPO',
          date: '2026-04-08',
          distance: 10,
          pace: '4:20',
        }}
      />,
    );

    expect(screen.getByTestId('day-row-warning')).toBeTruthy();
  });

  it('shows skipped state for an explicitly skipped session', () => {
    render(
      <CompactDayRow
        dayName="Wed"
        status="skipped"
        session={{
          id: 's-skipped',
          type: 'INTERVAL',
          date: '2026-04-08',
          reps: 5,
          repDuration: { unit: 'min', value: 8 },
          pace: '4:10',
          skipped: {
            reason: 'busy',
            markedAt: '2026-04-09T10:00:00.000Z',
          },
        }}
      />,
    );

    expect(screen.getByText('Skipped')).toBeTruthy();
    expect(screen.queryByTestId('day-row-warning')).toBeNull();
  });

  it('shows a completed-style badge for off-target completed sessions', () => {
    render(
      <CompactDayRow
        dayName="Wed"
        status="off-target"
        metricLabel="8.4k"
        session={{
          id: 's-off-target',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'act-1',
        }}
      />,
    );

    expect(screen.getByTestId('day-row-off-target')).toBeTruthy();
    expect(screen.queryByTestId('day-row-warning')).toBeNull();
    expect(screen.getByText('8.4k')).toBeTruthy();
  });

  it('shows the right-hand metric for the current planned session', () => {
    render(
      <CompactDayRow
        dayName="Thu"
        status="today"
        metricLabel="10k"
        session={{
          id: 's4',
          type: 'TEMPO',
          date: '2026-04-09',
          distance: 10,
          pace: '4:20',
        }}
      />,
    );

    expect(screen.getByText('10k')).toBeTruthy();
  });

  it('renders rest day with muted label', () => {
    render(
      <CompactDayRow
        dayName="Fri"
        session={null}
      />,
    );

    expect(screen.getByText('Fri')).toBeTruthy();
    expect(screen.getByText('Rest')).toBeTruthy();
  });

  it('becomes pressable when a row action is provided', () => {
    const onPress = vi.fn();

    render(
      <CompactDayRow
        dayName="Sat"
        onPress={onPress}
        session={{
          id: 's5',
          type: 'LONG',
          date: '2026-04-11',
          distance: 18,
          pace: '5:10',
          actualActivityId: 'act-1',
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('compact-day-row-pressable'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
