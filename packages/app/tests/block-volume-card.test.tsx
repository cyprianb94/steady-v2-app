import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlanWeek } from '@steady/types';
import { BlockVolumeCard, buildVolumeCurveModel } from '../components/plan-builder/BlockVolumeCard';

function makeWeek(weekNumber: number, phase: PlanWeek['phase'], plannedKm: number): PlanWeek {
  return {
    weekNumber,
    phase,
    plannedKm,
    sessions: [null, null, null, null, null, null, null],
  };
}

describe('BlockVolumeCard curve model', () => {
  it('places markers only at phase starts', () => {
    const model = buildVolumeCurveModel([
      makeWeek(1, 'BASE', 70),
      makeWeek(2, 'BASE', 70),
      makeWeek(3, 'BUILD', 74),
      makeWeek(4, 'BUILD', 78),
      makeWeek(5, 'PEAK', 92),
      makeWeek(6, 'TAPER', 62),
      makeWeek(7, 'TAPER', 42),
    ]);

    expect(model.markers.map((marker) => marker.index)).toEqual([0, 2, 4, 5]);
  });

  it('colours each line section by the phase it belongs to', () => {
    const model = buildVolumeCurveModel([
      makeWeek(1, 'BASE', 70),
      makeWeek(2, 'BUILD', 74),
      makeWeek(3, 'PEAK', 92),
      makeWeek(4, 'TAPER', 62),
      makeWeek(5, 'TAPER', 42),
    ]);

    expect(new Set(model.segments.map((segment) => segment.phase))).toEqual(
      new Set(['BASE', 'BUILD', 'PEAK', 'TAPER']),
    );
  });

  it('shows phase-start x-axis labels and scrubs weekly totals', () => {
    const plan = [
      makeWeek(1, 'BASE', 70),
      makeWeek(2, 'BASE', 70),
      makeWeek(3, 'BUILD', 74),
      makeWeek(4, 'BUILD', 78),
      makeWeek(5, 'PEAK', 92),
      makeWeek(6, 'TAPER', 62),
      makeWeek(7, 'TAPER', 42),
    ];

    render(<BlockVolumeCard plan={plan} units="metric" raceDate="2026-04-26" />);

    expect(screen.getByText('W1')).toBeTruthy();
    expect(screen.getByText('W3')).toBeTruthy();
    expect(screen.getByText('W5')).toBeTruthy();
    expect(screen.getByText('W6')).toBeTruthy();
    expect(screen.getByText('TAPER')).toBeTruthy();

    const chart = screen.getByTestId('block-volume-plot-scrub-surface');
    fireEvent.mouseDown(chart, { clientX: 42, clientY: 70 });

    expect(screen.getByTestId('block-volume-tooltip')).toBeTruthy();
    expect(screen.getByText('W1 · Base')).toBeTruthy();
    expect(screen.getByText('9 - 15 Mar')).toBeTruthy();
    expect(screen.getByText('70km total')).toBeTruthy();

    fireEvent.mouseMove(chart, { clientX: 302, clientY: 70 });
    expect(screen.getByText('W7 · Taper')).toBeTruthy();
    expect(screen.getByText('42km total')).toBeTruthy();

    fireEvent.mouseUp(chart, { clientX: 302, clientY: 70 });
    expect(screen.queryByTestId('block-volume-tooltip')).toBeNull();
  });
});
