import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import * as Haptics from 'expo-haptics';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router, useLocalSearchParams } from 'expo-router';

import StepTemplate from '../app/onboarding/plan-builder/step-template';

const baseParams = {
  raceDistance: '10K',
  raceLabel: '10K',
  raceName: 'Club 10K',
  raceDate: '2026-09-20',
  weeks: '8',
  targetTime: '00:45:00',
  phases: JSON.stringify({ BASE: 2, BUILD: 4, RECOVERY: 0, PEAK: 1, TAPER: 1 }),
};

function dragHandle(testId: string, pageY: number) {
  const handle = screen.getByTestId(testId);
  fireEvent.mouseDown(handle, { clientY: 0 });
  fireEvent.mouseMove(handle, { clientY: pageY });
  fireEvent.mouseUp(handle);
}

describe('StepTemplate direct week reorder', () => {
  beforeEach(() => {
    vi.mocked(router.push).mockReset();
    vi.mocked(useLocalSearchParams).mockReturnValue(baseParams);
    vi.mocked(Haptics.selectionAsync).mockClear();
  });

  it('reorders the visible week directly and sends the updated template to Step 3', () => {
    render(<StepTemplate />);

    fireEvent.click(screen.getByTestId('starter-choice-template'));

    dragHandle('template-drag-handle-0', 360);
    fireEvent.click(screen.getByText('Generate 8-week plan →'));

    expect(router.push).toHaveBeenCalledTimes(1);
    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      params: { template: string };
    };
    const template = JSON.parse(call.params.template);
    expect(template[0].type).toBe('LONG');
    expect(template[6].type).toBe('EASY');
  });

  it('emits haptics when a session is picked up and moved over another slot', () => {
    render(<StepTemplate />);

    fireEvent.click(screen.getByTestId('starter-choice-template'));
    vi.mocked(Haptics.selectionAsync).mockClear();

    dragHandle('template-drag-handle-0', 360);

    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
  });

  it('lets the user cancel the regeneration warning when per-week edits exist', () => {
    vi.mocked(useLocalSearchParams).mockReturnValue({
      ...baseParams,
      hasPerWeekTweaks: 'true',
    });

    render(<StepTemplate />);

    fireEvent.click(screen.getByTestId('starter-choice-template'));
    dragHandle('template-drag-handle-0', 360);

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

  it('lets the user drag the default rest day to a new slot', () => {
    render(<StepTemplate />);

    fireEvent.click(screen.getByTestId('starter-choice-template'));

    dragHandle('template-drag-handle-4', -120);
    fireEvent.click(screen.getByText('Generate 8-week plan →'));

    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      params: { template: string };
    };
    const template = JSON.parse(call.params.template);
    expect(template[2]).toBeNull();
    expect(template[4]?.type).toBe('EASY');
  });
});
