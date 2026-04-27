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
    expect(screen.queryByText('Phase breakdown')).toBeNull();

    fireEvent.click(screen.getByText('sub-3:30'));
    fireEvent.click(screen.getByText('Build base week →'));

    expect(router.push).toHaveBeenCalledTimes(1);
    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      pathname: string;
      params: { targetTime: string; phases: string; weeks: string };
    };
    expect(call.pathname).toBe('/onboarding/plan-builder/step-base-week');
    expect(call.params.targetTime).toBe('sub-3:30');
    expect(call.params.weeks).toBe('16');
    expect(JSON.parse(call.params.phases)).toMatchObject({
      BASE: expect.any(Number),
      BUILD: expect.any(Number),
      TAPER: expect.any(Number),
    });
  });
});
