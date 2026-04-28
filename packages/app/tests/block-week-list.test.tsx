import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PhaseName, PlannedSession, SessionType } from '@steady/types';
import { BlockWeekList, type BlockWeekListWeek } from '../components/block/BlockWeekList';

function session(type: SessionType, dayIndex: number): PlannedSession {
  const base = {
    id: `session-${dayIndex}`,
    date: `2026-05-${String(dayIndex + 4).padStart(2, '0')}`,
    type,
  };

  if (type === 'REST') {
    return base;
  }

  if (type === 'INTERVAL') {
    return {
      ...base,
      reps: 6,
      repDist: 800,
      pace: '3:50',
    };
  }

  return {
    ...base,
    distance: type === 'LONG' ? 20 : type === 'TEMPO' ? 10 : 8,
    pace: type === 'TEMPO' ? '4:20' : '5:20',
  };
}

function week(weekIndex: number, phase: PhaseName, plannedKm: number): BlockWeekListWeek {
  const pattern: SessionType[] = ['EASY', 'INTERVAL', 'EASY', 'TEMPO', 'REST', 'EASY', 'LONG'];

  return {
    id: `week-${weekIndex + 1}`,
    weekIndex,
    weekNumber: weekIndex + 1,
    phase,
    plannedKm,
    sessions: pattern.map(session),
  };
}

describe('BlockWeekList', () => {
  it('renders compact Block-style week rows and exposes week callbacks', () => {
    const weeks = [
      { ...week(0, 'BASE', 70), isPast: true },
      { ...week(1, 'BUILD', 82), isCurrent: true },
    ];
    const onWeekPress = vi.fn();
    const onToggleWeek = vi.fn();

    render(
      <BlockWeekList
        weeks={weeks}
        onWeekPress={onWeekPress}
        onToggleWeek={onToggleWeek}
      />,
    );

    expect(screen.getByTestId('block-week-list')).toBeTruthy();
    expect(screen.getByText('W1')).toBeTruthy();
    expect(screen.getByText('70km')).toBeTruthy();
    expect(screen.getByText('W2')).toBeTruthy();
    expect(screen.getByText('82km')).toBeTruthy();
    expect(screen.getAllByText('Build').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('block-week-row-press-2'));

    expect(onWeekPress).toHaveBeenCalledWith(1, weeks[1]);
    expect(onToggleWeek).toHaveBeenCalledWith(1, weeks[1]);
  });

  it('renders expanded day rows through shared label helpers and exposes day callbacks', () => {
    const weeks = [week(0, 'BUILD', 82)];
    const onDayPress = vi.fn();

    render(
      <BlockWeekList
        weeks={weeks}
        expandedWeekIndex={0}
        onDayPress={onDayPress}
      />,
    );

    expect(screen.getByTestId('block-week-expanded-1')).toBeTruthy();
    expect(screen.queryByText('Edit sessions · any change will ask where to apply')).toBeNull();
    expect(screen.getAllByText('8km easy · 5:20').length).toBeGreaterThan(0);
    expect(screen.getByText('6×800m · 3:50')).toBeTruthy();
    expect(screen.getByText('Rest day')).toBeTruthy();
    expect(screen.getByText('Recovery slot locked in for this day')).toBeTruthy();

    fireEvent.click(screen.getByTestId('block-week-day-1-1'));

    expect(onDayPress).toHaveBeenCalledWith(0, 1, weeks[0].sessions[1], weeks[0]);
  });

  it('renders structured targets in expanded rows through the shared label helper', () => {
    const baseWeek = week(0, 'BUILD', 82);
    const weeks = [{
      ...baseWeek,
      sessions: baseWeek.sessions.map((sessionValue, index) => {
        if (index === 0) {
          return {
            ...sessionValue,
            intensityTarget: {
              source: 'manual',
              mode: 'effort',
              profileKey: 'easy',
              effortCue: 'conversational',
            } as const,
          };
        }

        if (index === 3) {
          return {
            ...sessionValue,
            intensityTarget: {
              source: 'manual',
              mode: 'both',
              paceRange: { min: '4:15', max: '4:25' },
              effortCue: 'controlled hard',
            } as const,
          };
        }

        return sessionValue;
      }),
    }];

    render(
      <BlockWeekList
        weeks={weeks}
        expandedWeekIndex={0}
      />,
    );

    expect(screen.getByTestId('block-week-day-1-0').textContent).toContain('8km easy · 5:20');
    expect(screen.getByTestId('block-week-day-1-0').textContent).toContain('Easy Run · conversational');
    expect(screen.getByText('10km tempo · 4:15-4:25')).toBeTruthy();
    expect(screen.getByText('Tempo · controlled hard')).toBeTruthy();
  });

  it('lets consumers adapt labels without owning editing or propagation state', () => {
    const weeks = [week(4, 'PEAK', 92)];

    render(
      <BlockWeekList
        weeks={weeks}
        expandedWeekIndex={4}
        formatVolume={(km) => `~${km}km`}
        formatSessionMeta={(sessionValue) => (
          sessionValue?.type === 'REST' ? 'No run' : `Plan ${sessionValue?.type}`
        )}
      />,
    );

    expect(screen.getByText('~92km')).toBeTruthy();
    expect(screen.getByText('Plan INTERVAL')).toBeTruthy();
    expect(screen.getByText('No run')).toBeTruthy();
  });

  it('exposes Block-style drag handles for session rearranging, including rest days', () => {
    const weeks = [week(0, 'BUILD', 82)];
    const onMoveSession = vi.fn();
    const onDragActiveChange = vi.fn();

    render(
      <BlockWeekList
        weeks={weeks}
        expandedWeekIndex={0}
        onMoveSession={onMoveSession}
        onDragActiveChange={onDragActiveChange}
      />,
    );

    const handle = screen.getByTestId('block-week-drag-handle-1-4');

    fireEvent.mouseDown(handle, { clientY: 240 });
    fireEvent.mouseMove(handle, { clientY: 0 });
    fireEvent.mouseUp(handle, {});

    expect(onDragActiveChange).toHaveBeenCalledWith(true);
    expect(onDragActiveChange).toHaveBeenLastCalledWith(false);
    expect(onMoveSession).toHaveBeenCalledWith(0, 4, 0, weeks[0]);
  });
});
