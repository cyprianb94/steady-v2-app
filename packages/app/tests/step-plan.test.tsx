import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePreventRemove } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { deriveTrainingPaceProfile } from '@steady/types';

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
  weeks: '6',
  targetTime: '00:45:00',
  phases: JSON.stringify({ BASE: 1, BUILD: 3, RECOVERY: 0, PEAK: 1, TAPER: 1 }),
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

  it('opens on the revised Structure and Weeks review tabs', () => {
    render(<StepPlan />);

    expect(screen.getByTestId('block-review-volume-chart')).toBeTruthy();
    expect(screen.getByTestId('block-review-phase-strip')).toBeTruthy();
    expect(screen.getByTestId('block-review-tabs')).toBeTruthy();
    expect(screen.getByText('Structure')).toBeTruthy();
    expect(screen.getByText('Weeks')).toBeTruthy();
    expect(screen.getByText('00:45:00')).toBeTruthy();
    expect(screen.getByText(/20 Sept 2026/)).toBeTruthy();
    expect(screen.queryByText(/Race 20 Sept 2026/)).toBeNull();
    expect(screen.queryByText('Overview')).toBeNull();
    expect(screen.queryByText('Phases')).toBeNull();
  });

  it('opens the shared full-screen editor and applies an edit to remaining weeks', () => {
    render(<StepPlan />);

    fireEvent.click(screen.getByTestId('block-review-tab-weeks'));
    fireEvent.click(screen.getByTestId('block-week-row-press-1'));
    fireEvent.click(screen.getByTestId('block-week-day-1-0'));

    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Target pace')).toBeTruthy();
    expect(
      vi.mocked(usePreventRemove).mock.calls.some(([preventRemove]) => preventRemove === true),
    ).toBe(true);

    fireEvent.click(screen.getByText('Rest'));
    fireEvent.click(screen.getByText('Update session'));

    expect(screen.getByText('Where do you want this change applied?')).toBeTruthy();
    fireEvent.click(screen.getByText('Apply change'));

    expect(screen.getByTestId('block-week-day-1-0').textContent).toContain('Rest day');

    fireEvent.click(screen.getByTestId('block-week-row-press-2'));
    expect(screen.getByTestId('block-week-day-2-0').textContent).toContain('Rest day');
  });

  it('closes the editor without propagation when nothing materially changed', () => {
    render(<StepPlan />);

    fireEvent.click(screen.getByTestId('block-review-tab-weeks'));
    fireEvent.click(screen.getByTestId('block-week-row-press-1'));
    fireEvent.click(screen.getByTestId('block-week-day-1-0'));

    expect(screen.getByText('Update session')).toBeTruthy();
    fireEvent.click(screen.getByText('Update session'));

    expect(screen.queryByText('Where do you want this change applied?')).toBeNull();
    expect(screen.queryByText('Update session')).toBeNull();
  });

  it('keeps the Weeks tab collapsible and scopes Block-style drag rescheduling', async () => {
    render(<StepPlan />);

    fireEvent.click(screen.getByTestId('block-review-tab-weeks'));
    fireEvent.click(screen.getByTestId('block-week-row-press-1'));

    expect(screen.getByTestId('block-week-expanded-1')).toBeTruthy();
    expect(screen.queryByText(/any change will ask where to apply/i)).toBeNull();

    fireEvent.mouseDown(screen.getByTestId('block-week-drag-handle-1-4'), { clientY: 240 });
    fireEvent.mouseMove(screen.getByTestId('block-week-drag-handle-1-4'), { clientY: 0 });
    fireEvent.mouseUp(screen.getByTestId('block-week-drag-handle-1-4'), {});

    expect(screen.getByText('Where should this reschedule apply?')).toBeTruthy();
    fireEvent.click(screen.getByText('Apply reschedule'));

    expect(screen.getByTestId('block-week-day-1-0').textContent).toContain('Rest day');
    expect(screen.getByTestId('block-week-day-1-4').textContent).toContain('8km · 5:20');

    fireEvent.click(screen.getByTestId('block-week-row-press-2'));
    expect(screen.getByTestId('block-week-day-2-0').textContent).toContain('Rest day');

    fireEvent.click(screen.getByTestId('block-week-row-press-2'));
    await waitFor(() => {
      expect(screen.queryByTestId('block-week-expanded-2')).toBeNull();
    });
  });

  it('opens interval sessions in the notebook-row editor rather than the old inline controls', () => {
    render(<StepPlan />);

    fireEvent.click(screen.getByTestId('block-review-tab-weeks'));
    fireEvent.click(screen.getByTestId('block-week-row-press-1'));
    fireEvent.click(screen.getByTestId('block-week-day-1-1'));

    expect(screen.getByText('Repetitions')).toBeTruthy();
    expect(screen.getByText('Rep target pace')).toBeTruthy();
    expect(screen.queryByText('Rep distance')).toBeNull();
  });

  it('edits phase structure with Build absorbing the difference', () => {
    render(<StepPlan />);

    fireEvent.click(screen.getByTestId('block-review-edit-structure'));

    expect(screen.getByTestId('phase-editor-build-count').textContent).toBe('3w');
    expect(screen.getByTestId('phase-editor-recovery-count').textContent).toBe('0w');

    fireEvent.click(screen.getByTestId('phase-editor-recovery-increment'));

    expect(screen.getByTestId('phase-editor-build-count').textContent).toBe('2w');
    expect(screen.getByTestId('phase-editor-recovery-count').textContent).toBe('1w');
    expect(screen.getByText('Final high-load block before taper.')).toBeTruthy();
    expect(screen.getByText('auto-adjusts')).toBeTruthy();
  });

  it('applies edited phases, custom overload cadence, and saves a dated plan', async () => {
    render(<StepPlan />);

    expect(screen.getByTestId('plan-builder-review-keyboard-frame')).toBeTruthy();

    fireEvent.click(screen.getByTestId('block-review-edit-structure'));
    fireEvent.click(screen.getByTestId('phase-editor-recovery-increment'));
    fireEvent.click(screen.getByTestId('phase-editor-done'));
    fireEvent.click(screen.getByTestId('block-review-overload-custom'));
    fireEvent.change(screen.getByTestId('progression-pct-input'), {
      target: { value: '6' },
    });
    fireEvent.change(screen.getByTestId('progression-every-weeks-input'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByText('Apply +6% / 3w'));

    expect(screen.getByText('+6% progression every 3 weeks.')).toBeTruthy();

    fireEvent.click(screen.getByText('Review weeks →'));
    fireEvent.click(screen.getByText('Save plan and start training →'));

    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(1));

    const savedPlan = vi.mocked(savePlan).mock.calls[0][0];
    expect(savedPlan).toMatchObject({
      raceName: 'Club 10K',
      raceDate: '2026-09-20',
      phases: { BASE: 1, BUILD: 2, RECOVERY: 1, PEAK: 1, TAPER: 1 },
      progressionPct: 6,
      progressionEveryWeeks: 3,
    });
    expect(savedPlan.weeks.map((week) => week.phase)).toEqual([
      'BASE',
      'BUILD',
      'RECOVERY',
      'BUILD',
      'PEAK',
      'TAPER',
    ]);
    expect(savedPlan.weeks[0].sessions[0]?.date).toBe('2026-08-10');
    expect(savedPlan.weeks[5].sessions[6]?.date).toBe('2026-09-20');
    expect(router.replace).toHaveBeenCalledWith('/onboarding/plan-live');
  });

  it('persists the onboarding training pace profile with the saved plan', async () => {
    const trainingPaceProfile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    });
    trainingPaceProfile.bands.threshold.paceRange = { min: '4:08', max: '4:18' };
    vi.mocked(useLocalSearchParams).mockReturnValue({
      ...baseParams,
      trainingPaceProfile: JSON.stringify(trainingPaceProfile),
    });

    render(<StepPlan />);

    fireEvent.click(screen.getByText('Review weeks →'));
    fireEvent.click(screen.getByText('Save plan and start training →'));

    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(1));
    expect(vi.mocked(savePlan).mock.calls[0][0].trainingPaceProfile).toMatchObject({
      raceDistance: '10K',
      targetTime: '00:45:00',
      bands: {
        threshold: {
          paceRange: { min: '4:08', max: '4:18' },
        },
      },
    });
  });
});
