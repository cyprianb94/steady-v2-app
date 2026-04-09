import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../lib/trpc', () => ({ trpc: {} }));

import { PhaseInfoStrip } from '../components/home/PhaseInfoStrip';

describe('PhaseInfoStrip', () => {
  it('renders phase badge, week number, and race countdown', () => {
    render(
      <PhaseInfoStrip
        phase="BUILD"
        weekNumber={8}
        totalWeeks={20}
        raceDate="2026-07-15"
        today="2026-04-09"
      />,
    );

    expect(screen.getByText('BUILD')).toBeTruthy();
    expect(screen.getByText('Week 8 of 20')).toBeTruthy();
    expect(screen.getByText(/weeks to go/)).toBeTruthy();
  });

  it('renders without race countdown when raceDate is not provided', () => {
    render(
      <PhaseInfoStrip
        phase="BASE"
        weekNumber={1}
        totalWeeks={16}
      />,
    );

    expect(screen.getByText('BASE')).toBeTruthy();
    expect(screen.getByText('Week 1 of 16')).toBeTruthy();
    expect(screen.queryByText(/weeks to go/)).toBeNull();
  });

  it('uses a clear race-week label when the countdown is zero', () => {
    render(
      <PhaseInfoStrip
        phase="TAPER"
        weekNumber={16}
        totalWeeks={16}
        raceDate="2026-07-15"
        today="2026-07-15"
      />,
    );

    expect(screen.getByText('Race week')).toBeTruthy();
    expect(screen.queryByText('0 weeks to go')).toBeNull();
  });
});
