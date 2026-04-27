import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalSearchParams } from 'expo-router';

import StepPlan from '../app/onboarding/plan-builder/step-plan';

vi.mock('../lib/plan-api', () => ({
  savePlan: vi.fn(),
}));

const baseParams = {
  raceDistance: '10K',
  raceLabel: '10K',
  raceName: 'Club 10K',
  raceDate: '2026-09-20',
  weeks: '3',
  targetTime: '00:45:00',
  phases: JSON.stringify({ BASE: 1, BUILD: 1, RECOVERY: 0, PEAK: 0, TAPER: 1 }),
  template: JSON.stringify([
    { type: 'EASY', distance: 8, pace: '5:20' },
    {
      type: 'INTERVAL',
      reps: 6,
      repDist: 800,
      pace: '3:50',
      recovery: '90s',
      warmup: { unit: 'km', value: 1.5 },
      cooldown: { unit: 'km', value: 1 },
    },
    null,
    null,
    null,
    null,
    { type: 'LONG', distance: 16, pace: '5:10' },
  ]),
};

describe('StepPlan session editing', () => {
  beforeEach(() => {
    vi.mocked(useLocalSearchParams).mockReturnValue(baseParams);
  });

  it('shows the block volume curve with phase-start markers only', () => {
    render(<StepPlan />);

    expect(screen.getByTestId('block-volume-card')).toBeTruthy();
    expect(screen.getAllByTestId('block-volume-phase-marker')).toHaveLength(3);
    expect(screen.getByTestId('review-tabs')).toBeTruthy();
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Phases')).toBeTruthy();
    expect(screen.getByText('Weeks')).toBeTruthy();
  });

  it('opens the shared full-screen editor and applies an edit to remaining weeks', () => {
    render(<StepPlan />);

    fireEvent.click(screen.getByTestId('review-tab-weeks'));
    fireEvent.click(screen.getByTestId('plan-week-1-header'));
    fireEvent.click(screen.getByTestId('plan-week-1-day-0'));

    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Target pace')).toBeTruthy();

    fireEvent.click(screen.getByText('Rest'));
    fireEvent.click(screen.getByText('Update session'));

    expect(screen.getByText('Apply change where?')).toBeTruthy();
    fireEvent.click(screen.getByText('Apply change'));

    expect(screen.getByTestId('plan-week-1-day-0').textContent).toContain('Rest day');

    fireEvent.click(screen.getByTestId('plan-week-2-header'));
    expect(screen.getByTestId('plan-week-2-day-0').textContent).toContain('Rest day');
  });

  it('opens interval sessions in the notebook-row editor rather than the old inline controls', () => {
    render(<StepPlan />);

    fireEvent.click(screen.getByTestId('review-tab-weeks'));
    fireEvent.click(screen.getByTestId('plan-week-1-header'));
    fireEvent.click(screen.getByTestId('plan-week-1-day-1'));

    expect(screen.getByText('Repetitions')).toBeTruthy();
    expect(screen.getByText('Rep target pace')).toBeTruthy();
    expect(screen.queryByText('Rep distance')).toBeNull();
  });

  it('applies custom progression percentage and cadence', () => {
    render(<StepPlan />);

    fireEvent.click(screen.getByText('Custom'));
    fireEvent.change(screen.getByTestId('progression-pct-input'), {
      target: { value: '6' },
    });
    fireEvent.change(screen.getByTestId('progression-every-weeks-input'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByText('Apply +6% / 3w'));

    expect(screen.getByText('+6% progression every 3 weeks.')).toBeTruthy();
  });
});
