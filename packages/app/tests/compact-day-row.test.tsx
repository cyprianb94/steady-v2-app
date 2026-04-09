import React from 'react';
import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText('8km @ 5:20')).toBeTruthy();
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

    expect(screen.getByTestId('day-row-missed')).toBeTruthy();
    expect(screen.getByText('Missed')).toBeTruthy();
  });

  it('shows a today badge for the current planned session', () => {
    render(
      <CompactDayRow
        dayName="Thu"
        status="today"
        session={{
          id: 's4',
          type: 'TEMPO',
          date: '2026-04-09',
          distance: 10,
          pace: '4:20',
        }}
      />,
    );

    expect(screen.getByTestId('day-row-today')).toBeTruthy();
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
});
