import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannedSession, TrainingPlanWithAnnotation } from '@steady/types';

const { mockRefresh, mockUpdateWeeks, planState } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockUpdateWeeks: vi.fn(),
  planState: { current: null as TrainingPlanWithAnnotation | null },
}));

vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => ({
    plan: planState.current,
    loading: false,
    currentWeek: planState.current?.weeks[0] ?? null,
    currentWeekIndex: 0,
    refresh: mockRefresh,
  }),
}));

vi.mock('../lib/trpc', () => ({
  trpc: {
    activity: { list: { query: vi.fn(() => new Promise(() => {})) } },
    crossTraining: { getForDateRange: { query: vi.fn().mockResolvedValue([]) } },
    plan: { updateWeeks: { mutate: mockUpdateWeeks } },
  },
}));

import BlockTab from '../app/(tabs)/block';

function session(id: string, type: PlannedSession['type'], overrides: Partial<PlannedSession> = {}): PlannedSession {
  return { id, type, date: '2026-04-06', distance: 8, ...overrides };
}

function makeWeek(
  weekNumber: number,
  sessions: (PlannedSession | null)[],
  phase: TrainingPlanWithAnnotation['weeks'][number]['phase'] = 'BASE',
): TrainingPlanWithAnnotation['weeks'][number] {
  return {
    weekNumber,
    phase,
    sessions,
    plannedKm: 24,
  };
}

function makePlan(weeks: TrainingPlanWithAnnotation['weeks']): TrainingPlanWithAnnotation {
  const phases = weeks.reduce(
    (acc, week) => {
      acc[week.phase] += 1;
      return acc;
    },
    { BASE: 0, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 } as TrainingPlanWithAnnotation['phases'],
  );

  return {
    id: 'plan-1',
    userId: 'user-1',
    createdAt: '2026-04-01',
    raceName: 'Spring 10K',
    raceDate: '2026-06-01',
    raceDistance: '10K',
    targetTime: 'sub-45',
    phases,
    progressionPct: 0,
    templateWeek: weeks[0].sessions,
    weeks,
    activeInjury: null,
    coachAnnotation: 'Keep going.',
  };
}

describe('BlockTab session rearrange', () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockUpdateWeeks.mockReset();
    mockUpdateWeeks.mockResolvedValue(null);
    planState.current = makePlan([
      makeWeek(1, [
        session('w1-easy', 'EASY', { distance: 8 }),
        null,
        session('w1-long', 'LONG', { distance: 16 }),
        null,
        null,
        null,
        null,
      ]),
      makeWeek(2, [
        session('w2-easy', 'EASY', { distance: 8 }),
        null,
        session('w2-long', 'LONG', { distance: 16 }),
        null,
        null,
        null,
        null,
      ]),
    ]);
  });

  it('formats the race date and uses the wireframe-style phase caption copy', () => {
    render(<BlockTab />);

    expect(screen.getByText('Jun 1, 2026')).toBeTruthy();
    expect(screen.getByText('Current phase:')).toBeTruthy();
    expect(
      screen.getByText(/Base\. Week 1 of 2\. Aerobic foundation building steadily\./),
    ).toBeTruthy();
  });

  it('shows the scope picker after done and persists the swap to remaining weeks by default', async () => {
    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    fireEvent.click(screen.getByText('Rearrange sessions'));
    fireEvent.click(screen.getByTestId('rearrange-day-0'));
    fireEvent.click(screen.getByTestId('rearrange-day-2'));
    fireEvent.click(screen.getByTestId('rearrange-done'));

    expect(screen.getByText('Apply change where?')).toBeTruthy();
    expect(screen.getByText('1 session swap')).toBeTruthy();
    expect(screen.getByText('Base phase only')).toBeTruthy();
    expect(screen.getByText('2 base weeks in this plan')).toBeTruthy();
    expect(screen.queryByText('Build phase only')).toBeNull();

    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdateWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdateWeeks.mock.calls[0][0];
    expect(input.weeks[0].sessions[0]?.id).toBe('w1-long');
    expect(input.weeks[0].sessions[2]?.id).toBe('w1-easy');
    expect(input.weeks[0].swapLog).toEqual([{ from: 0, to: 2 }]);
    expect(input.weeks[1].sessions[0]?.id).toBe('w2-long');
    expect(input.weeks[1].sessions[2]?.id).toBe('w2-easy');
    expect(input.weeks[1].swapLog).toEqual([{ from: 0, to: 2 }]);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('respects this-week scope from the propagation picker', async () => {
    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    fireEvent.click(screen.getByText('Rearrange sessions'));
    fireEvent.click(screen.getByTestId('rearrange-day-0'));
    fireEvent.click(screen.getByTestId('rearrange-day-2'));
    fireEvent.click(screen.getByTestId('rearrange-done'));
    fireEvent.click(screen.getByText('This week only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdateWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdateWeeks.mock.calls[0][0];
    expect(input.weeks[0].sessions[0]?.id).toBe('w1-long');
    expect(input.weeks[0].swapLog).toEqual([{ from: 0, to: 2 }]);
    expect(input.weeks[1].sessions[0]?.id).toBe('w2-easy');
    expect(input.weeks[1].swapLog).toBeUndefined();
  });

  it('hides the rearrange button when every session is completed', () => {
    planState.current = makePlan([
      makeWeek(1, [
        session('mon', 'EASY', { actualActivityId: 'act-1' }),
        session('tue', 'EASY', { actualActivityId: 'act-2' }),
        session('wed', 'EASY', { actualActivityId: 'act-3' }),
        session('thu', 'EASY', { actualActivityId: 'act-4' }),
        session('fri', 'EASY', { actualActivityId: 'act-5' }),
        session('sat', 'EASY', { actualActivityId: 'act-6' }),
        session('sun', 'EASY', { actualActivityId: 'act-7' }),
      ]),
    ]);

    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));

    expect(screen.queryByText('Rearrange sessions')).toBeNull();
  });

  it('lets the user turn a planned day into a rest day from the expanded week editor', async () => {
    planState.current = makePlan([
      makeWeek(1, [
        session('w1-int', 'INTERVAL', { reps: 6, repDist: 800, recovery: '90s', warmup: 1.5, cooldown: 1 }),
        null,
        null,
        null,
        null,
        null,
        null,
      ]),
      makeWeek(2, [
        session('w2-int', 'INTERVAL', { reps: 6, repDist: 800, recovery: '90s', warmup: 1.5, cooldown: 1 }),
        null,
        null,
        null,
        null,
        null,
        null,
      ]),
    ]);

    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    fireEvent.click(screen.getByTestId('block-day-1-0'));
    fireEvent.click(screen.getByText('R'));
    fireEvent.click(screen.getByText('Update session'));
    fireEvent.click(screen.getByText('This week only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdateWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdateWeeks.mock.calls[0][0];
    expect(input.weeks[0].sessions[0]).toBeNull();
    expect(input.weeks[1].sessions[0]?.id).toBe('w2-int');
    expect(input.weeks[1].sessions[0]?.type).toBe('INTERVAL');
  });

  it('lets the user add a session on an empty rest slot from the expanded week editor', async () => {
    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    fireEvent.click(screen.getByTestId('block-day-1-1'));
    fireEvent.click(screen.getByText('Add session'));
    fireEvent.click(screen.getByText('This week only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdateWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdateWeeks.mock.calls[0][0];
    expect(input.weeks[0].sessions[1]?.type).toBe('EASY');
    expect(input.weeks[0].sessions[1]?.id).toBeTruthy();
    expect(input.weeks[0].sessions[1]?.date).toBe('2026-04-07');
    expect(input.weeks[1].sessions[1]).toBeNull();
  });

  it('applies a build-phase edit across every build week only', async () => {
    planState.current = makePlan([
      makeWeek(1, [session('w1-easy', 'EASY'), null, null, null, null, null, null], 'BASE'),
      makeWeek(2, [session('w2-easy', 'EASY'), null, null, null, null, null, null], 'BUILD'),
      makeWeek(3, [session('w3-easy', 'EASY'), null, null, null, null, null, null], 'BUILD'),
      makeWeek(4, [session('w4-easy', 'EASY'), null, null, null, null, null, null], 'PEAK'),
    ]);

    render(<BlockTab />);

    fireEvent.click(screen.getByText('W2'));
    fireEvent.click(screen.getByTestId('block-day-2-0'));
    fireEvent.click(screen.getByText('R'));
    fireEvent.click(screen.getByText('Update session'));

    expect(screen.getByText('Build phase only')).toBeTruthy();
    expect(screen.getByText('2 build weeks in this plan')).toBeTruthy();

    fireEvent.click(screen.getByText('Build phase only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdateWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdateWeeks.mock.calls[0][0];
    expect(input.weeks[0].sessions[0]?.type).toBe('EASY');
    expect(input.weeks[1].sessions[0]).toBeNull();
    expect(input.weeks[2].sessions[0]).toBeNull();
    expect(input.weeks[3].sessions[0]?.type).toBe('EASY');
  });

  it('applies a future peak-phase edit across every peak week only', async () => {
    planState.current = makePlan([
      makeWeek(1, [session('w1-easy', 'EASY'), null, null, null, null, null, null], 'BASE'),
      makeWeek(2, [session('w2-easy', 'EASY'), null, null, null, null, null, null], 'BUILD'),
      makeWeek(3, [session('w3-easy', 'EASY'), null, null, null, null, null, null], 'PEAK'),
      makeWeek(4, [session('w4-easy', 'EASY'), null, null, null, null, null, null], 'PEAK'),
      makeWeek(5, [session('w5-easy', 'EASY'), null, null, null, null, null, null], 'TAPER'),
    ]);

    render(<BlockTab />);

    fireEvent.click(screen.getByText('W4'));
    fireEvent.click(screen.getByTestId('block-day-4-0'));
    fireEvent.click(screen.getByText('R'));
    fireEvent.click(screen.getByText('Update session'));

    expect(screen.getByText('Peak phase only')).toBeTruthy();
    expect(screen.getByText('2 peak weeks in this plan')).toBeTruthy();

    fireEvent.click(screen.getByText('Peak phase only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdateWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdateWeeks.mock.calls[0][0];
    expect(input.weeks[0].sessions[0]?.type).toBe('EASY');
    expect(input.weeks[1].sessions[0]?.type).toBe('EASY');
    expect(input.weeks[2].sessions[0]).toBeNull();
    expect(input.weeks[3].sessions[0]).toBeNull();
    expect(input.weeks[4].sessions[0]?.type).toBe('EASY');
  });

  it('applies a recovery-phase edit across every recovery week only', async () => {
    planState.current = makePlan([
      makeWeek(1, [session('w1-easy', 'EASY'), null, null, null, null, null, null], 'BASE'),
      makeWeek(2, [session('w2-easy', 'EASY'), null, null, null, null, null, null], 'RECOVERY'),
      makeWeek(3, [session('w3-easy', 'EASY'), null, null, null, null, null, null], 'RECOVERY'),
      makeWeek(4, [session('w4-easy', 'EASY'), null, null, null, null, null, null], 'BUILD'),
    ]);

    render(<BlockTab />);

    fireEvent.click(screen.getByText('W3'));
    fireEvent.click(screen.getByTestId('block-day-3-0'));
    fireEvent.click(screen.getByText('R'));
    fireEvent.click(screen.getByText('Update session'));

    expect(screen.getByText('Recovery phase only')).toBeTruthy();
    expect(screen.getByText('2 recovery weeks in this plan')).toBeTruthy();

    fireEvent.click(screen.getByText('Recovery phase only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdateWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdateWeeks.mock.calls[0][0];
    expect(input.weeks[0].sessions[0]?.type).toBe('EASY');
    expect(input.weeks[1].sessions[0]).toBeNull();
    expect(input.weeks[2].sessions[0]).toBeNull();
    expect(input.weeks[3].sessions[0]?.type).toBe('EASY');
  });

  it('applies a taper-phase edit across every taper week only', async () => {
    planState.current = makePlan([
      makeWeek(1, [session('w1-easy', 'EASY'), null, null, null, null, null, null], 'BUILD'),
      makeWeek(2, [session('w2-easy', 'EASY'), null, null, null, null, null, null], 'PEAK'),
      makeWeek(3, [session('w3-easy', 'EASY'), null, null, null, null, null, null], 'TAPER'),
      makeWeek(4, [session('w4-easy', 'EASY'), null, null, null, null, null, null], 'TAPER'),
    ]);

    render(<BlockTab />);

    fireEvent.click(screen.getByText('W4'));
    fireEvent.click(screen.getByTestId('block-day-4-0'));
    fireEvent.click(screen.getByText('R'));
    fireEvent.click(screen.getByText('Update session'));

    expect(screen.getByText('Taper phase only')).toBeTruthy();
    expect(screen.getByText('2 taper weeks in this plan')).toBeTruthy();

    fireEvent.click(screen.getByText('Taper phase only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdateWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdateWeeks.mock.calls[0][0];
    expect(input.weeks[0].sessions[0]?.type).toBe('EASY');
    expect(input.weeks[1].sessions[0]?.type).toBe('EASY');
    expect(input.weeks[2].sessions[0]).toBeNull();
    expect(input.weeks[3].sessions[0]).toBeNull();
  });
});
