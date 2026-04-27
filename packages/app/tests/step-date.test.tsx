import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { router, useLocalSearchParams } from 'expo-router';

import StepDate from '../app/onboarding/plan-builder/step-date';

describe('StepDate race date picker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T09:00:00Z'));
    vi.mocked(router.push).mockReset();
    vi.mocked(useLocalSearchParams).mockReturnValue({
      raceDistance: 'Marathon',
      raceLabel: 'Marathon',
      ultraPreset: '100K',
      customUltraDistance: '',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets the user pick a race date and carries it to the target step', () => {
    render(<StepDate />);

    expect(screen.queryByText('Pick race date')).toBeNull();

    fireEvent.click(screen.getByTestId('race-date-trigger'));
    expect(screen.getByText('Pick race date')).toBeTruthy();
    expect(screen.getByTestId('race-date-calendar-weekdays').textContent).toBe('Mon Tue Wed Thu Fri Sat Sun');

    fireEvent.change(screen.getByTestId('race-date-calendar'), {
      target: { value: '2026-09-20' },
    });
    fireEvent.click(screen.getByText('Done'));

    expect(screen.queryByText('Pick race date')).toBeNull();
    expect(screen.getByText('20 Sep 2026')).toBeTruthy();
    expect(screen.getByText('23 weeks from now')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('e.g. London Marathon'), {
      target: { value: 'London Marathon' },
    });
    fireEvent.click(screen.getByText('Continue →'));

    expect(router.push).toHaveBeenCalledTimes(1);
    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      pathname: string;
      params: { raceDate: string; weeks: string; raceName: string };
    };
    expect(call.pathname).toBe('/onboarding/plan-builder/step-target');
    expect(call.params.raceDate).toBe('2026-09-20');
    expect(call.params.weeks).toBe('23');
    expect(call.params.raceName).toBe('London Marathon');
  });
});
