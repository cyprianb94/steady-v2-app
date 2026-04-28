import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router, useLocalSearchParams } from 'expo-router';

import StepTemplate from '../app/onboarding/plan-builder/step-template';

function dragHandle(testId: string, pageY: number) {
  const handle = screen.getByTestId(testId);
  fireEvent.mouseDown(handle, { clientY: 0 });
  fireEvent.mouseMove(handle, { clientY: pageY });
  fireEvent.mouseUp(handle);
}

const baseParams = {
  raceDistance: '10K',
  raceLabel: '10K',
  raceName: 'Club 10K',
  raceDate: '2026-09-20',
  weeks: '8',
  targetTime: '00:45:00',
  phases: JSON.stringify({ BASE: 2, BUILD: 4, RECOVERY: 0, PEAK: 1, TAPER: 1 }),
  starterMode: 'template',
  templateRunCount: '6',
};

describe('StepTemplate starter choice', () => {
  beforeEach(() => {
    vi.mocked(router.push).mockReset();
    vi.mocked(useLocalSearchParams).mockReturnValue(baseParams);
  });

  it('loads into the chooser-first state', () => {
    const {
      starterMode: _starterMode,
      templateRunCount: _templateRunCount,
      ...chooserParams
    } = baseParams;
    vi.mocked(useLocalSearchParams).mockReturnValue(chooserParams);

    render(<StepTemplate />);

    expect(screen.getByText(/Start from a recommended base or build your own week from scratch/i)).toBeTruthy();
    expect(screen.getByTestId('starter-choice-template')).toBeTruthy();
    expect(screen.getByTestId('starter-choice-clean')).toBeTruthy();
    expect(screen.queryByText('Generate 8-week plan →')).toBeNull();
  });

  it('hydrates the Steady template and passes the resolved template to Step 3', () => {
    render(<StepTemplate />);

    expect(screen.getByText('6-run template')).toBeTruthy();
    expect(screen.getAllByText('Easy Run · conversational pace').length).toBeGreaterThan(0);
    expect(screen.getByText('10km · 4:15-4:25')).toBeTruthy();
    expect(screen.getByText('Tempo · controlled hard')).toBeTruthy();

    fireEvent.click(screen.getByText('Generate 8-week plan →'));

    expect(router.push).toHaveBeenCalledTimes(1);
    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      params: { template: string };
    };
    const template = JSON.parse(call.params.template);
    expect(template[0].type).toBe('EASY');
    expect(template[4]).toBeNull();
    expect(template[6].type).toBe('LONG');
  });

  it('keeps the clean slate CTA disabled until a session is added', () => {
    vi.mocked(useLocalSearchParams).mockReturnValue({
      ...baseParams,
      starterMode: 'clean',
    });

    render(<StepTemplate />);

    expect(screen.getByText('Clean slate · empty week')).toBeTruthy();

    fireEvent.click(screen.getByText('Generate 8-week plan →'));
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Mon'));
    expect(screen.getByText('Cancel')).toBeTruthy();
    fireEvent.click(screen.getByText('Add session'));
    fireEvent.click(screen.getByText('Generate 8-week plan →'));

    expect(router.push).toHaveBeenCalledTimes(1);
    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      params: { template: string };
    };
    const template = JSON.parse(call.params.template);
    expect(template[0].type).toBe('EASY');
    expect(template[1]).toBeNull();
  });

  it('asks for confirmation before replacing an edited week with a different starter mode', () => {
    render(<StepTemplate />);

    dragHandle('template-drag-handle-0', 360);

    fireEvent.click(screen.getByTestId('starter-summary-change'));
    fireEvent.click(screen.getByTestId('starter-choice-clean'));

    expect(screen.getByText('Replace this week?')).toBeTruthy();
    fireEvent.click(screen.getByText('Keep current week'));
    fireEvent.click(screen.getByText('Generate 8-week plan →'));

    const call = vi.mocked(router.push).mock.calls[0][0] as unknown as {
      params: { template: string };
    };
    const template = JSON.parse(call.params.template);
    expect(template[0].type).toBe('LONG');
    expect(template[6].type).toBe('EASY');
  });

  it('warns before replacing the template when per-week preview tweaks already exist', () => {
    vi.mocked(useLocalSearchParams).mockReturnValue({
      ...baseParams,
      hasPerWeekTweaks: 'true',
    });

    render(<StepTemplate />);

    fireEvent.click(screen.getByTestId('starter-summary-change'));
    fireEvent.click(screen.getByTestId('starter-choice-clean'));

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
