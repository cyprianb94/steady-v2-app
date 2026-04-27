import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalSearchParams } from 'expo-router';

import StepPlan from '../app/onboarding/plan-builder/step-plan';
import { savePlan } from '../lib/plan-api';

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
    vi.mocked(savePlan).mockReset();
    vi.mocked(savePlan).mockResolvedValue({} as Awaited<ReturnType<typeof savePlan>>);
  });

  it('shows the block volume curve with phase-start markers only', () => {
    render(<StepPlan />);

    expect(screen.getByTestId('block-review-volume-chart')).toBeTruthy();
    expect(screen.getByTestId('block-review-phase-strip')).toBeTruthy();
    expect(screen.getByTestId('block-review-tabs')).toBeTruthy();
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Phases')).toBeTruthy();
    expect(screen.getByText('Weeks')).toBeTruthy();
  });

  it('opens the shared full-screen editor and applies an edit to remaining weeks', () => {
    render(<StepPlan />);

    fireEvent.click(screen.getByTestId('block-review-key-week-1'));
    fireEvent.click(screen.getByTestId('plan-week-1-day-0'));

    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Target pace')).toBeTruthy();

    fireEvent.click(screen.getByText('Rest'));
    fireEvent.click(screen.getByText('Update session'));

    expect(screen.getByText('Apply change where?')).toBeTruthy();
    fireEvent.click(screen.getByText('Apply change'));

    expect(screen.getByTestId('plan-week-1-day-0').textContent).toContain('Rest day');

    fireEvent.click(screen.getByTestId('block-review-week-2'));
    expect(screen.getByTestId('plan-week-2-day-0').textContent).toContain('Rest day');
  });

  it('opens interval sessions in the notebook-row editor rather than the old inline controls', () => {
    render(<StepPlan />);

    fireEvent.click(screen.getByTestId('block-review-key-week-1'));
    fireEvent.click(screen.getByTestId('plan-week-1-day-1'));

    expect(screen.getByText('Repetitions')).toBeTruthy();
    expect(screen.getByText('Rep target pace')).toBeTruthy();
    expect(screen.queryByText('Rep distance')).toBeNull();
  });

  it('applies custom overload cadence and saves a dated plan', async () => {
    render(<StepPlan />);

    fireEvent.click(screen.getByTestId('block-review-overload-custom'));
    fireEvent.change(screen.getByTestId('progression-pct-input'), {
      target: { value: '6' },
    });
    fireEvent.change(screen.getByTestId('progression-every-weeks-input'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByText('Apply +6% / 3w'));

    expect(screen.getByText('+6% progression every 3 weeks.')).toBeTruthy();

    fireEvent.click(screen.getByText('Save plan and start training →'));

    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(1));

    const savedPlan = vi.mocked(savePlan).mock.calls[0][0];
    expect(savedPlan).toMatchObject({
      raceName: 'Club 10K',
      raceDate: '2026-09-20',
      progressionPct: 6,
      progressionEveryWeeks: 3,
    });
    expect(savedPlan.weeks[0].sessions[0]?.date).toBe('2026-08-31');
    expect(savedPlan.weeks[2].sessions[6]?.date).toBe('2026-09-20');
  });
});
