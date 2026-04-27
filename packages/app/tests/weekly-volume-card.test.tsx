import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeeklyVolumeSummary } from '@steady/types';

const mockPreferences = vi.hoisted(() => ({
  units: 'metric' as 'metric' | 'imperial',
  weeklyVolumeMetric: 'distance' as 'distance' | 'time',
}));
const mockReducedMotion = vi.hoisted(() => ({
  value: false,
}));

vi.mock('../providers/preferences-context', () => ({
  usePreferences: () => mockPreferences,
}));

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion.value,
}));

import { WeeklyVolumeCard } from '../components/home/WeeklyLoadCard';

function makeSummary(): WeeklyVolumeSummary {
  return {
    plannedDistanceKm: 64,
    actualDistanceKm: 12.4,
    plannedSeconds: 20_100,
    actualSeconds: 4_820,
    days: [
      {
        dayIndex: 0,
        date: '2026-04-06',
        sessionId: 'mon',
        plannedDistanceKm: 8,
        actualDistanceKm: 8,
        plannedSeconds: 2_560,
        actualSeconds: 2_580,
        plannedType: 'EASY',
        actualType: 'EASY',
        status: 'over',
      },
      {
        dayIndex: 1,
        date: '2026-04-07',
        sessionId: 'tue',
        plannedDistanceKm: 6.4,
        actualDistanceKm: 7.1,
        plannedSeconds: 2_520,
        actualSeconds: 2_880,
        plannedType: 'INTERVAL',
        actualType: 'INTERVAL',
        status: 'over',
      },
      {
        dayIndex: 2,
        date: '2026-04-08',
        plannedDistanceKm: 0,
        actualDistanceKm: 0,
        plannedSeconds: 0,
        actualSeconds: 0,
        plannedType: 'REST',
        status: 'rest',
      },
      {
        dayIndex: 3,
        date: '2026-04-09',
        sessionId: 'thu',
        plannedDistanceKm: 10,
        actualDistanceKm: 0,
        plannedSeconds: 2_600,
        actualSeconds: 0,
        plannedType: 'TEMPO',
        status: 'upcoming',
      },
      {
        dayIndex: 4,
        date: '2026-04-10',
        plannedDistanceKm: 0,
        actualDistanceKm: 0,
        plannedSeconds: 0,
        actualSeconds: 0,
        plannedType: 'REST',
        status: 'rest',
      },
      {
        dayIndex: 5,
        date: '2026-04-11',
        sessionId: 'sat',
        plannedDistanceKm: 15,
        actualDistanceKm: 0,
        plannedSeconds: 4_950,
        actualSeconds: 0,
        plannedType: 'EASY',
        status: 'upcoming',
      },
      {
        dayIndex: 6,
        date: '2026-04-12',
        sessionId: 'sun',
        plannedDistanceKm: 24.6,
        actualDistanceKm: 0,
        plannedSeconds: 7_470,
        actualSeconds: 0,
        plannedType: 'LONG',
        status: 'upcoming',
      },
    ],
  };
}

describe('WeeklyVolumeCard', () => {
  beforeEach(() => {
    mockPreferences.units = 'metric';
    mockPreferences.weeklyVolumeMetric = 'distance';
    mockReducedMotion.value = false;
  });

  it('renders only the preferred collapsed metric', () => {
    render(<WeeklyVolumeCard summary={makeSummary()} />);

    const card = screen.getByTestId('weekly-volume-card');
    expect(within(card).getByText('WEEKLY VOLUME')).toBeTruthy();
    expect(within(card).getByText('12.4km')).toBeTruthy();
    expect(within(card).getByText('/ 64km')).toBeTruthy();
    expect(within(card).queryByText('1h20')).toBeNull();
  });

  it('temporarily flips metric while held and restores on release', async () => {
    render(<WeeklyVolumeCard summary={makeSummary()} />);

    fireEvent.mouseDown(screen.getByTestId('weekly-volume-collapsed'));

    expect(screen.getByText('time view')).toBeTruthy();
    expect(screen.getByText('1h20')).toBeTruthy();

    fireEvent.mouseUp(screen.getByTestId('weekly-volume-collapsed'));

    await waitFor(() => {
      expect(screen.queryByText('time view')).toBeNull();
    });
    expect(screen.getByText('12.4km')).toBeTruthy();
  });

  it('expands to bucket chart and renders selected distance overrun tooltip', () => {
    render(<WeeklyVolumeCard summary={makeSummary()} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    expect(screen.getByTestId('weekly-volume-chart')).toBeTruthy();

    fireEvent.click(screen.getByTestId('weekly-volume-bucket-1'));

    expect(screen.getByTestId('weekly-volume-tooltip')).toBeTruthy();
    expect(screen.getByText('Tue intervals')).toBeTruthy();
    expect(screen.getByText('planned 6.4km')).toBeTruthy();
    expect(screen.getByText('done 7.1km')).toBeTruthy();
    expect(screen.getByText('+0.7km over')).toBeTruthy();
    expect(screen.getByTestId('weekly-volume-overrun-1')).toBeTruthy();
  });

  it('switches expanded chart to time without persisting settings', () => {
    render(<WeeklyVolumeCard summary={makeSummary()} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    fireEvent.click(screen.getByTestId('weekly-volume-metric-time'));
    fireEvent.click(screen.getByTestId('weekly-volume-bucket-1'));

    expect(screen.getByText('planned 42m')).toBeTruthy();
    expect(screen.getByText('done 48m')).toBeTruthy();
    expect(screen.getByText('+6m over')).toBeTruthy();
  });

  it('hides rounded zero-minute overrun copy in time mode', () => {
    render(<WeeklyVolumeCard summary={makeSummary()} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    fireEvent.click(screen.getByTestId('weekly-volume-metric-time'));
    fireEvent.click(screen.getByTestId('weekly-volume-bucket-0'));

    expect(screen.getByText('planned 43m')).toBeTruthy();
    expect(screen.getByText('done 43m')).toBeTruthy();
    expect(screen.queryByText('+0m over')).toBeNull();
  });

  it('collapses from the expanded header', () => {
    render(<WeeklyVolumeCard summary={makeSummary()} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    expect(screen.getByTestId('weekly-volume-chart')).toBeTruthy();

    fireEvent.click(screen.getByTestId('weekly-volume-expanded-header'));

    expect(screen.queryByTestId('weekly-volume-chart')).toBeNull();
  });

  it('still expands and selects a bucket when reduced motion is enabled', () => {
    mockReducedMotion.value = true;
    render(<WeeklyVolumeCard summary={makeSummary()} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    fireEvent.click(screen.getByTestId('weekly-volume-bucket-1'));

    expect(screen.getByTestId('weekly-volume-chart')).toBeTruthy();
    expect(screen.getByTestId('weekly-volume-tooltip')).toBeTruthy();
  });
});
