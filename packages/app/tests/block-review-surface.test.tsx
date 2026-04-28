import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  buildBlockReviewModel,
  type PhaseName,
  type PlannedSession,
  type PlanWeek,
  type SessionType,
} from '@steady/types';
import {
  BlockReviewOverloadCard,
  BlockReviewSurface,
  buildReviewVolumeChartModel,
  getBlockReviewTabMotionDuration,
} from '../components/block-review';

function session(type: SessionType, dayIndex: number): PlannedSession {
  if (type === 'REST') {
    return { id: `s-${dayIndex}`, date: `2026-05-${String(dayIndex + 1).padStart(2, '0')}`, type };
  }

  if (type === 'INTERVAL') {
    return {
      id: `s-${dayIndex}`,
      date: `2026-05-${String(dayIndex + 1).padStart(2, '0')}`,
      type,
      reps: 6,
      repDist: 800,
      pace: '3:50',
    };
  }

  return {
    id: `s-${dayIndex}`,
    date: `2026-05-${String(dayIndex + 1).padStart(2, '0')}`,
    type,
    distance: type === 'LONG' ? 20 : 8,
    pace: '5:20',
  };
}

function week(weekNumber: number, phase: PhaseName, plannedKm: number): PlanWeek {
  const pattern: (SessionType | null)[] = ['EASY', 'INTERVAL', 'EASY', 'TEMPO', null, 'EASY', 'LONG'];
  return {
    weekNumber,
    phase,
    plannedKm,
    sessions: pattern.map((type, dayIndex) => (type ? session(type, dayIndex) : null)),
  };
}

function reviewModel() {
  return buildBlockReviewModel({
    weeks: [
      week(1, 'BASE', 70),
      week(2, 'BASE', 74),
      week(3, 'BUILD', 80),
      week(4, 'PEAK', 92),
      week(5, 'TAPER', 42),
    ],
    phases: { BASE: 2, BUILD: 1, RECOVERY: 0, PEAK: 1, TAPER: 1 },
    progressionPct: 7,
    currentWeekIndex: 2,
  });
}

describe('BlockReviewSurface', () => {
  it('renders structure content from the shared model and exposes controlled tabs', () => {
    const onTabChange = vi.fn();
    render(
      <BlockReviewSurface
        model={reviewModel()}
        activeTab="structure"
        onTabChange={onTabChange}
        overload={{
          progressionPct: null,
          onSelectProgression: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText('Weekly volume')).toBeTruthy();
    expect(screen.getByText('Progression')).toBeTruthy();
    expect(screen.getByText('Phase structure')).toBeTruthy();
    expect(screen.getByText('2w base · 1w build · 0w recovery · 1w peak · 1w taper')).toBeTruthy();
    expect(screen.getByText('W1')).toBeTruthy();
    expect(screen.getByText('W3')).toBeTruthy();
    expect(screen.getByText('W4')).toBeTruthy();
    expect(screen.getByText('W5')).toBeTruthy();
    expect(screen.getAllByText('Race')).toHaveLength(1);
    expect(screen.getByText('BASE')).toBeTruthy();
    expect(screen.getByText('PEAK')).toBeTruthy();
    expect(screen.queryByText('92km peak')).toBeNull();
    expect(screen.queryByText('Overview')).toBeNull();
    expect(screen.queryByText('Phases')).toBeNull();

    fireEvent.click(screen.getByTestId('block-review-tab-weeks'));
    expect(onTabChange).toHaveBeenCalledWith('weeks');
  });

  it('builds a smooth phase-aware chart and scrubs week volume with date context', () => {
    const model = buildBlockReviewModel({
      weeks: [
        week(1, 'BASE', 70),
        week(2, 'BASE', 74),
        week(3, 'BUILD', 80),
        week(4, 'PEAK', 92),
        week(5, 'TAPER', 62),
        week(6, 'TAPER', 42),
      ],
      phases: { BASE: 2, BUILD: 1, RECOVERY: 0, PEAK: 1, TAPER: 2 },
      progressionPct: 7,
    });
    const chartModel = buildReviewVolumeChartModel(model, 300);

    expect(chartModel.phaseMarkers.map((marker) => marker.weekNumber)).toEqual([1, 3, 4, 5]);
    expect(chartModel.pathD.startsWith('M ')).toBe(true);
    expect(chartModel.pathD).toContain(' C ');
    expect(chartModel.gradientStops.map((stop) => stop.color)).toEqual(
      expect.arrayContaining(['#1B3A6B', '#C4522A', '#D4882A', '#2A5C45']),
    );

    const onScrubActiveChange = vi.fn();
    render(
      <BlockReviewSurface
        model={model}
        activeTab="structure"
        onTabChange={vi.fn()}
        raceDate="2026-06-01"
        onScrubActiveChange={onScrubActiveChange}
      />,
    );

    const chart = screen.getByTestId('block-review-volume-scrub-surface');
    expect(screen.getByTestId('block-review-volume-line')).toBeTruthy();
    expect(screen.getByTestId('block-review-volume-y-axis')).toBeTruthy();
    expect(screen.getAllByTestId('block-review-volume-grid-line').length).toBeGreaterThan(2);
    expect(screen.getAllByTestId('block-review-volume-y-tick').map((tick) => tick.textContent)).toEqual(
      expect.arrayContaining(['150', '100', '50', '0']),
    );
    fireEvent.mouseDown(chart, { clientX: 0, clientY: 72 });

    expect(onScrubActiveChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('block-review-volume-tooltip')).toBeTruthy();
    expect(screen.getAllByText('W1').length).toBeGreaterThan(0);
    expect(screen.getByText('Base')).toBeTruthy();
    expect(screen.getByText('70km total')).toBeTruthy();
    expect(screen.getByText('May 1 - 8')).toBeTruthy();

    fireEvent.mouseMove(chart, { clientX: 300, clientY: 72 });
    expect(screen.getAllByText('W5').length).toBeGreaterThan(0);
    expect(screen.getByText('Taper')).toBeTruthy();
    expect(screen.getByText('42km total')).toBeTruthy();

    fireEvent.mouseUp(chart, { clientX: 300, clientY: 72 });
    expect(onScrubActiveChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByTestId('block-review-volume-tooltip')).toBeNull();
  });

  it('renders phase summary edits and week review views without owning navigation', () => {
    const onWeekPress = vi.fn();
    const onDayPress = vi.fn();
    const onEditStructure = vi.fn();
    const model = reviewModel();
    const { rerender } = render(
      <BlockReviewSurface
        model={model}
        activeTab="structure"
        onTabChange={vi.fn()}
        onWeekPress={onWeekPress}
        onEditStructure={onEditStructure}
      />,
    );

    expect(screen.getByTestId('block-review-structure')).toBeTruthy();
    expect(screen.getByTestId('block-review-phase-summary')).toBeTruthy();
    fireEvent.click(screen.getByTestId('block-review-edit-structure'));
    expect(onEditStructure).toHaveBeenCalledTimes(1);

    rerender(
      <BlockReviewSurface
        model={model}
        activeTab="weeks"
        onTabChange={vi.fn()}
        expandedWeekIndex={0}
        onWeekPress={onWeekPress}
        onDayPress={onDayPress}
      />,
    );

    expect(screen.getByTestId('block-review-weeks')).toBeTruthy();
    expect(screen.getByTestId('block-week-expanded-1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('block-week-row-press-1'));
    expect(onWeekPress).toHaveBeenCalledWith(model.weeks[0]);
    fireEvent.click(screen.getByTestId('block-week-day-1-1'));
    expect(onDayPress).toHaveBeenCalledWith(model.weeks[0], 1);
  });

  it('keeps overload selection controlled by the caller', () => {
    function Harness() {
      const [progressionPct, setProgressionPct] = useState<number | null>(null);
      const [progressionEveryWeeks, setProgressionEveryWeeks] = useState(2);
      const [isCustomising, setIsCustomising] = useState(false);
      const [customPct, setCustomPct] = useState('7');
      const [customEveryWeeks, setCustomEveryWeeks] = useState('2');

      return (
        <BlockReviewOverloadCard
          control={{
            progressionPct,
            progressionEveryWeeks,
            isCustomising,
            customPct,
            customEveryWeeks,
            onSelectProgression: (pct, everyWeeks = 2) => {
              setProgressionPct(pct);
              setProgressionEveryWeeks(everyWeeks);
              setIsCustomising(false);
            },
            onStartCustom: () => setIsCustomising(true),
            onCustomPctChange: setCustomPct,
            onCustomEveryWeeksChange: setCustomEveryWeeks,
            onChangeProgression: () => setProgressionPct(null),
          }}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByTestId('block-review-overload-card')).toBeTruthy();
    fireEvent.click(screen.getByTestId('block-review-overload-custom'));
    fireEvent.click(screen.getByTestId('block-review-overload-12'));
    expect(screen.getByText('Apply +12% / 2w')).toBeTruthy();

    fireEvent.click(screen.getByTestId('block-review-overload-apply-custom'));
    expect(screen.getByText('+12% progression every 2 weeks.')).toBeTruthy();

    fireEvent.click(screen.getByTestId('block-review-overload-change'));
    expect(screen.getByTestId('block-review-overload-card')).toBeTruthy();
  });

  it('uses no-duration tab motion when reduced motion is enabled', () => {
    expect(getBlockReviewTabMotionDuration(false)).toBe(220);
    expect(getBlockReviewTabMotionDuration(true)).toBe(0);
  });
});
