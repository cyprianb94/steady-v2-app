import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildSystemPrompt } from '../src/lib/context-builder';
import type { User, TrainingPlan, Activity, PlannedSession, PlanWeek } from '@steady/types';

// --- Fixtures ---

const USER: User = {
  id: 'u1',
  email: 'runner@test.com',
  createdAt: '2026-01-01',
  appleHealthConnected: false,
  subscriptionTier: 'pro',
  timezone: 'Europe/London',
  units: 'metric',
};

function makeSession(
  overrides: Partial<PlannedSession> & { type: PlannedSession['type'] },
): PlannedSession {
  return { id: `s-${Math.random().toString(36).slice(2, 6)}`, date: '2026-03-22', ...overrides };
}

function makeWeek(weekNumber: number, phase: PlanWeek['phase'], sessions: (PlannedSession | null)[]): PlanWeek {
  return { weekNumber, phase, sessions, plannedKm: 50 };
}

function makePlan(weeks: PlanWeek[]): TrainingPlan {
  return {
    id: 'plan-1',
    userId: 'u1',
    createdAt: '2026-01-01',
    raceName: 'London Marathon',
    raceDate: '2026-10-04',
    raceDistance: 'Marathon',
    targetTime: 'sub-3:30',
    phases: { BASE: 3, BUILD: 8, RECOVERY: 2, PEAK: 1, TAPER: 2 },
    progressionPct: 7,
    templateWeek: [],
    weeks,
    activeInjury: null,
  };
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'act-1',
    userId: 'u1',
    source: 'strava',
    externalId: 'ext-1',
    startTime: '2026-03-22T07:00:00Z',
    distance: 10.2,
    duration: 55 * 60,
    avgPace: 323,
    avgHR: 145,
    splits: [],
    ...overrides,
  };
}

const EASY_SESSION = makeSession({ type: 'EASY', distance: 10, pace: '5:20', date: '2026-03-22' });
const INTERVAL_SESSION = makeSession({ type: 'INTERVAL', reps: 6, repDist: 800, pace: '3:52', date: '2026-03-23' });
const LONG_SESSION = makeSession({ type: 'LONG', distance: 22, pace: '5:10', date: '2026-03-25' });

const CURRENT_WEEK = makeWeek(10, 'BUILD', [
  EASY_SESSION, INTERVAL_SESSION, null, makeSession({ type: 'TEMPO', distance: 12, pace: '4:20', date: '2026-03-24' }),
  null, makeSession({ type: 'EASY', distance: 8, date: '2026-03-26' }), LONG_SESSION,
]);

const NEXT_WEEK = makeWeek(11, 'BUILD', [
  makeSession({ type: 'EASY', distance: 10, date: '2026-03-29' }), null, null, null, null, null,
  makeSession({ type: 'LONG', distance: 24, date: '2026-04-04' }),
]);

const PLAN = makePlan([
  makeWeek(1, 'BASE', [null, null, null, null, null, null, null]),
  // ... intermediate weeks elided for test brevity
  CURRENT_WEEK,
  NEXT_WEEK,
]);

// Fix: stub Date so findCurrentWeek consistently picks week 10
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-22T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

// --- Tests ---

describe('buildSystemPrompt — structure', () => {
  it('contains the persona section', () => {
    const prompt = buildSystemPrompt(USER, PLAN, [], 'free_form');
    expect(prompt).toContain('You are Steady');
    expect(prompt).toContain('AI running coach');
  });

  it('contains runner context with race details', () => {
    const prompt = buildSystemPrompt(USER, PLAN, [], 'free_form');
    expect(prompt).toContain('London Marathon');
    expect(prompt).toContain('2026-10-04');
    expect(prompt).toContain('sub-3:30');
  });

  it('contains current phase and week number', () => {
    const prompt = buildSystemPrompt(USER, PLAN, [], 'free_form');
    expect(prompt).toContain('BUILD');
    expect(prompt).toContain('Week 10');
  });

  it('contains training plan section header', () => {
    const prompt = buildSystemPrompt(USER, PLAN, [], 'free_form');
    expect(prompt).toContain('TRAINING PLAN');
  });

  it('contains day names in plan', () => {
    const prompt = buildSystemPrompt(USER, PLAN, [], 'free_form');
    expect(prompt).toContain('Mon:');
    expect(prompt).toContain('Sun:');
  });

  it('formats EASY sessions with distance and pace', () => {
    const prompt = buildSystemPrompt(USER, PLAN, [], 'free_form');
    expect(prompt).toContain('EASY 10km @ 5:20');
  });

  it('formats INTERVAL sessions with reps and distance', () => {
    const prompt = buildSystemPrompt(USER, PLAN, [], 'free_form');
    expect(prompt).toContain('INTERVAL 6×800m @ 3:52');
  });

  it('shows REST for null sessions', () => {
    const prompt = buildSystemPrompt(USER, PLAN, [], 'free_form');
    expect(prompt).toContain('REST');
  });

  it('describes session rearrangements from swap logs', () => {
    const rearrangedWeek = makeWeek(10, 'BUILD', [
      EASY_SESSION,
      makeSession({ type: 'EASY', distance: 8, date: '2026-03-26' }),
      null,
      makeSession({ type: 'TEMPO', distance: 12, pace: '4:20', date: '2026-03-24' }),
      null,
      INTERVAL_SESSION,
      LONG_SESSION,
    ]);
    rearrangedWeek.swapLog = [{ from: 1, to: 5 }];
    const prompt = buildSystemPrompt(USER, makePlan([rearrangedWeek, NEXT_WEEK]), [], 'free_form');

    expect(prompt).toContain('SESSION REARRANGEMENTS:');
    expect(prompt).toContain('Week 10: Intervals moved Tue→Sat, Easy moved Sat→Tue');
    expect(prompt).not.toContain('Week 11: Long moved');
  });
});

describe('buildSystemPrompt — activity log', () => {
  it('shows "None" when no activities', () => {
    const prompt = buildSystemPrompt(USER, PLAN, [], 'free_form');
    expect(prompt).toContain('RECENT ACTIVITY: None');
  });

  it('includes activity details with distance, duration, pace', () => {
    const activity = makeActivity();
    const prompt = buildSystemPrompt(USER, PLAN, [activity], 'free_form');
    expect(prompt).toContain('10.2km');
    expect(prompt).toContain('55m');
    expect(prompt).toContain('HR 145');
  });

  it('annotates plan with matched activity data', () => {
    const activity = makeActivity({ matchedSessionId: EASY_SESSION.id });
    const prompt = buildSystemPrompt(USER, PLAN, [activity], 'free_form');
    expect(prompt).toContain('✓');
    expect(prompt).toContain('actual:');
  });

  it('includes matched activity feedback when present', () => {
    const plan = makePlan([
      makeWeek(10, 'BUILD', [EASY_SESSION, null, null, null, null, null, null]),
    ]);
    const activity = makeActivity({
      matchedSessionId: EASY_SESSION.id,
      subjectiveInput: {
        legs: 'heavy',
        breathing: 'controlled',
        overall: 'done',
      },
    });

    const prompt = buildSystemPrompt(USER, plan, [activity], 'free_form');

    expect(prompt).toContain('felt: legs heavy, breathing controlled, overall done');
  });
});

describe('buildSystemPrompt — conversation types', () => {
  it('adds JUST COMPLETED section for post_run_debrief', () => {
    const activity = makeActivity({ distance: 10.5 });
    const prompt = buildSystemPrompt(USER, PLAN, [activity], 'post_run_debrief', {
      session: EASY_SESSION,
      activity,
    });
    expect(prompt).toContain('JUST COMPLETED');
    expect(prompt).toContain('EASY');
    expect(prompt).toContain('10.5km');
    expect(prompt).toContain('deviation');
  });

  it('adds weekly preview framing', () => {
    const prompt = buildSystemPrompt(USER, PLAN, [], 'weekly_preview');
    expect(prompt).toContain('Weekly preview');
    expect(prompt).toContain('upcoming training week');
  });

  it('adds missed session framing', () => {
    const prompt = buildSystemPrompt(USER, PLAN, [], 'missed_session');
    expect(prompt).toContain('Missed session');
  });

  it('adds free-form framing', () => {
    const prompt = buildSystemPrompt(USER, PLAN, [], 'free_form');
    expect(prompt).toContain('Free-form');
  });
});

describe('buildSystemPrompt — token budget', () => {
  it('stays within approximate token budget (under 6000 tokens ≈ 24000 chars)', () => {
    // Build a large plan with many activities
    const weeks: PlanWeek[] = Array.from({ length: 16 }, (_, i) =>
      makeWeek(i + 1, 'BUILD', [
        makeSession({ type: 'EASY', distance: 8, date: `2026-03-${String(i + 1).padStart(2, '0')}` }),
        makeSession({ type: 'INTERVAL', reps: 6, repDist: 800, date: `2026-03-${String(i + 2).padStart(2, '0')}` }),
        null,
        makeSession({ type: 'TEMPO', distance: 10, date: `2026-03-${String(i + 4).padStart(2, '0')}` }),
        null,
        makeSession({ type: 'EASY', distance: 6, date: `2026-03-${String(i + 6).padStart(2, '0')}` }),
        makeSession({ type: 'LONG', distance: 20, date: `2026-03-${String(i + 7).padStart(2, '0')}` }),
      ]),
    );

    const activities = Array.from({ length: 30 }, (_, i) =>
      makeActivity({
        id: `act-${i}`,
        startTime: `2026-03-${String(i + 1).padStart(2, '0')}T07:00:00Z`,
        distance: 8 + Math.random() * 5,
      }),
    );

    const bigPlan = makePlan(weeks);
    const prompt = buildSystemPrompt(USER, bigPlan, activities, 'free_form');

    // Rough token estimate: chars / 4
    const estimatedTokens = prompt.length / 4;
    expect(estimatedTokens).toBeLessThan(6000);
  });
});
