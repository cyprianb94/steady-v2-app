import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';

import StepGoal from '../app/onboarding/plan-builder/step-goal';

describe('StepGoal race date picker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T09:00:00Z'));
    vi.mocked(router.push).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets the user pick a race date from the calendar sheet and carries it to step 2', () => {
    render(<StepGoal />);

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
    expect(screen.getByText('23 wks')).toBeTruthy();

    fireEvent.click(screen.getByText('Build my template week →'));

    expect(router.push).toHaveBeenCalledTimes(1);
    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      params: { raceDate: string; weeks: string };
    };
    expect(call.params.raceDate).toBe('2026-09-20');
    expect(call.params.weeks).toBe('23');
  });
});
