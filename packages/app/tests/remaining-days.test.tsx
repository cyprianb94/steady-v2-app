import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
  onSessionPress,
}: {
  sessions: (PlannedSession | null)[];
  today: string;
  weekStartDate: string;
  activities?: any[];
  onSessionPress?: (session: PlannedSession, status: any) => void;
}) {
  const resolution = createActivityResolution(activities);

  return render(
    <RemainingDaysList
      sessions={sessions}
      today={today}
      weekStartDate={weekStartDate}
      activityForSession={resolution.activityForSession}
      activityIdForSession={resolution.activityIdForSession}
      statusForDay={resolution.statusForDay}
      onSessionPress={onSessionPress}
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
    expect(screen.queryByText('8k')).toBeNull();
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
    expect(screen.queryByText('8k')).toBeNull();
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
    expect(screen.queryByText('8k')).toBeNull();
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
    expect(screen.getAllByTestId('day-row-check').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('day-row-off-target')).toBeNull();
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

    expect(screen.getByText('8k')).toBeTruthy();
    expect(screen.getAllByTestId('day-row-check').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('day-row-off-target')).toBeNull();
    expect(screen.getAllByTestId('day-row-warning')).toHaveLength(2);
  });

  it('does not repeat planned totals on the right for incomplete week rows', () => {
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

    expect(screen.queryByText('8k')).toBeNull();
    expect(screen.queryByText('10k')).toBeNull();
    expect(screen.queryByText('12k')).toBeNull();
  });

  it('makes past unlogged planned rows pressable so Home can open the resolve sheet', () => {
    const onSessionPress = vi.fn();
    const sessions = DAYS.map((_, i) =>
      makeSession(`2026-04-${String(6 + i).padStart(2, '0')}`),
    );

    renderRemainingDaysList({
      sessions,
      today: '2026-04-09',
      weekStartDate: '2026-04-06',
      onSessionPress,
    });

    fireEvent.click(screen.getAllByTestId('compact-day-row-pressable')[0]);
    expect(onSessionPress).toHaveBeenCalledWith(sessions[0], 'missed');
  });

  it('makes today and future unlogged planned rows pressable so a new week is inspectable', () => {
    const onSessionPress = vi.fn();
    const sessions = DAYS.map((_, i) =>
      makeSession(`2026-04-${String(6 + i).padStart(2, '0')}`),
    );

    renderRemainingDaysList({
      sessions,
      today: '2026-04-06',
      weekStartDate: '2026-04-06',
      onSessionPress,
    });

    const pressableRows = screen.getAllByTestId('compact-day-row-pressable');
    expect(pressableRows).toHaveLength(7);

    fireEvent.click(pressableRows[0]);
    fireEvent.click(pressableRows[1]);
    expect(onSessionPress).toHaveBeenNthCalledWith(1, sessions[0], 'today');
    expect(onSessionPress).toHaveBeenNthCalledWith(2, sessions[1], 'upcoming');
  });

  it('makes skipped planned rows pressable so the skipped status can be edited', () => {
    const onSessionPress = vi.fn();
    const sessions = DAYS.map((_, i) =>
      makeSession(`2026-04-${String(6 + i).padStart(2, '0')}`),
    );
    sessions[0] = {
      ...sessions[0]!,
      skipped: {
        reason: 'busy',
        markedAt: '2026-04-06T12:00:00.000Z',
      },
    };

    renderRemainingDaysList({
      sessions,
      today: '2026-04-09',
      weekStartDate: '2026-04-06',
      onSessionPress,
    });

    fireEvent.click(screen.getAllByTestId('compact-day-row-pressable')[0]);
    expect(onSessionPress).toHaveBeenCalledWith(sessions[0], 'skipped');
  });
});
