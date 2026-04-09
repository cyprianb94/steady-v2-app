import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router, useLocalSearchParams } from 'expo-router';

import StepTemplate from '../app/onboarding/plan-builder/step-template';

describe('StepTemplate rearrange', () => {
  beforeEach(() => {
    vi.mocked(router.push).mockReset();
    vi.mocked(useLocalSearchParams).mockReturnValue({
      race: '10K',
      weeks: '8',
      target: 'sub-45',
      phases: JSON.stringify({ BASE: 2, BUILD: 4, RECOVERY: 0, PEAK: 1, TAPER: 1 }),
    });
  });

  it('opens RearrangeSheet and sends the rearranged template to Step 3', () => {
    render(<StepTemplate />);

    fireEvent.click(screen.getByText('Rearrange'));
    fireEvent.click(screen.getByTestId('rearrange-day-0'));
    fireEvent.click(screen.getByTestId('rearrange-day-6'));
    fireEvent.click(screen.getByTestId('rearrange-done'));
    fireEvent.click(screen.getByText('Generate 8-week plan →'));

    expect(router.push).toHaveBeenCalledTimes(1);
    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      params: { template: string };
    };
    const template = JSON.parse(call.params.template);
    expect(template[0].type).toBe('LONG');
    expect(template[6].type).toBe('EASY');
  });

  it('lets the user cancel the regeneration warning when per-week edits exist', () => {
    vi.mocked(useLocalSearchParams).mockReturnValue({
      race: '10K',
      weeks: '8',
      target: 'sub-45',
      phases: JSON.stringify({ BASE: 2, BUILD: 4, RECOVERY: 0, PEAK: 1, TAPER: 1 }),
      hasPerWeekTweaks: 'true',
    });

    render(<StepTemplate />);

    fireEvent.click(screen.getByText('Rearrange'));
    fireEvent.click(screen.getByTestId('rearrange-day-0'));
    fireEvent.click(screen.getByTestId('rearrange-day-6'));
    fireEvent.click(screen.getByTestId('rearrange-done'));

    expect(screen.getByText('Regenerate plan preview?')).toBeTruthy();
    fireEvent.click(screen.getByText('Keep edits'));
    fireEvent.click(screen.getByText('Generate 8-week plan →'));

    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      params: { template: string };
    };
    const template = JSON.parse(call.params.template);
    expect(template[0].type).toBe('EASY');
    expect(template[6].type).toBe('LONG');
  });
});
