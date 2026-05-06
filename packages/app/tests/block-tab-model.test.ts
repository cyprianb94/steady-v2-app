import { describe, expect, it } from 'vitest';
import type { Activity, PlannedSession, PlanWeek, TrainingPlanWithAnnotation } from '@steady/types';
import { createActivityResolution } from '../features/run/activity-resolution';
import {
  buildBlockPhaseStripModel,
  buildBlockWeekRowModels,
  parseEditSessionResult,
} from '../features/block/block-tab-model';

function addDays(startDate: string, offset: number): string {
  const value = new Date(`${startDate}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function session(
  id: string,
  date: string,
  overrides: Partial<PlannedSession> = {},
): PlannedSession {
  const type = overrides.type ?? 'EASY';

  return {
    id,
    type,
    date,
    distance: type === 'LONG' ? 16 : 8,
    pace: '5:20',
    ...overrides,
  };
}

function week(
  weekNumber: number,
  phase: PlanWeek['phase'],
  startDate: string,
): PlanWeek {
  return {
    weekNumber,
    phase,
    plannedKm: 24,
    sessions: [
      session(`w${weekNumber}-easy`, startDate, { distance: 8 }),
      null,
      session(`w${weekNumber}-long`, addDays(startDate, 2), { type: 'LONG', distance: 16 }),
      null,
      null,
      null,
      null,
    ],
  };
}

function plan(): TrainingPlanWithAnnotation {
  const weeks = [
    week(1, 'BASE', '2026-04-06'),
    week(2, 'BUILD', '2026-04-13'),
  ];

  return {
    id: 'plan-1',
    userId: 'runner-1',
    createdAt: '2026-04-01',
    raceName: 'Spring 10K',
    raceDate: '2026-06-01',
    raceDistance: '10K',
    targetTime: 'sub-45',
    phases: { BASE: 1, BUILD: 1, RECOVERY: 0, PEAK: 0, TAPER: 0 },
    progressionPct: 0,
    templateWeek: weeks[0].sessions,
    weeks,
    activeInjury: null,
    todayAnnotation: 'Keep it easy.',
    coachAnnotation: null,
  };
}

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    userId: 'runner-1',
    source: 'strava',
    externalId: 'strava-1',
    startTime: '2026-04-06T07:00:00.000Z',
    distance: 8.4,
    duration: 2600,
    avgPace: 310,
    splits: [],
    ...overrides,
  };
}

describe('BlockTab model helpers', () => {
  it('parses valid edit-session returns and rejects malformed route params', () => {
    expect(parseEditSessionResult(JSON.stringify({
      weekIndex: 1,
      dayIndex: 2,
      updated: { type: 'EASY', distance: 10 },
    }))).toEqual({
      weekIndex: 1,
      dayIndex: 2,
      updated: { type: 'EASY', distance: 10 },
    });

    expect(parseEditSessionResult([JSON.stringify({ weekIndex: 0, dayIndex: 6, updated: null })])).toEqual({
      weekIndex: 0,
      dayIndex: 6,
      updated: null,
    });
    expect(parseEditSessionResult('not-json')).toBeNull();
    expect(parseEditSessionResult(JSON.stringify({ weekIndex: -1, dayIndex: 0 }))).toBeNull();
    expect(parseEditSessionResult(JSON.stringify({ weekIndex: 0, dayIndex: 7 }))).toBeNull();
  });

  it('derives phase strip copy without requiring the screen to know phase math', () => {
    const currentPlan = plan();
    const model = buildBlockPhaseStripModel({
      plan: currentPlan,
      safeCurrentWeekIndex: 1,
      historicalInjury: null,
      injuryRange: null,
      today: '2026-04-13',
    });

    expect(model.currentPhase).toBe('BUILD');
    expect(model.isHistoricalCurrentInjury).toBe(false);
    expect(model.caption).toBe('Build. Week 1 of 1. Peak volume approaching.');
    expect(model.phases.map((phase) => phase.name)).toEqual(['BASE', 'BUILD']);
  });

  it('derives live week rows with completed locks, actual overlays, and rest-day dragging', () => {
    const currentPlan = plan();
    const resolution = createActivityResolution([
      activity({ matchedSessionId: 'w1-easy', distance: 8.4 }),
    ], { today: '2026-04-06' });

    const rows = buildBlockWeekRowModels({
      plan: currentPlan,
      safeCurrentWeekIndex: 0,
      visibleExpandedWeekNumber: 1,
      collapsingWeekNumber: null,
      rescheduleWeekIndex: 0,
      rescheduleSessions: currentPlan.weeks[0].sessions,
      rescheduleHasChanges: false,
      rescheduleMovedDayIndexes: new Set(),
      rescheduleDragState: null,
      canDragRescheduleIndex: (index) => !resolution.isSessionComplete(currentPlan.weeks[0].sessions[index] ?? null),
      canDropRescheduleIndex: (index) => !resolution.isSessionComplete(currentPlan.weeks[0].sessions[index] ?? null),
      today: '2026-04-06',
      injuryRange: null,
      recoveryEntries: [],
      recoveryEntriesLoading: false,
      activityResolution: resolution,
      runDetailNavigation: {
        canOpenRunDetail: (plannedSession) => plannedSession?.id === 'w1-easy',
      },
      units: 'metric',
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      isCurrent: true,
      isExpanded: true,
      isRescheduleWeek: true,
      volumeSummary: {
        showActual: true,
        actualKm: 8.4,
      },
    });
    expect(rows[0].days[0]).toMatchObject({
      locked: true,
      canReviewRun: true,
      canDragDay: false,
      statusIcon: 'completed',
    });
    expect(rows[0].days[1]).toMatchObject({
      session: null,
      locked: false,
      canEditDay: true,
      canDragDay: true,
    });
  });
});
