import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';

import StepGoal from '../app/onboarding/plan-builder/step-goal';

describe('StepGoal race step', () => {
  beforeEach(() => {
    vi.mocked(router.push).mockReset();
  });

  it('keeps the race decision focused and routes to the date step', () => {
    render(<StepGoal />);

    expect(screen.getByText('STEP 1 OF 6')).toBeTruthy();
    expect(screen.queryByText('Target time')).toBeNull();
    expect(screen.queryByText('Phase breakdown')).toBeNull();

    fireEvent.click(screen.getByText('10K'));
    fireEvent.click(screen.getByText('Continue →'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/onboarding/plan-builder/step-date',
      params: {
        raceDistance: '10K',
        raceLabel: '10K',
        ultraPreset: '100K',
        customUltraDistance: '',
      },
    });
  });

  it('requires a custom Ultra distance and carries it as the race label', () => {
    render(<StepGoal />);

    fireEvent.click(screen.getByText('Ultra'));
    fireEvent.click(screen.getByText('Custom'));
    fireEvent.click(screen.getByText('Continue →'));
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('ultra-distance-input'), {
      target: { value: '80K' },
    });
    fireEvent.click(screen.getByText('Continue →'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/onboarding/plan-builder/step-date',
      params: {
        raceDistance: 'Ultra',
        raceLabel: '80K Ultra',
        ultraPreset: 'Custom',
        customUltraDistance: '80K',
      },
    });
  });
});
