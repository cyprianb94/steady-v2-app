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
  it('renders overview content from the shared model and exposes controlled tabs', () => {
    const onTabChange = vi.fn();
    render(
      <BlockReviewSurface
        model={reviewModel()}
        activeTab="overview"
        onTabChange={onTabChange}
        overload={{
          progressionPct: null,
          onSelectProgression: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText('Weekly volume')).toBeTruthy();
    expect(screen.getByText('92km peak')).toBeTruthy();
    expect(screen.getByText('Settle into rhythm')).toBeTruthy();
    expect(screen.getByText('Peak week')).toBeTruthy();
    expect(screen.getByText('Race week')).toBeTruthy();

    fireEvent.click(screen.getByTestId('block-review-tab-phases'));
    expect(onTabChange).toHaveBeenCalledWith('phases');
  });

  it('renders phase and week review views without owning navigation', () => {
    const onWeekPress = vi.fn();
    const model = reviewModel();
    const { rerender } = render(
      <BlockReviewSurface
        model={model}
        activeTab="phases"
        onTabChange={vi.fn()}
        onWeekPress={onWeekPress}
      />,
    );

    expect(screen.getByTestId('block-review-phases')).toBeTruthy();
    expect(screen.getByText('Block structure')).toBeTruthy();
    expect(screen.getByText('2w base · 1w build · 1w peak · 1w taper')).toBeTruthy();
    expect(screen.getByText('W1-W2')).toBeTruthy();

    rerender(
      <BlockReviewSurface
        model={model}
        activeTab="weeks"
        onTabChange={vi.fn()}
        onWeekPress={onWeekPress}
      />,
    );

    expect(screen.getByTestId('block-review-weeks')).toBeTruthy();
    fireEvent.click(screen.getByTestId('block-review-week-1'));
    expect(onWeekPress).toHaveBeenCalledWith(model.weeks[0]);
  });

  it('keeps overload selection controlled by the caller', () => {
    function Harness() {
      const [progressionPct, setProgressionPct] = useState<number | null>(null);
      const [isCustomising, setIsCustomising] = useState(false);
      const [customPct, setCustomPct] = useState('7');

      return (
        <BlockReviewOverloadCard
          control={{
            progressionPct,
            isCustomising,
            customPct,
            onSelectProgression: (pct) => {
              setProgressionPct(pct);
              setIsCustomising(false);
            },
            onStartCustom: () => setIsCustomising(true),
            onCustomPctChange: setCustomPct,
            onChangeProgression: () => setProgressionPct(null),
          }}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByTestId('block-review-overload-card')).toBeTruthy();
    fireEvent.click(screen.getByTestId('block-review-overload-custom'));
    fireEvent.click(screen.getByTestId('block-review-overload-12'));
    expect(screen.getByText('Apply 12%')).toBeTruthy();

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
