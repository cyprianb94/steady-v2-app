import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { deriveTrainingPaceProfile, type Activity, type PlannedSession } from '@steady/types';
import { ResolveSessionSheet } from '../components/home/ResolveSessionSheet';

const byExactTextContent = (text: string) => (_content: string, node: Element | null) => (
  node?.getAttribute('data-rn') === 'Text' && node.textContent === text
);

function intervalSession(overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'interval-1',
    type: 'INTERVAL',
    date: '2026-04-23',
    reps: 5,
    repDuration: { unit: 'min', value: 8 },
    distance: 10,
    pace: '4:10',
    recovery: '90s',
    warmup: { unit: 'km', value: 2 },
    cooldown: { unit: 'km', value: 1 },
    ...overrides,
  };
}

function stravaRun(overrides: Partial<Activity>): Activity {
  return {
    id: 'strava-1',
    userId: 'user-1',
    source: 'strava',
    externalId: 'external-1',
    startTime: '2026-04-23T18:42:00.000Z',
    distance: 9.8,
    duration: 2772,
    avgPace: 283,
    splits: [],
    ...overrides,
  };
}

describe('ResolveSessionSheet', () => {
  it('renders the no-match planned-session decision sheet', async () => {
    render(
      <ResolveSessionSheet
        open
        session={intervalSession()}
        status="missed"
        possibleMatches={[]}
        onDismiss={vi.fn()}
        onLogSession={vi.fn()}
        onMarkSkipped={vi.fn()}
        onEditSkipped={vi.fn()}
        onAttachMatch={vi.fn()}
      />,
    );

    expect(await screen.findByText('UNLOGGED')).toBeTruthy();
    expect(screen.getByText('Thu 23 Apr')).toBeTruthy();
    expect(screen.getByText('Intervals')).toBeTruthy();
    expect(screen.queryByText('Planned: 5×8min · 10km')).toBeNull();
    expect(screen.getByText('No matching activity found')).toBeTruthy();
    expect(screen.queryByText('Planned session')).toBeNull();
    expect(screen.getByText('REPETITIONS')).toBeTruthy();
    expect(screen.getByText('5×8min')).toBeTruthy();
    expect(screen.getByText('REP TARGET PACE')).toBeTruthy();
    expect(screen.getByText('4:10/km')).toBeTruthy();
    expect(screen.getByText('RECOVERY BETWEEN REPS')).toBeTruthy();
    expect(screen.getByText('WARM-UP + COOL-DOWN')).toBeTruthy();
    expect(screen.getByText('Log session')).toBeTruthy();
    expect(screen.getByText('Mark skipped')).toBeTruthy();
  });

  it('keeps the planned session area neutral while preserving session identity', async () => {
    render(
      <ResolveSessionSheet
        open
        session={intervalSession({ type: 'LONG', distance: 22, pace: '5:05' })}
        status="upcoming"
        possibleMatches={[]}
        onDismiss={vi.fn()}
        onLogSession={vi.fn()}
        onMarkSkipped={vi.fn()}
        onEditSkipped={vi.fn()}
        onAttachMatch={vi.fn()}
      />,
    );

    const plannedCard = await screen.findByTestId('planned-session-card');
    expect(plannedCard.style.backgroundColor).toBe('rgb(244, 239, 230)');
    expect(plannedCard.style.borderColor).toBe('rgb(229, 221, 208)');
    expect(screen.getByText('PLANNED')).toBeTruthy();
    expect(screen.queryByText('LONG')).toBeNull();
    expect(screen.getByText('Planned for later this week')).toBeTruthy();
    expect(screen.queryByText('Log session')).toBeNull();
    expect(screen.queryByText('Mark skipped')).toBeNull();
  });

  it('renders structured pace ranges and effort-only targets without missing-pace placeholders', async () => {
    const { rerender } = render(
      <ResolveSessionSheet
        open
        session={intervalSession({
          type: 'TEMPO',
          distance: 10,
          pace: '4:20',
          intensityTarget: {
            source: 'manual',
            mode: 'both',
            paceRange: { min: '4:15', max: '4:25' },
            effortCue: 'controlled hard',
          },
        })}
        status="missed"
        possibleMatches={[]}
        onDismiss={vi.fn()}
        onLogSession={vi.fn()}
        onMarkSkipped={vi.fn()}
        onEditSkipped={vi.fn()}
        onAttachMatch={vi.fn()}
      />,
    );

    expect(await screen.findByText('10km')).toBeTruthy();
    expect(screen.getByText('4:15-4:25/km')).toBeTruthy();
    expect(screen.getByText('controlled hard')).toBeTruthy();

    rerender(
      <ResolveSessionSheet
        open
        session={intervalSession({
          type: 'LONG',
          distance: 22,
          pace: '5:05',
          intensityTarget: {
            source: 'manual',
            mode: 'effort',
            profileKey: 'easy',
            effortCue: 'conversational',
          },
        })}
        status="missed"
        possibleMatches={[]}
        onDismiss={vi.fn()}
        onLogSession={vi.fn()}
        onMarkSkipped={vi.fn()}
        onEditSkipped={vi.fn()}
        onAttachMatch={vi.fn()}
      />,
    );

    expect(await screen.findByText('22km')).toBeTruthy();
    expect(screen.getByText('conversational')).toBeTruthy();
    expect(screen.queryByText(/—\/km/)).toBeNull();
  });

  it('renders run structure, distance, plan note, and recovery duration in planned rows', async () => {
    const { rerender } = render(
      <ResolveSessionSheet
        open
        session={intervalSession({
          type: 'LONG',
          distance: 26,
          plannedVolume: { unit: 'km', value: 26 },
          planNote: 'Keep floats honest.',
          runStructure: {
            items: [
              {
                kind: 'WARMUP',
                volume: { unit: 'km', value: 5 },
              },
              {
                kind: 'REPEAT',
                repeats: 3,
                segments: [
                  {
                    kind: 'RUN',
                    volume: { unit: 'km', value: 3 },
                    intensityTarget: {
                      source: 'manual',
                      mode: 'effort',
                      profileKey: 'marathon',
                      effortCue: 'race pace',
                    },
                  },
                  {
                    kind: 'FLOAT',
                    volume: { unit: 'km', value: 1 },
                  },
                ],
              },
              {
                kind: 'RUN',
                volume: { unit: 'km', value: 9 },
              },
            ],
          },
        })}
        status="missed"
        possibleMatches={[]}
        onDismiss={vi.fn()}
        onLogSession={vi.fn()}
        onMarkSkipped={vi.fn()}
        onEditSkipped={vi.fn()}
        onAttachMatch={vi.fn()}
      />,
    );

    expect(await screen.findByText('RUN STRUCTURE')).toBeTruthy();
    expect(screen.getAllByText(byExactTextContent('5km')).length).toBeGreaterThan(0);
    expect(screen.getByText(byExactTextContent('3 x 3km marathon pace off 1km float'))).toBeTruthy();
    expect(screen.getAllByText(byExactTextContent('9km')).length).toBeGreaterThan(0);
    expect(screen.getByText('DISTANCE')).toBeTruthy();
    expect(screen.getByText('26km')).toBeTruthy();
    expect(screen.getByText('PLAN NOTE')).toBeTruthy();
    expect(screen.getByText('Keep floats honest.')).toBeTruthy();
    expect(screen.queryByText('TARGET PACE')).toBeNull();
    expect(screen.queryByText('Plan note saved')).toBeNull();

    rerender(
      <ResolveSessionSheet
        open
        session={intervalSession({
          type: 'RECOVERY',
          plannedVolume: { unit: 'min', value: 35 },
          intensityTarget: {
            source: 'manual',
            mode: 'effort',
            profileKey: 'recovery',
            effortCue: 'very easy',
          },
        })}
        status="missed"
        possibleMatches={[]}
        onDismiss={vi.fn()}
        onLogSession={vi.fn()}
        onMarkSkipped={vi.fn()}
        onEditSkipped={vi.fn()}
        onAttachMatch={vi.fn()}
      />,
    );

    expect(await screen.findByText('DURATION')).toBeTruthy();
    expect(screen.getByText('35min')).toBeTruthy();
    expect(screen.getByText('TARGET EFFORT')).toBeTruthy();
    expect(screen.getByText('very easy')).toBeTruthy();
  });

  it('adds profile pace references to structured rows', async () => {
    const trainingPaceProfile = deriveTrainingPaceProfile({
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
    });

    render(
      <ResolveSessionSheet
        open
        trainingPaceProfile={trainingPaceProfile}
        session={intervalSession({
          type: 'LONG',
          distance: 15,
          plannedVolume: { unit: 'km', value: 15 },
          runStructure: {
            items: [
              {
                kind: 'RUN',
                volume: { unit: 'km', value: 8 },
                intensityTarget: {
                  source: 'manual',
                  mode: 'effort',
                  profileKey: 'easy',
                  effortCue: 'conversational',
                },
              },
              {
                kind: 'RUN',
                volume: { unit: 'km', value: 4 },
                intensityTarget: {
                  source: 'manual',
                  mode: 'effort',
                  profileKey: 'steady',
                  effortCue: 'steady',
                },
              },
              {
                kind: 'RUN',
                volume: { unit: 'km', value: 3 },
                intensityTarget: {
                  source: 'manual',
                  mode: 'effort',
                  profileKey: 'marathon',
                  effortCue: 'race pace',
                },
              },
            ],
          },
        })}
        status="missed"
        possibleMatches={[]}
        onDismiss={vi.fn()}
        onLogSession={vi.fn()}
        onMarkSkipped={vi.fn()}
        onEditSkipped={vi.fn()}
        onAttachMatch={vi.fn()}
      />,
    );

    expect(await screen.findByText('RUN STRUCTURE')).toBeTruthy();
    expect(screen.getByText(byExactTextContent('8km easy · 5:33-5:55/km'))).toBeTruthy();
    expect(screen.getByText(byExactTextContent('4km steady · 4:59-5:13/km'))).toBeTruthy();
    expect(screen.getByText(byExactTextContent('3km marathon pace · 4:37/km'))).toBeTruthy();
  });

  it('does not show fallback quick-interval rows for structured-only intervals', async () => {
    render(
      <ResolveSessionSheet
        open
        session={{
          id: 'fartlek',
          type: 'INTERVAL',
          date: '2026-04-23',
          runStructure: {
            items: [
              {
                kind: 'REPEAT',
                repeats: 4,
                segments: [
                  { kind: 'RUN', volume: { unit: 'sec', value: 90 } },
                  { kind: 'RECOVERY', volume: { unit: 'sec', value: 90 } },
                ],
              },
              {
                kind: 'REPEAT',
                repeats: 4,
                segments: [
                  { kind: 'RUN', volume: { unit: 'sec', value: 30 } },
                  { kind: 'RECOVERY', volume: { unit: 'sec', value: 30 } },
                ],
              },
            ],
          },
        }}
        status="missed"
        possibleMatches={[]}
        onDismiss={vi.fn()}
        onLogSession={vi.fn()}
        onMarkSkipped={vi.fn()}
        onEditSkipped={vi.fn()}
        onAttachMatch={vi.fn()}
      />,
    );

    expect(await screen.findByText('RUN STRUCTURE')).toBeTruthy();
    expect(screen.getByText(byExactTextContent('4 x 1.5min on/off'))).toBeTruthy();
    expect(screen.getByText(byExactTextContent('4 x 30s on/off'))).toBeTruthy();
    expect(screen.queryByText('REPETITIONS')).toBeNull();
    expect(screen.queryByText('REP TARGET PACE')).toBeNull();
    expect(screen.queryByText('6×800m')).toBeNull();
  });

  it('renders skipped sessions as editable and still loggable', async () => {
    const onEditSkipped = vi.fn();

    render(
      <ResolveSessionSheet
        open
        session={intervalSession({
          skipped: {
            reason: 'busy',
            markedAt: '2026-04-23T12:00:00.000Z',
          },
        })}
        status="skipped"
        possibleMatches={[]}
        onDismiss={vi.fn()}
        onLogSession={vi.fn()}
        onMarkSkipped={vi.fn()}
        onEditSkipped={onEditSkipped}
        onAttachMatch={vi.fn()}
      />,
    );

    expect(await screen.findByText('SKIPPED')).toBeTruthy();
    expect(screen.getByText('Marked skipped: Busy')).toBeTruthy();
    expect(screen.getByText('Log session instead')).toBeTruthy();

    fireEvent.click(screen.getByTestId('resolve-session-edit-skipped'));
    expect(onEditSkipped).toHaveBeenCalledTimes(1);
  });

  it('renders selectable possible matches and attaches the selected run', async () => {
    const onAttachMatch = vi.fn();
    const session = intervalSession();
    const matches = [
      stravaRun({ id: 'strava-1', distance: 9.8, duration: 2772, startTime: '2026-04-23T18:42:00.000Z' }),
      stravaRun({ id: 'strava-2', distance: 10.4, duration: 2943, startTime: '2026-04-23T07:18:00.000Z' }),
    ];

    render(
      <ResolveSessionSheet
        open
        session={session}
        status="missed"
        possibleMatches={matches}
        onDismiss={vi.fn()}
        onLogSession={vi.fn()}
        onMarkSkipped={vi.fn()}
        onEditSkipped={vi.fn()}
        onAttachMatch={onAttachMatch}
      />,
    );

    expect(await screen.findByText('Possible matches')).toBeTruthy();
    expect(screen.queryByText('Planned session')).toBeNull();
    expect(screen.getByText('REP TARGET PACE')).toBeTruthy();
    expect(screen.getAllByText('Strava run')).toHaveLength(2);
    expect(screen.getByText('9.8km · 46:12')).toBeTruthy();
    expect(screen.getByText('10.4km · 49:03')).toBeTruthy();
    expect(screen.queryByText('Use')).toBeNull();
    expect(screen.queryByText('Log manually')).toBeNull();

    fireEvent.click(screen.getByTestId('activity-match-card-strava-2'));
    fireEvent.click(screen.getByTestId('resolve-session-primary'));

    await waitFor(() => {
      expect(onAttachMatch).toHaveBeenCalledWith(session, 'strava-2');
    });
  });
});
