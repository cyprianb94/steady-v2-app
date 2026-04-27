import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router, useLocalSearchParams } from 'expo-router';

import StepBaseWeek from '../app/onboarding/plan-builder/step-base-week';

const baseParams = {
  raceDistance: 'Marathon',
  raceLabel: 'Marathon',
  raceName: 'London Marathon',
  raceDate: '2026-08-02',
  weeks: '16',
  targetTime: 'sub-3:15',
  phases: JSON.stringify({ BASE: 3, BUILD: 9, RECOVERY: 0, PEAK: 2, TAPER: 2 }),
};

describe('StepBaseWeek starter selection', () => {
  beforeEach(() => {
    vi.mocked(router.push).mockReset();
    vi.mocked(useLocalSearchParams).mockReturnValue(baseParams);
  });

  it('keeps run count selection inside the template card', () => {
    render(<StepBaseWeek />);

    expect(screen.getByText('Build from template')).toBeTruthy();
    expect(screen.getByText('Clean slate')).toBeTruthy();
    expect(screen.getByText('Runs per week')).toBeTruthy();

    fireEvent.click(screen.getByTestId('starter-run-count-1'));
    fireEvent.click(screen.getByText('Build 1-run week →'));

    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      pathname: string;
      params: { starterMode: string; templateRunCount: string };
    };
    expect(call.pathname).toBe('/onboarding/plan-builder/step-template');
    expect(call.params.starterMode).toBe('template');
    expect(call.params.templateRunCount).toBe('1');
  });

  it('sends clean slate without applying the run count to it', () => {
    render(<StepBaseWeek />);

    fireEvent.click(screen.getByTestId('starter-run-count-7'));
    fireEvent.click(screen.getByTestId('starter-choice-clean'));
    fireEvent.click(screen.getByText('Build clean week →'));

    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      params: { starterMode: string; templateRunCount: string };
    };
    expect(call.params.starterMode).toBe('clean');
    expect(call.params.templateRunCount).toBe('7');
  });
});
