import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../lib/trpc', () => ({ trpc: {} }));

import { TodayHeroCard } from '../components/home/TodayHeroCard';
import { C } from '../constants/colours';

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
    expect(screen.getByText('5:20/km')).toBeTruthy();
  });

  it('shows structured target ranges and effort cues on the planned hero', () => {
    render(
      <TodayHeroCard
        session={{
          id: 'tempo-target',
          type: 'TEMPO',
          date: '2026-04-09',
          distance: 10,
          pace: '4:20',
          intensityTarget: {
            source: 'manual',
            mode: 'both',
            paceRange: { min: '4:15', max: '4:25' },
            effortCue: 'controlled hard',
          },
        }}
      />,
    );

    expect(screen.getByText('4:15-4:25/km')).toBeTruthy();
    expect(screen.getByText('controlled hard')).toBeTruthy();
    expect(screen.queryByText('4:20')).toBeNull();
  });

  it('shows easy effort and pace in one target area without planned heart rate', () => {
    render(
      <TodayHeroCard
        session={{
          id: 'easy-target',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:45',
          intensityTarget: {
            source: 'manual',
            mode: 'both',
            profileKey: 'easy',
            paceRange: { min: '5:33', max: '6:06' },
            effortCue: 'conversational',
          },
        }}
      />,
    );

    expect(screen.getByText('Target')).toBeTruthy();
    expect(screen.getByText('conversational')).toBeTruthy();
    expect(screen.getByText('5:33-6:06/km')).toBeTruthy();
    expect(screen.queryByText(/Zone/)).toBeNull();
    expect(screen.queryByText(/heart rate/i)).toBeNull();
  });

  it('shows effort-only targets without a pace placeholder on the planned hero', () => {
    render(
      <TodayHeroCard
        session={{
          id: 'easy-effort',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:45',
          intensityTarget: {
            source: 'manual',
            mode: 'effort',
            profileKey: 'easy',
            effortCue: 'conversational',
          },
        }}
      />,
    );

    expect(screen.getByText('conversational')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('shows pace-only targets without an effort placeholder on the planned hero', () => {
    render(
      <TodayHeroCard
        session={{
          id: 'tempo-pace-only',
          type: 'TEMPO',
          date: '2026-04-09',
          distance: 10,
          pace: '4:20',
          intensityTarget: {
            source: 'manual',
            mode: 'pace',
            profileKey: 'threshold',
            paceRange: { min: '4:21', max: '4:35' },
          },
        }}
      />,
    );

    expect(screen.getByText('4:21-4:35/km')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.queryByText(/target effort/i)).toBeNull();
  });

  it.each([
    { type: 'EASY' as const, title: '8km Easy Run', distance: 8, pace: '5:20' },
    { type: 'LONG' as const, title: '16km Long Run', distance: 16, pace: '5:10' },
  ])('does not show warmup or cooldown extras for $type runs', ({ type, title, distance, pace }) => {
    render(
      <TodayHeroCard
        session={{
          id: 'legacy-bookends',
          type,
          date: '2026-04-09',
          distance,
          pace,
          warmup: { unit: 'km', value: 1.5 },
          cooldown: { unit: 'km', value: 1 },
        }}
      />,
    );

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.queryByText(/warm/)).toBeNull();
    expect(screen.queryByText(/cool/)).toBeNull();
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
    expect(screen.getByText('3:50/km')).toBeTruthy();
    expect(screen.getByText(/1.5km warm/)).toBeTruthy();
    expect(screen.getByText(/1km cool/)).toBeTruthy();
  });

  it('renders the planned interval rep target and recovery detail line', () => {
    render(
      <TodayHeroCard
        session={{
          id: 'interval-detail',
          type: 'INTERVAL',
          date: '2026-04-09',
          reps: 6,
          repDist: 800,
          pace: '3:50',
          intensityTarget: {
            source: 'manual',
            mode: 'both',
            profileKey: 'interval',
            paceRange: { min: '3:47', max: '4:10' },
            effortCue: 'hard repeatable',
          },
          recovery: '90s',
          warmup: { unit: 'km', value: 1.5 },
          cooldown: { unit: 'km', value: 1 },
        }}
      />,
    );

    expect(screen.getByText('Rep target')).toBeTruthy();
    expect(screen.getByText('3:47-4:10/km')).toBeTruthy();
    expect(screen.getByText('hard repeatable')).toBeTruthy();
    expect(screen.getByText('90s recoveries · 1.5km warm · 1km cool')).toBeTruthy();
  });

  it('shows a positive rest acknowledgment for a rest day', () => {
    render(<TodayHeroCard session={null} />);

    expect(screen.getByText(/rest day/i)).toBeTruthy();
    // Should NOT be empty or gray — should have positive messaging
    expect(screen.queryByText(/no session/i)).toBeNull();
  });

  it('renders a rest day with a Rest chip, Today label, and no finished-run CTA', () => {
    render(
      <TodayHeroCard
        session={{
          id: 'rest-today',
          type: 'REST',
          date: '2026-04-09',
        }}
      />,
    );

    expect(screen.getByText('REST')).toBeTruthy();
    expect(screen.getByText('TODAY')).toBeTruthy();
    expect(screen.getByText('Rest day')).toBeTruthy();
    expect(screen.getByText('No planned run today.')).toBeTruthy();
    expect(screen.queryByText('I finished this run')).toBeNull();
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

  it('renders the planned tempo target and warm/cool detail line', () => {
    render(
      <TodayHeroCard
        session={{
          id: 'tempo-detail',
          type: 'TEMPO',
          date: '2026-04-09',
          distance: 10,
          pace: '4:20',
          intensityTarget: {
            source: 'manual',
            mode: 'both',
            profileKey: 'threshold',
            paceRange: { min: '4:21', max: '4:35' },
            effortCue: 'controlled hard',
          },
          warmup: { unit: 'km', value: 2 },
          cooldown: { unit: 'km', value: 1.5 },
        }}
      />,
    );

    expect(screen.getByText('Tempo target')).toBeTruthy();
    expect(screen.getByText('4:21-4:35/km')).toBeTruthy();
    expect(screen.getByText('controlled hard')).toBeTruthy();
    expect(screen.getByText('10km total · 2km warm · 1.5km cool')).toBeTruthy();
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

  it('renders the finished-run CTA inside runnable planned cards', () => {
    const onLogRun = vi.fn();

    render(
      <TodayHeroCard
        session={{
          id: 's-runnable',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
        }}
        onLogRun={onLogRun}
      />,
    );

    fireEvent.click(screen.getByText('✓ I finished this run'));
    expect(onLogRun).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Looks for a recent Strava activity.')).toBeTruthy();
  });

  it('uses a framed neutral target treatment and removes planned heart rate from the today card', () => {
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

    expect(screen.getByText('Tempo target')).toBeTruthy();
    expect(screen.queryByText('Zone 4')).toBeNull();
    expect(screen.queryByText('heart rate')).toBeNull();

    const heroCard = screen.getByTestId('hero-card');
    expect(heroCard.getAttribute('style')).toContain('border-width: 1.5px');
    expect(heroCard.getAttribute('style')).toContain('background-color: rgb(253, 250, 245)');

    const typeChip = screen.getByTestId('hero-type-chip');
    expect(typeChip.getAttribute('style')).toContain('background-color: rgb(212, 136, 42)');
  });

  it.each([
    [
      'EASY',
      `${C.forest}0C|${C.forest}07|${C.forest}02|${C.forest}00`,
    ],
    [
      'INTERVAL',
      `${C.clay}0C|${C.clay}07|${C.clay}02|${C.clay}00`,
    ],
    [
      'TEMPO',
      `${C.amber}0C|${C.amber}07|${C.amber}02|${C.amber}00`,
    ],
    [
      'LONG',
      `${C.navy}0C|${C.navy}07|${C.navy}02|${C.navy}00`,
    ],
  ] as const)('uses the %s session atmosphere on planned cards', (
    type,
    expectedGradient,
  ) => {
    render(
      <TodayHeroCard
        session={{
          id: `s-${type.toLowerCase()}`,
          type,
          date: '2026-04-09',
          distance: 8,
          pace: type === 'INTERVAL' ? '3:50' : '5:20',
          reps: type === 'INTERVAL' ? 6 : undefined,
          repDist: type === 'INTERVAL' ? 400 : undefined,
          recovery: type === 'INTERVAL' ? '90s' : undefined,
        }}
      />,
    );

    expect(screen.getByTestId('hero-card').getAttribute('style')).toContain(
      'background-color: rgb(253, 250, 245)',
    );
    expect(screen.getByTestId('hero-card-atmosphere').getAttribute('data-colors')).toBe(
      expectedGradient,
    );
    expect(screen.getByTestId('hero-card-atmosphere').getAttribute('data-locations')).toBe(
      '0|0.34|0.68|1',
    );
    expect(screen.getByTestId('hero-card-atmosphere').getAttribute('data-start')).toBe('0|0.5');
    expect(screen.getByTestId('hero-card-atmosphere').getAttribute('data-end')).toBe('1|0.5');
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

  it('renders logged easy runs with session chip, completed status, and a slim evidence list', () => {
    render(
      <TodayHeroCard
        session={{
          id: 'easy-logged',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'act-logged',
        }}
        activity={{
          id: 'act-logged',
          distance: 8.1,
          avgPace: 348,
          duration: 2820,
          subjectiveInput: {
            legs: 'normal',
            breathing: 'controlled',
            overall: 'done',
          },
        }}
      />,
    );

    expect(screen.getByTestId('hero-completed-session-chip').textContent).toBe('EASY');
    expect(screen.getByTestId('hero-completed-status-chip').textContent).toBe('COMPLETED');
    expect(screen.getByText('Distance')).toBeTruthy();
    expect(screen.getByText('8.1km / 8km')).toBeTruthy();
    expect(screen.getByText('Pace')).toBeTruthy();
    expect(screen.getAllByText('5:48/km').length).toBeGreaterThan(0);
    expect(screen.getByText('Feel')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.queryByText(/bpm/i)).toBeNull();
  });

  it('renders logged structured tempo runs with a needs-review quality entry point', () => {
    render(
      <TodayHeroCard
        session={{
          id: 'tempo-logged',
          type: 'TEMPO',
          date: '2026-04-09',
          distance: 5,
          pace: '4:30',
          intensityTarget: {
            source: 'manual',
            mode: 'pace',
            profileKey: 'threshold',
            paceRange: { min: '4:21', max: '4:35' },
          },
          warmup: { unit: 'km', value: 1 },
          cooldown: { unit: 'km', value: 1 },
          actualActivityId: 'tempo-act',
        }}
        activity={{
          id: 'tempo-act',
          distance: 7,
          avgPace: 292,
          duration: 2044,
          splits: [
            { km: 1, distance: 1, pace: 330 },
            { km: 2, distance: 1, pace: 280 },
            { km: 3, distance: 1, pace: 281 },
            { km: 4, distance: 1, pace: 282 },
            { km: 5, distance: 1, pace: 279 },
            { km: 6, distance: 1, pace: 278 },
            { km: 7, distance: 1, pace: 330 },
          ],
        }}
        onReviewRun={vi.fn()}
      />,
    );

    expect(screen.getByTestId('hero-completed-session-chip').textContent).toBe('TEMPO');
    expect(screen.getByTestId('hero-completed-status-chip').textContent).toBe('NEEDS REVIEW');
    expect(screen.getByText('Quality pace')).toBeTruthy();
    expect(screen.getAllByText('4:40/km').length).toBeGreaterThan(0);
    expect(screen.getByText('Tempo time')).toBeTruthy();
    expect(screen.getByText('Review quality work')).toBeTruthy();
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
    expect(screen.getByTestId('hero-completed-status-chip').textContent).toBe('COMPLETED');
    expect(screen.getByText('Run saved')).toBeTruthy();
    expect(screen.getByText('Planned')).toBeTruthy();
    expect(screen.getAllByText(/8km easy · 5:20/).length).toBeGreaterThan(0);
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
    expect(screen.getByTestId('hero-completed-status-chip').textContent).toBe('COMPLETED');
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

  it('summarises a completed range-target run as on target when pace is inside the band', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's-range',
          type: 'TEMPO',
          date: '2026-04-09',
          distance: 10,
          pace: '4:05',
          intensityTarget: {
            source: 'manual',
            mode: 'both',
            profileKey: 'threshold',
            paceRange: { min: '4:00', max: '4:10' },
            effortCue: 'controlled hard',
          },
          actualActivityId: 'act-range',
        }}
        activity={{
          id: 'act-range',
          distance: 10,
          avgPace: 245,
          duration: 2450,
          avgHR: 164,
        }}
      />,
    );

    expect(screen.getByText('On target')).toBeTruthy();
    expect(screen.getByText(/Pace inside target range/)).toBeTruthy();
  });

  it('does not call an easy effort-led run off target just because GPS pace was slower', () => {
    render(
      <TodayHeroCard
        session={{
          id: 's-effort',
          type: 'EASY',
          date: '2026-04-09',
          distance: 8,
          pace: '5:45',
          intensityTarget: {
            source: 'profile',
            mode: 'both',
            profileKey: 'recovery',
            paceRange: { min: '5:30', max: '6:00' },
            effortCue: 'very easy',
          },
          actualActivityId: 'act-effort',
        }}
        activity={{
          id: 'act-effort',
          distance: 8,
          avgPace: 375,
          duration: 3000,
          avgHR: 136,
        }}
      />,
    );

    expect(screen.getByText('On target')).toBeTruthy();
    expect(screen.queryByText('Eased off')).toBeNull();
    expect(screen.queryByText('Went out hot')).toBeNull();
  });

  it('opens the card action when the planned hero is tapped', () => {
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
        onPress={onPress}
      />,
    );

    fireEvent.click(screen.getByTestId('hero-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
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

    expect(screen.getByText('Feel')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.queryByText('Legs: Heavy')).toBeNull();
    expect(screen.queryByText('Breathing: Controlled')).toBeNull();
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
