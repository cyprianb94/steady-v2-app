import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { router, useLocalSearchParams } from 'expo-router';

import StepTarget from '../app/onboarding/plan-builder/step-target';

describe('StepTarget target step', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T09:00:00Z'));
    vi.mocked(router.push).mockReset();
    vi.mocked(useLocalSearchParams).mockReturnValue({
      raceDistance: 'Marathon',
      raceLabel: 'Marathon',
      ultraPreset: '100K',
      customUltraDistance: '',
      raceDate: '2026-08-02',
      raceName: 'London Marathon',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('routes to base week with default phases hidden from the first goal screen', () => {
    render(<StepTarget />);

    expect(screen.getByText('STEP 3 OF 6')).toBeTruthy();
    expect(screen.getByText("Pick the race target you'll be working towards.")).toBeTruthy();
    expect(screen.getByText('Marathon race pace')).toBeTruthy();
    expect(screen.getByText('4:37/km')).toBeTruthy();
    expect(screen.queryByText('MP means target race pace for this plan.')).toBeNull();
    expect(screen.queryByText('Phase breakdown')).toBeNull();

    fireEvent.click(screen.getByText('sub-3:30'));
    fireEvent.click(screen.getByText('Build base week →'));

    expect(router.push).toHaveBeenCalledTimes(1);
    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      pathname: string;
      params: { targetTime: string; phases: string; weeks: string; trainingPaceProfile: string };
    };
    expect(call.pathname).toBe('/onboarding/plan-builder/step-base-week');
    expect(call.params.targetTime).toBe('sub-3:30');
    expect(call.params.weeks).toBe('16');
    expect(JSON.parse(call.params.trainingPaceProfile)).toMatchObject({
      raceDistance: 'Marathon',
      targetTime: 'sub-3:30',
      racePace: '4:59',
    });
    expect(JSON.parse(call.params.phases)).toMatchObject({
      BASE: expect.any(Number),
      BUILD: expect.any(Number),
      TAPER: expect.any(Number),
    });
  });

  it('lets the runner adjust estimates before the base week step', () => {
    render(<StepTarget />);

    fireEvent.click(screen.getByTestId('pace-profile-adjust'));
    expect(screen.getByTestId('pace-profile-sheet')).toBeTruthy();
    expect(screen.queryByText('Estimated')).toBeNull();
    fireEvent.click(screen.getByTestId('pace-profile-row-threshold'));
    fireEvent.change(screen.getByTestId('pace-profile-input-threshold-min'), {
      target: { value: '4:12' },
    });
    const thresholdMaxInput = screen.getByTestId('pace-profile-input-threshold-max');
    fireEvent.change(thresholdMaxInput, {
      target: { value: '4:22' },
    });
    fireEvent.blur(thresholdMaxInput);
    expect(screen.queryByText('Apply range')).toBeNull();
    expect(screen.queryByText('Edited')).toBeNull();
    expect(screen.queryByText('Reset estimate')).toBeNull();
    fireEvent.click(screen.getByText('Save paces'));
    fireEvent.click(screen.getByText('Build base week →'));

    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      params: { trainingPaceProfile: string };
    };
    const profile = JSON.parse(call.params.trainingPaceProfile);
    expect(profile.bands.threshold.paceRange).toEqual({ min: '4:12', max: '4:22' });
  });

  it('hides pace estimate status labels for Half Marathon onboarding too', () => {
    vi.mocked(useLocalSearchParams).mockReturnValue({
      raceDistance: 'Half Marathon',
      raceLabel: 'Half Marathon',
      ultraPreset: '100K',
      customUltraDistance: '',
      raceDate: '2026-08-02',
      raceName: 'Hackney Half',
    });
    render(<StepTarget />);

    fireEvent.click(screen.getByTestId('pace-profile-adjust'));
    expect(screen.getAllByText('Race pace').length).toBeGreaterThan(0);
    expect(screen.queryByText('Estimated')).toBeNull();
    expect(screen.queryByText('Edited')).toBeNull();
  });
});
