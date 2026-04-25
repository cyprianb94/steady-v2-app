import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Activity, PlannedSession } from '@steady/types';
import { ResolveSessionSheet } from '../components/home/ResolveSessionSheet';

function intervalSession(overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'interval-1',
    type: 'INTERVAL',
    date: '2026-04-23',
    reps: 5,
    repDuration: { unit: 'min', value: 8 },
    distance: 10,
    pace: '4:10',
    recovery: '90s',
    warmup: { unit: 'km', value: 2 },
    cooldown: { unit: 'km', value: 1 },
    ...overrides,
  };
}

function stravaRun(overrides: Partial<Activity>): Activity {
  return {
    id: 'strava-1',
    userId: 'user-1',
    source: 'strava',
    externalId: 'external-1',
    startTime: '2026-04-23T18:42:00.000Z',
    distance: 9.8,
    duration: 2772,
    avgPace: 283,
    splits: [],
    ...overrides,
  };
}

describe('ResolveSessionSheet', () => {
  it('renders the no-match planned-session decision sheet', async () => {
    render(
      <ResolveSessionSheet
        open
        session={intervalSession()}
        possibleMatches={[]}
        onDismiss={vi.fn()}
        onLogSession={vi.fn()}
        onMarkSkipped={vi.fn()}
        onAttachMatch={vi.fn()}
      />,
    );

    expect(await screen.findByText('UNLOGGED')).toBeTruthy();
    expect(screen.getByText('Thu 23 Apr')).toBeTruthy();
    expect(screen.getByText('Intervals')).toBeTruthy();
    expect(screen.getByText('Planned: 5×8min · 10km')).toBeTruthy();
    expect(screen.getByText('No matching activity found')).toBeTruthy();
    expect(screen.getByText('Planned session')).toBeTruthy();
    expect(screen.getByText('WARM-UP')).toBeTruthy();
    expect(screen.getByText('MAIN SET')).toBeTruthy();
    expect(screen.getByText('5×8min @ 4:10/km')).toBeTruthy();
    expect(screen.getByText('Log session')).toBeTruthy();
    expect(screen.getByText('Mark skipped')).toBeTruthy();
  });

  it('renders selectable possible matches and attaches the selected run', async () => {
    const onAttachMatch = vi.fn();
    const session = intervalSession();
    const matches = [
      stravaRun({ id: 'strava-1', distance: 9.8, duration: 2772, startTime: '2026-04-23T18:42:00.000Z' }),
      stravaRun({ id: 'strava-2', distance: 10.4, duration: 2943, startTime: '2026-04-23T07:18:00.000Z' }),
    ];

    render(
      <ResolveSessionSheet
        open
        session={session}
        possibleMatches={matches}
        onDismiss={vi.fn()}
        onLogSession={vi.fn()}
        onMarkSkipped={vi.fn()}
        onAttachMatch={onAttachMatch}
      />,
    );

    expect(await screen.findByText('Possible matches')).toBeTruthy();
    expect(screen.getAllByText('Strava run')).toHaveLength(2);
    expect(screen.getByText('9.8km · 46:12')).toBeTruthy();
    expect(screen.getByText('10.4km · 49:03')).toBeTruthy();
    expect(screen.queryByText('Use')).toBeNull();
    expect(screen.queryByText('Log manually')).toBeNull();

    fireEvent.click(screen.getByTestId('activity-match-card-strava-2'));
    fireEvent.click(screen.getByTestId('resolve-session-primary'));

    await waitFor(() => {
      expect(onAttachMatch).toHaveBeenCalledWith(session, 'strava-2');
    });
  });
});
