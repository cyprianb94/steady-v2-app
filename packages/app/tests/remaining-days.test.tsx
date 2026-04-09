import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../lib/trpc', () => ({ trpc: {} }));

import { RemainingDaysList } from '../components/home/RemainingDaysList';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function makeSession(date: string, type: 'EASY' | 'REST' = 'EASY') {
  return type === 'REST'
    ? null
    : { id: `s-${date}`, type, date, distance: 8, pace: '5:20' };
}

describe('RemainingDaysList', () => {
  it('only renders days after today', () => {
    // Today is Wednesday (index 2), so Thu/Fri/Sat/Sun should show
    const sessions = DAYS.map((_, i) =>
      makeSession(`2026-04-${String(7 + i).padStart(2, '0')}`),
    );

    render(
      <RemainingDaysList
        sessions={sessions}
        today="2026-04-09" // Wednesday
      />,
    );

    // Past + today should NOT appear
    expect(screen.queryByText('Mon')).toBeNull();
    expect(screen.queryByText('Tue')).toBeNull();
    expect(screen.queryByText('Wed')).toBeNull();

    // Future should appear
    expect(screen.getByText('Thu')).toBeTruthy();
    expect(screen.getByText('Fri')).toBeTruthy();
    expect(screen.getByText('Sat')).toBeTruthy();
    expect(screen.getByText('Sun')).toBeTruthy();
  });

  it('renders nothing when today is Sunday (no remaining days)', () => {
    const sessions = DAYS.map((_, i) =>
      makeSession(`2026-04-${String(7 + i).padStart(2, '0')}`),
    );

    const { container } = render(
      <RemainingDaysList
        sessions={sessions}
        today="2026-04-13" // Sunday
      />,
    );

    // No day rows should be rendered
    expect(screen.queryAllByTestId('compact-day-row')).toHaveLength(0);
  });

  it('falls back to weekday position when saved dates do not include today', () => {
    const sessions = DAYS.map((_, i) =>
      makeSession(`2026-06-${String(15 + i).padStart(2, '0')}`),
    );

    render(
      <RemainingDaysList
        sessions={sessions}
        today="2026-04-10" // Friday
      />,
    );

    expect(screen.queryByText('Fri')).toBeNull();
    expect(screen.getByText('Sat')).toBeTruthy();
    expect(screen.getByText('Sun')).toBeTruthy();
  });
});
