import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../lib/trpc', () => ({ trpc: {} }));

import { SessionDetailSheet } from '../components/home/SessionDetailSheet';

describe('SessionDetailSheet', () => {
  const session = {
    id: 's1',
    type: 'EASY' as const,
    date: '2026-04-09',
    distance: 8,
    pace: '5:20',
    actualActivityId: 'act-1',
  };

  const activity = {
    id: 'act-1',
    distance: 8.2,
    avgPace: 318,
    duration: 2620,
    avgHR: 145,
    elevationGain: 85,
    splits: [
      { km: 1, pace: 325, hr: 140, label: '2.0 km', distance: 2 },
      { km: 2, pace: 320, hr: 143 },
      { km: 3, pace: 315, hr: 146 },
    ],
  };

  it('shows planned vs actual distance comparison', () => {
    render(
      <SessionDetailSheet
        visible={true}
        session={session}
        activity={activity}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Planned/)).toBeTruthy();
    expect(screen.getByText(/8km/)).toBeTruthy();
    expect(screen.getByText(/8\.2km/)).toBeTruthy();
  });

  it('shows HR and elevation when available', () => {
    render(
      <SessionDetailSheet
        visible={true}
        session={session}
        activity={activity}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/145/)).toBeTruthy(); // avg HR
    expect(screen.getByText(/85/)).toBeTruthy();  // elevation
  });

  it('uses a lap label when one is available', () => {
    render(
      <SessionDetailSheet
        visible={true}
        session={session}
        activity={activity}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('2.0 km')).toBeTruthy();
  });

  it('handles missing HR gracefully', () => {
    const noHR = { ...activity, avgHR: undefined, elevationGain: undefined, splits: [] };
    render(
      <SessionDetailSheet
        visible={true}
        session={session}
        activity={noHR}
        onClose={vi.fn()}
      />,
    );

    // Should still render without crashing
    expect(screen.getByText(/Planned/)).toBeTruthy();
    expect(screen.queryByText(/bpm/)).toBeNull();
  });

  it('renders nothing when not visible', () => {
    const { container } = render(
      <SessionDetailSheet
        visible={false}
        session={session}
        activity={activity}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Planned/)).toBeNull();
  });
});
