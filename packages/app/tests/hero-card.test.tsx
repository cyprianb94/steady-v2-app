import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../lib/trpc', () => ({ trpc: {} }));

import { TodayHeroCard } from '../components/home/TodayHeroCard';

describe('TodayHeroCard', () => {
  it('shows session type label, distance, and pace for an easy run', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's1',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
        }}
      />,
    );

    expect(screen.getByText('EASY')).toBeTruthy();
    expect(screen.getByText('8km Easy Run')).toBeTruthy();
    expect(screen.getByText('5:20')).toBeTruthy();
  });

  it('shows reps, rep distance, and recovery for an interval session', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's2',
          type: 'INTERVAL',
          date: '2026-04-09',
          reps: 6,
          repDist: 800,
          pace: '3:50',
          recovery: '90s',
          warmup: { unit: 'km', value: 1.5 },
          cooldown: { unit: 'km', value: 1 },
        }}
      />,
    );

    expect(screen.getByText('INTERVAL')).toBeTruthy();
    expect(screen.getByText('6×800m Intervals')).toBeTruthy();
    expect(screen.getByText('3:50')).toBeTruthy();
    expect(screen.getByText(/1.5km warm/)).toBeTruthy();
    expect(screen.getByText(/1km cool/)).toBeTruthy();
  });

  it('shows a positive rest acknowledgment for a rest day', () => {
    render(<TodayHeroCard session={null} />);

    expect(screen.getByText(/rest day/i)).toBeTruthy();
    // Should NOT be empty or gray — should have positive messaging
    expect(screen.queryByText(/no session/i)).toBeNull();
  });

  it('shows warmup and cooldown for a tempo session', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's3',
          type: 'TEMPO',
          date: '2026-04-09',
          distance: 10,
          pace: '4:20',
          warmup: { unit: 'km', value: 2 },
          cooldown: { unit: 'km', value: 1.5 },
        }}
      />,
    );

    expect(screen.getByText('TEMPO')).toBeTruthy();
    expect(screen.getByText('10km Tempo')).toBeTruthy();
    expect(screen.getByText(/2km warm/)).toBeTruthy();
    expect(screen.getByText(/1.5km cool/)).toBeTruthy();
  });

  it('shows minute-based warmup and cooldown labels', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's3b',
          type: 'TEMPO',
          date: '2026-04-09',
          distance: 10,
          pace: '4:20',
          warmup: { unit: 'min', value: 15 },
          cooldown: { unit: 'min', value: 10 },
        }}
      />,
    );

    expect(screen.getByText(/15 min warm/)).toBeTruthy();
    expect(screen.getByText(/10 min cool/)).toBeTruthy();
  });

  it('renders the planned tempo hero with a today badge, session title, and formatted date', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's3',
          type: 'TEMPO',
          date: '2026-04-09',
          distance: 10,
          pace: '4:20',
          warmup: { unit: 'km', value: 2 },
          cooldown: { unit: 'km', value: 1.5 },
        }}
      />,
    );

    expect(screen.getByText('TODAY')).toBeTruthy();
    expect(screen.getByText('10km Tempo')).toBeTruthy();
    expect(screen.getByText('Thursday, Apr 9')).toBeTruthy();
  });

  it('uses a framed accent treatment and shows a planned heart-rate zone on the today card', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's3',
          type: 'TEMPO',
          date: '2026-04-09',
          distance: 10,
          pace: '4:20',
          warmup: { unit: 'km', value: 2 },
          cooldown: { unit: 'km', value: 1.5 },
        }}
      />,
    );

    expect(screen.getByText('Zone 4')).toBeTruthy();
    expect(screen.getByText('heart rate')).toBeTruthy();

    const heroCard = screen.getByTestId('hero-card');
    expect(heroCard.getAttribute('style')).toContain('border-width: 1.5px');
    expect(heroCard.getAttribute('style')).toContain('background-color: rgb(241, 232, 218)');

    const typeChip = screen.getByTestId('hero-type-chip');
    expect(typeChip.getAttribute('style')).toContain('background-color: rgb(212, 136, 42)');
  });

  it('shows completed state with actual distance and pace when activity exists', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's4',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'act-1',
        }}
        activity={{
          id: 'act-1',
          distance: 8.2,
          avgPace: 318,
          duration: 2620,
        }}
      />,
    );

    // Should show "Completed" indicator
    expect(screen.getByTestId('hero-completed')).toBeTruthy();
    // Should show actual distance
    expect(screen.getAllByText(/8\.2/).length).toBeGreaterThan(0);
    // Should show actual pace (318 sec/km = 5:18)
    expect(screen.getAllByText(/5:18/).length).toBeGreaterThan(0);
  });

  it('shows completed state when session has actualActivityId even before activity details load', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's5',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'act-1',
        }}
      />,
    );

    expect(screen.getByTestId('hero-completed')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('Run saved')).toBeTruthy();
    expect(screen.getByText('Easy Run')).toBeTruthy();
    expect(screen.getByText(/8km @ 5:20/)).toBeTruthy();
  });

  it('shows completed state from resolved activity data even before actualActivityId lands in the plan', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's5',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
        }}
        activity={{
          id: 'act-1',
          distance: 8.1,
          avgPace: 318,
          duration: 2620,
        }}
      />,
    );

    expect(screen.getByTestId('hero-completed')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getAllByText(/8\.1/).length).toBeGreaterThan(0);
  });

  it('uses a neutral matched headline when the run goes longer than planned', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's5',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'act-1',
        }}
        activity={{
          id: 'act-1',
          distance: 12.4,
          avgPace: 350,
          duration: 4340,
          avgHR: 146,
        }}
      />,
    );

    expect(screen.getByText('Longer than planned')).toBeTruthy();
    expect(screen.queryByText('Bonus effort')).toBeNull();
  });

  it('opens the Steady action when the planned hero is tapped', () => {
    const onPress = vi.fn();

    render(
      <TodayHeroCard
        session={{
          id: 's-note',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
        }}
        steadyNote="Keep this one relaxed so tomorrow still has teeth."
        onPress={onPress}
      />,
    );

    fireEvent.click(screen.getByTestId('hero-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the inline Steady note as non-interactive copy', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's-inline-note',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
        }}
        steadyNote="Keep this one relaxed so tomorrow still has teeth."
      />,
    );

    expect(screen.getByTestId('hero-steady-note').getAttribute('role')).toBeNull();
  });

  it('does not render an inline Steady note when no note is available', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's-no-note',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
        }}
      />,
    );

    expect(screen.queryByTestId('hero-steady-note')).toBeNull();
  });

  it('renders saved feel from the matched activity in completed state', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's6',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'act-2',
        }}
        activity={{
          id: 'act-2',
          distance: 8,
          avgPace: 320,
          duration: 2560,
          subjectiveInput: {
            legs: 'heavy',
            breathing: 'controlled',
            overall: 'done',
          },
        } as never}
      />,
    );

    expect(screen.getByText('Legs: Heavy')).toBeTruthy();
    expect(screen.getByText('Breathing: Controlled')).toBeTruthy();
    expect(screen.getByText('Overall: Done')).toBeTruthy();
    expect(screen.queryByTestId('subjective-input-prompt')).toBeNull();
  });

  it('renders a Review run CTA when provided', () => {
    const onReviewRun = vi.fn();

    render(
      <TodayHeroCard
        session={{
          id: 's-review',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'act-review',
        }}
        activity={{
          id: 'act-review',
          distance: 8,
          avgPace: 320,
          duration: 2560,
        }}
        onReviewRun={onReviewRun}
      />,
    );

    fireEvent.click(screen.getByTestId('hero-review-run'));
    expect(onReviewRun).toHaveBeenCalledTimes(1);
  });
});
