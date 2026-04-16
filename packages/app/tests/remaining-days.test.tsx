import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import type { PlannedSession } from '@steady/types';
import { createActivityResolution } from '../features/run/activity-resolution';

vi.mock('../lib/trpc', () => ({ trpc: {} }));

import { RemainingDaysList } from '../components/home/RemainingDaysList';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function makeSession(date: string, type: 'EASY' | 'REST' = 'EASY'): PlannedSession | null {
  return type === 'REST'
    ? null
    : { id: `s-${date}`, type, date, distance: 8, pace: '5:20' };
}

function renderRemainingDaysList({
  sessions,
  today,
  weekStartDate,
  activities = [],
}: {
  sessions: (PlannedSession | null)[];
  today: string;
  weekStartDate: string;
  activities?: any[];
}) {
  const resolution = createActivityResolution(activities);

  return render(
    <RemainingDaysList
      sessions={sessions}
      today={today}
      weekStartDate={weekStartDate}
      activityForSession={resolution.activityForSession}
      statusForDay={resolution.statusForDay}
    />,
  );
}

describe('RemainingDaysList', () => {
  it('renders the full current week with past, today, and future days', () => {
    // Today is Thursday (index 3), so the full Mon-Sun week should show.
    const sessions = DAYS.map((_, i) =>
      makeSession(`2026-04-${String(7 + i).padStart(2, '0')}`),
    );

    renderRemainingDaysList({
      sessions,
      today: '2026-04-09',
      weekStartDate: '2026-04-06',
    });

    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(screen.getByText('APR 6')).toBeTruthy();
    expect(screen.getByText('Tue')).toBeTruthy();
    expect(screen.getByText('Wed')).toBeTruthy();
    expect(screen.getByText('Thu')).toBeTruthy();
    expect(screen.getByText('Fri')).toBeTruthy();
    expect(screen.getByText('Sat')).toBeTruthy();
    expect(screen.getByText('Sun')).toBeTruthy();
    expect(screen.getAllByTestId('day-row-warning')).toHaveLength(3);
    expect(screen.getAllByText('8k').length).toBeGreaterThan(0);
    expect(screen.queryByText('Missed')).toBeNull();
  });

  it('still renders all days when today is Sunday', () => {
    const sessions = DAYS.map((_, i) =>
      makeSession(`2026-04-${String(7 + i).padStart(2, '0')}`),
    );

    renderRemainingDaysList({
      sessions,
      today: '2026-04-12',
      weekStartDate: '2026-04-06',
    });

    expect(screen.queryAllByTestId('compact-day-row')).toHaveLength(7);
    expect(screen.getAllByTestId('day-row-warning')).toHaveLength(6);
    expect(screen.getAllByText('8k').length).toBeGreaterThan(0);
  });

  it('falls back to weekday position when saved dates do not include today', () => {
    const sessions = DAYS.map((_, i) =>
      makeSession(`2026-06-${String(15 + i).padStart(2, '0')}`),
    );

    renderRemainingDaysList({
      sessions,
      today: '2026-04-10',
      weekStartDate: '2026-04-06',
    });

    expect(screen.getByText('Fri')).toBeTruthy();
    expect(screen.getAllByText('8k').length).toBeGreaterThan(0);
    expect(screen.getByText('Sat')).toBeTruthy();
    expect(screen.getByText('Sun')).toBeTruthy();
  });

  it('shows actual distance for completed sessions when activity data is available', () => {
    const sessions = DAYS.map((_, i) =>
      makeSession(`2026-04-${String(7 + i).padStart(2, '0')}`),
    );
    sessions[0] = {
      id: 's-2026-04-07',
      type: 'EASY',
      date: '2026-04-07',
      distance: 8,
      pace: '5:20',
      actualActivityId: 'act-1',
    };

    renderRemainingDaysList({
      sessions,
      today: '2026-04-09',
      weekStartDate: '2026-04-06',
      activities: [
        {
          id: 'act-1',
          userId: 'u1',
          source: 'strava',
          externalId: 'ext-1',
          startTime: '2026-04-07T07:00:00.000Z',
          distance: 8.2,
          duration: 2600,
          avgPace: 317,
          splits: [],
          matchedSessionId: 's-2026-04-07',
        },
      ],
    });

    expect(screen.getByText('8.2k')).toBeTruthy();
    expect(screen.getByTestId('day-row-check')).toBeTruthy();
  });

  it('keeps completed sessions visually completed when they are materially short of plan', () => {
    const sessions = DAYS.map((_, i) =>
      makeSession(`2026-04-${String(7 + i).padStart(2, '0')}`),
    );
    sessions[0] = {
      id: 's-2026-04-07',
      type: 'EASY',
      date: '2026-04-07',
      distance: 8,
      pace: '5:20',
      actualActivityId: 'act-1',
    };

    renderRemainingDaysList({
      sessions,
      today: '2026-04-09',
      weekStartDate: '2026-04-06',
      activities: [
        {
          id: 'act-1',
          userId: 'u1',
          source: 'strava',
          externalId: 'ext-1',
          startTime: '2026-04-07T07:00:00.000Z',
          distance: 5.5,
          duration: 2200,
          avgPace: 400,
          splits: [],
          matchedSessionId: 's-2026-04-07',
        },
      ],
    });

    expect(screen.getByText('5.5k')).toBeTruthy();
    expect(screen.getAllByTestId('day-row-off-target').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('day-row-warning')).toHaveLength(2);
  });

  it('keeps completed sessions visually completed when pace drifts past the 5% tolerance', () => {
    const sessions = DAYS.map((_, i) =>
      makeSession(`2026-04-${String(7 + i).padStart(2, '0')}`),
    );
    sessions[0] = {
      id: 's-2026-04-07',
      type: 'EASY',
      date: '2026-04-07',
      distance: 8,
      pace: '5:20',
      actualActivityId: 'act-1',
    };

    renderRemainingDaysList({
      sessions,
      today: '2026-04-09',
      weekStartDate: '2026-04-06',
      activities: [
        {
          id: 'act-1',
          userId: 'u1',
          source: 'strava',
          externalId: 'ext-1',
          startTime: '2026-04-07T07:00:00.000Z',
          distance: 8,
          duration: 2704,
          avgPace: 338,
          splits: [],
          matchedSessionId: 's-2026-04-07',
        },
      ],
    });

    expect(screen.getAllByText('8k').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('day-row-off-target').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('day-row-warning')).toHaveLength(2);
  });

  it('shows planned totals on the right for incomplete week rows', () => {
    const sessions: (PlannedSession | null)[] = [
      { id: 'mon', type: 'EASY', date: '2026-04-06', distance: 8, pace: '5:20' },
      { id: 'tue', type: 'TEMPO', date: '2026-04-07', distance: 10, pace: '4:20' },
      null,
      { id: 'thu', type: 'EASY', date: '2026-04-09', distance: 12, pace: '5:10' },
      null,
      null,
      null,
    ];

    renderRemainingDaysList({
      sessions,
      today: '2026-04-09',
      weekStartDate: '2026-04-06',
    });

    expect(screen.getAllByText('8k').length).toBeGreaterThan(0);
    expect(screen.getByText('10k')).toBeTruthy();
    expect(screen.getByText('12k')).toBeTruthy();
  });
});
