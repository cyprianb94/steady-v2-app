import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Activity, PlannedSession } from '@steady/types';
import { MatchPickerModal } from '../components/sync-run/MatchPickerModal';

const activity: Activity = {
  id: 'activity-1',
  userId: 'runner-1',
  source: 'strava',
  externalId: 'strava-1',
  name: 'Morning run',
  startTime: '2026-04-23T07:15:00.000Z',
  distance: 8.2,
  duration: 2650,
  avgPace: 323,
  splits: [],
};

function session(overrides: Partial<PlannedSession>): PlannedSession {
  return {
    id: 'session-1',
    type: 'EASY',
    date: '2026-04-23',
    distance: 8,
    pace: '5:45',
    ...overrides,
  } as PlannedSession;
}

describe('MatchPickerModal', () => {
  it('renders effort-only targets without target pace placeholders', () => {
    render(
      <MatchPickerModal
        visible
        activity={activity}
        sessionOptions={[
          session({
            intensityTarget: {
              source: 'manual',
              mode: 'effort',
              profileKey: 'easy',
              effortCue: 'conversational',
            },
          }),
        ]}
        selectedSessionId="session-1"
        recommendedSessionId="session-1"
        todaySessionId="session-1"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Thu Apr 23 · target conversational')).toBeTruthy();
    expect(screen.queryByText(/target —/)).toBeNull();
    expect(screen.queryByText(/—\/km/)).toBeNull();
  });

  it('shows an explicit unmatch action when the run already has a current match', () => {
    const onSelect = vi.fn();

    render(
      <MatchPickerModal
        visible
        activity={{
          ...activity,
          matchedSessionId: 'session-1',
        }}
        sessionOptions={[
          session({ id: 'session-1' }),
          session({ id: 'session-2', date: '2026-04-24', distance: 10, type: 'TEMPO', pace: '4:20' }),
        ]}
        selectedSessionId="session-1"
        recommendedSessionId="session-1"
        todaySessionId={null}
        onSelect={onSelect}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("Change this run's match")).toBeTruthy();
    expect(screen.getByText('Current match')).toBeTruthy();
    expect(screen.getAllByText('Thu · 8km Easy Run').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CURRENT').length).toBeGreaterThan(0);
    expect(screen.getByText('Change to another session')).toBeTruthy();
    expect(screen.queryByText('Keep unmatched')).toBeNull();

    fireEvent.click(screen.getByText('Unmatch this run'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('makes a pending unmatch state explicit before save', () => {
    render(
      <MatchPickerModal
        visible
        activity={{
          ...activity,
          matchedSessionId: 'session-1',
        }}
        sessionOptions={[session({ id: 'session-1' })]}
        selectedSessionId={null}
        recommendedSessionId="session-1"
        todaySessionId={null}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Will become bonus mileage after you save.')).toBeTruthy();
    expect(screen.getByText('PENDING')).toBeTruthy();
  });
});
