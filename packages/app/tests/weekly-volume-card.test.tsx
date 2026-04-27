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
    expect(screen.getByTestId('weekly-volume-chevron')).toBeTruthy();
    expect(card.getAttribute('style')).toContain('height: 92px');
    expect(card.getAttribute('style')).not.toContain('min-height');
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

  it('sets context before the week has started moving', () => {
    const summary = makeSummary();
    summary.actualDistanceKm = 0;
    summary.actualSeconds = 0;
    summary.days = summary.days.map((day) => ({
      ...day,
      actualDistanceKm: 0,
      actualSeconds: 0,
      actualType: undefined,
      status: day.plannedType === 'REST' ? 'rest' : day.dayIndex === 0 ? 'planned' : 'upcoming',
    }));

    render(<WeeklyVolumeCard summary={summary} />);

    expect(screen.getByText('Start of the week. Nothing logged yet.')).toBeTruthy();
    expect(screen.queryByText('Long run still ahead')).toBeNull();
  });

  it('calls out missed easy runs before aggregate volume', () => {
    const summary = makeSummary();
    summary.days[0] = {
      ...summary.days[0],
      actualDistanceKm: 0,
      actualSeconds: 0,
      actualType: undefined,
      status: 'missed',
    };
    summary.actualDistanceKm = 7.1;
    summary.actualSeconds = 2_880;

    render(<WeeklyVolumeCard summary={summary} />);

    expect(screen.getByText('Easy run missed so far')).toBeTruthy();
  });

  it('uses literal missed-run copy for quality and long runs', () => {
    const summary = makeSummary();
    summary.days[1] = {
      ...summary.days[1],
      actualDistanceKm: 0,
      actualSeconds: 0,
      actualType: undefined,
      status: 'missed',
    };
    summary.actualDistanceKm = 8;
    summary.actualSeconds = 2_580;

    render(<WeeklyVolumeCard summary={summary} />);

    expect(screen.getByText('Tue run not logged yet')).toBeTruthy();
  });

  it('compares actual against planned mileage that has come due', () => {
    const summary = makeSummary();
    summary.days[0] = {
      ...summary.days[0],
      actualDistanceKm: 5,
      actualSeconds: 1_600,
      status: 'completed',
    };
    summary.days[1] = {
      ...summary.days[1],
      actualDistanceKm: 0,
      actualSeconds: 0,
      actualType: undefined,
      status: 'upcoming',
    };
    summary.actualDistanceKm = 5;
    summary.actualSeconds = 1_600;

    render(<WeeklyVolumeCard summary={summary} />);

    expect(screen.getByText('A little behind planned mileage')).toBeTruthy();
  });

  it('uses training copy when the weekly volume metric is time', () => {
    mockPreferences.weeklyVolumeMetric = 'time';

    render(<WeeklyVolumeCard summary={makeSummary()} />);

    expect(screen.getByText('A little over planned training')).toBeTruthy();
  });

  it('calls out when the weekly mileage has already been covered', () => {
    const summary = makeSummary();
    summary.actualDistanceKm = 70;
    summary.actualSeconds = summary.plannedSeconds;

    render(<WeeklyVolumeCard summary={summary} />);

    expect(screen.getByText('Weekly mileage already covered')).toBeTruthy();
  });

  it('distinguishes a large weekly overrun', () => {
    const summary = makeSummary();
    summary.actualDistanceKm = 80;
    summary.actualSeconds = summary.plannedSeconds;

    render(<WeeklyVolumeCard summary={summary} />);

    expect(screen.getByText('Well over planned mileage')).toBeTruthy();
  });

  it('expands to bucket chart and renders selected distance overrun tooltip', () => {
    render(<WeeklyVolumeCard summary={makeSummary()} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    expect(screen.getByTestId('weekly-volume-chart')).toBeTruthy();
    expect(screen.queryByTestId('weekly-volume-metric-time')).toBeNull();
    expect(within(screen.getByTestId('weekly-volume-status-copy')).getByText('On track so far')).toBeTruthy();
    expect(screen.getByTestId('weekly-volume-transition-track')).toBeTruthy();
    expect(within(screen.getByTestId('weekly-volume-y-axis')).getByText('30km')).toBeTruthy();
    expect(within(screen.getByTestId('weekly-volume-y-axis')).getByText('0km')).toBeTruthy();

    fireEvent.click(screen.getByTestId('weekly-volume-bucket-1'));

    expect(screen.getByTestId('weekly-volume-tooltip')).toBeTruthy();
    expect(screen.getByText('Tue intervals')).toBeTruthy();
    expect(screen.getByText('planned 6.4km')).toBeTruthy();
    expect(screen.getByText('done 7.1km')).toBeTruthy();
    expect(screen.getByText('+0.7km over')).toBeTruthy();
    expect(screen.getByTestId('weekly-volume-overrun-1')).toBeTruthy();
  });

  it('uses a closer distance axis ceiling for lower-volume weeks', () => {
    const summary = makeSummary();
    summary.days = summary.days.map((day) => (
      day.dayIndex === 6
        ? { ...day, plannedDistanceKm: 16 }
        : day
    ));
    summary.plannedDistanceKm = summary.days.reduce((sum, day) => sum + day.plannedDistanceKm, 0);

    render(<WeeklyVolumeCard summary={summary} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));

    expect(within(screen.getByTestId('weekly-volume-y-axis')).getByText('20km')).toBeTruthy();
    expect(within(screen.getByTestId('weekly-volume-y-axis')).queryByText('30km')).toBeNull();
    expect(screen.getByTestId('weekly-volume-bucket-shell-6').getAttribute('style')).toContain('height: 120px');
  });

  it('uses minute labels on the time axis while every run is 60 minutes or shorter', () => {
    const summary = makeSummary();
    summary.plannedSeconds = 13_440;
    summary.actualSeconds = 5_460;
    summary.days = summary.days.map((day) => ({
      ...day,
      plannedSeconds: day.plannedType === 'REST' ? 0 : 2_400,
      actualSeconds: day.actualSeconds > 0 ? Math.min(day.actualSeconds, 2_400) : 0,
    }));
    mockPreferences.weeklyVolumeMetric = 'time';

    render(<WeeklyVolumeCard summary={summary} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));

    expect(within(screen.getByTestId('weekly-volume-y-axis')).getByText('50min')).toBeTruthy();
    expect(within(screen.getByTestId('weekly-volume-y-axis')).getByText('0min')).toBeTruthy();
    expect(within(screen.getByTestId('weekly-volume-y-axis')).queryByText('50m')).toBeNull();
    expect(within(screen.getByTestId('weekly-volume-y-axis')).queryByText('1h')).toBeNull();
  });

  it('switches the time axis to hours when a run is longer than 60 minutes', () => {
    mockPreferences.weeklyVolumeMetric = 'time';

    render(<WeeklyVolumeCard summary={makeSummary()} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));

    expect(within(screen.getByTestId('weekly-volume-y-axis')).getByText('3h')).toBeTruthy();
    expect(within(screen.getByTestId('weekly-volume-y-axis')).getByText('0h')).toBeTruthy();
    expect(within(screen.getByTestId('weekly-volume-y-axis')).queryByText('180min')).toBeNull();
  });

  it('scrubs the plot tooltip across days without flipping metric and clears it on release', () => {
    render(<WeeklyVolumeCard summary={makeSummary()} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));

    fireEvent.mouseDown(screen.getByTestId('weekly-volume-plot-scrub-surface'), { clientX: 8 });

    expect(screen.getByTestId('weekly-volume-tooltip')).toBeTruthy();
    expect(screen.getByText('Mon easy')).toBeTruthy();
    expect(screen.getByText('planned 8km')).toBeTruthy();
    expect(screen.queryByText('time view')).toBeNull();

    fireEvent.mouseMove(screen.getByTestId('weekly-volume-plot-scrub-surface'), { clientX: 268 });
    expect(screen.getByText('Sun long run')).toBeTruthy();
    expect(screen.getByText('planned 24.6km')).toBeTruthy();

    fireEvent.mouseUp(screen.getByTestId('weekly-volume-plot-scrub-surface'), { clientX: 268 });

    expect(screen.queryByTestId('weekly-volume-tooltip')).toBeNull();
    expect(screen.queryByText('time view')).toBeNull();
  });

  it('reports active plot scrubbing until release so the parent scroll can lock', () => {
    const onScrubActiveChange = vi.fn();
    render(<WeeklyVolumeCard summary={makeSummary()} onScrubActiveChange={onScrubActiveChange} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    fireEvent.mouseDown(screen.getByTestId('weekly-volume-plot-scrub-surface'), { clientX: 8 });
    fireEvent.mouseMove(screen.getByTestId('weekly-volume-plot-scrub-surface'), { clientX: 268, clientY: 12 });
    fireEvent.mouseUp(screen.getByTestId('weekly-volume-plot-scrub-surface'), { clientX: 268, clientY: 12 });

    expect(onScrubActiveChange).toHaveBeenNthCalledWith(1, true);
    expect(onScrubActiveChange).toHaveBeenNthCalledWith(2, false);
    expect(onScrubActiveChange).toHaveBeenCalledTimes(2);
  });

  it('releases the plot scrub lock if the chart unmounts mid-gesture', () => {
    const onScrubActiveChange = vi.fn();
    const { unmount } = render(
      <WeeklyVolumeCard summary={makeSummary()} onScrubActiveChange={onScrubActiveChange} />,
    );

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    fireEvent.mouseDown(screen.getByTestId('weekly-volume-plot-scrub-surface'), { clientX: 8 });
    unmount();

    expect(onScrubActiveChange).toHaveBeenNthCalledWith(1, true);
    expect(onScrubActiveChange).toHaveBeenNthCalledWith(2, false);
  });

  it('temporarily flips expanded chart metric while the axis or lower plot area is held', async () => {
    render(<WeeklyVolumeCard summary={makeSummary()} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    fireEvent.click(screen.getByTestId('weekly-volume-bucket-1'));

    expect(screen.getByText('planned 6.4km')).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId('weekly-volume-y-axis'));

    expect(screen.getByText('planned 42min')).toBeTruthy();
    expect(screen.getByText('done 48min')).toBeTruthy();
    expect(screen.getByText('+6min over')).toBeTruthy();
    expect(screen.getByText('time view')).toBeTruthy();

    fireEvent.mouseUp(screen.getByTestId('weekly-volume-y-axis'));

    await waitFor(() => {
      expect(screen.queryByText('time view')).toBeNull();
    });
    expect(screen.getByText('planned 6.4km')).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId('weekly-volume-lower-hold-surface'), {
      clientX: 60,
      clientY: 160,
    });

    expect(screen.getByText('planned 42min')).toBeTruthy();
    expect(screen.getByText('done 48min')).toBeTruthy();
    expect(screen.getByText('+6min over')).toBeTruthy();
    expect(screen.getByText('time view')).toBeTruthy();

    fireEvent.mouseUp(screen.getByTestId('weekly-volume-lower-hold-surface'), {
      clientX: 60,
      clientY: 160,
    });

    await waitFor(() => {
      expect(screen.queryByText('time view')).toBeNull();
    });
    expect(screen.getByText('planned 6.4km')).toBeTruthy();
  });

  it('keeps the selected tooltip when the bucket is tapped again', () => {
    render(<WeeklyVolumeCard summary={makeSummary()} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    fireEvent.click(screen.getByTestId('weekly-volume-bucket-1'));

    expect(screen.getByTestId('weekly-volume-tooltip')).toBeTruthy();

    fireEvent.click(screen.getByTestId('weekly-volume-bucket-1'));

    expect(screen.getByTestId('weekly-volume-tooltip')).toBeTruthy();
    expect(screen.getByText('Tue intervals')).toBeTruthy();
  });

  it('hides rounded zero-minute overrun copy in time mode', () => {
    mockPreferences.weeklyVolumeMetric = 'time';
    render(<WeeklyVolumeCard summary={makeSummary()} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    fireEvent.click(screen.getByTestId('weekly-volume-bucket-0'));

    expect(screen.getByText('planned 43min')).toBeTruthy();
    expect(screen.getByText('done 43min')).toBeTruthy();
    expect(screen.queryByText('+0min over')).toBeNull();
  });

  it('collapses from the expanded header', () => {
    render(<WeeklyVolumeCard summary={makeSummary()} />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    expect(screen.getByTestId('weekly-volume-chart')).toBeTruthy();

    fireEvent.click(screen.getByTestId('weekly-volume-expanded-header'));

    expect(screen.queryByTestId('weekly-volume-chart')).toBeNull();
  });

  it('collapses immediately when the screen loses focus', () => {
    const { rerender } = render(<WeeklyVolumeCard summary={makeSummary()} focused />);

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    fireEvent.click(screen.getByTestId('weekly-volume-bucket-1'));
    expect(screen.getByTestId('weekly-volume-chart')).toBeTruthy();
    expect(screen.getByTestId('weekly-volume-tooltip')).toBeTruthy();

    rerender(<WeeklyVolumeCard summary={makeSummary()} focused={false} />);

    expect(screen.queryByTestId('weekly-volume-chart')).toBeNull();
    expect(screen.queryByTestId('weekly-volume-tooltip')).toBeNull();
    expect(screen.getByTestId('weekly-volume-chevron')).toBeTruthy();
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
