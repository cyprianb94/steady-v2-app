import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity, PlanWeek, RunFuelEvent, Shoe } from '@steady/types';
import { dayIndexForIsoDate, todayIsoLocal } from '../lib/plan-helpers';
import type { RunDetailControllerOptions } from '../features/sync/use-run-detail-controller';

const mockActivityGet = vi.hoisted(() => vi.fn());
const mockActivityList = vi.hoisted(() => vi.fn());
const mockShoeList = vi.hoisted(() => vi.fn());
const mockSaveRunDetail = vi.hoisted(() => vi.fn());
const mockRefreshActivity = vi.hoisted(() => vi.fn());

vi.mock('../lib/trpc', () => ({
  trpc: {
    activity: {
      get: {
        query: mockActivityGet,
      },
      list: {
        query: mockActivityList,
      },
      saveRunDetail: {
        mutate: mockSaveRunDetail,
      },
    },
    shoe: {
      list: {
        query: mockShoeList,
      },
    },
    strava: {
      refreshActivity: {
        mutate: mockRefreshActivity,
      },
    },
  },
}));

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  const today = todayIsoLocal();
  return {
    id: 'activity-1',
    userId: 'user-1',
    source: 'strava',
    externalId: 'ext-activity-1',
    startTime: `${today}T07:15:00.000Z`,
    distance: 8.2,
    duration: 2650,
    avgPace: 323,
    avgHR: 148,
    splits: [],
    ...overrides,
  };
}

function makeShoe(overrides: Partial<Shoe> = {}): Shoe {
  return {
    id: 'shoe-1',
    userId: 'user-1',
    brand: 'Nike',
    model: 'Pegasus 40',
    retired: false,
    totalKm: 312,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeFuelEvent(overrides: Partial<RunFuelEvent> = {}): RunFuelEvent {
  return {
    id: 'fuel-1',
    minute: 30,
    gel: {
      id: 'gel-1',
      brand: 'Precision Fuel & Hydration',
      name: 'PF 30 Gel',
      flavour: 'Original',
      caloriesKcal: 120,
      carbsG: 30,
      caffeineMg: null,
      sodiumMg: null,
      potassiumMg: null,
      magnesiumMg: null,
      imageUrl: null,
    },
    ...overrides,
  };
}

function makeCurrentWeek(sessionOverrides: Partial<NonNullable<PlanWeek['sessions'][number]>> = {}): PlanWeek {
  const today = todayIsoLocal();
  const sessions = [null, null, null, null, null, null, null] as PlanWeek['sessions'];
  sessions[dayIndexForIsoDate(today)] = {
    id: 'today-session',
    type: 'EASY',
    date: today,
    distance: 8,
    pace: '5:10',
    ...sessionOverrides,
  };

  return {
    weekNumber: 1,
    phase: 'BASE',
    plannedKm: 8,
    sessions,
  };
}

async function renderController({
  activityId = 'activity-1',
  requestedSessionId = null,
  currentWeek = makeCurrentWeek(),
  refreshPlan = vi.fn().mockResolvedValue(undefined),
  onSaved = vi.fn(),
  showAlert = vi.fn(),
}: Partial<RunDetailControllerOptions> = {}) {
  const { useRunDetailController } = await import('../features/sync/use-run-detail-controller');
  const rendered = renderHook(() => useRunDetailController({
    activityId,
    requestedSessionId,
    currentWeek,
    refreshPlan,
    onSaved,
    showAlert,
  }));

  return { ...rendered, refreshPlan, onSaved, showAlert };
}

describe('useRunDetailController', () => {
  beforeEach(() => {
    vi.resetModules();
    mockActivityGet.mockReset();
    mockActivityList.mockReset();
    mockShoeList.mockReset();
    mockSaveRunDetail.mockReset();
    mockRefreshActivity.mockReset();
    mockShoeList.mockResolvedValue([]);
    mockActivityList.mockResolvedValue([]);
    mockRefreshActivity.mockResolvedValue(makeActivity());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('loads an activity and seeds the draft from existing run-detail fields', async () => {
    const fuelEvent = makeFuelEvent();
    mockActivityGet.mockResolvedValue(makeActivity({
      matchedSessionId: 'today-session',
      shoeId: 'shoe-1',
      subjectiveInput: {
        legs: 'heavy',
        breathing: 'controlled',
        overall: 'done',
      },
      notes: 'Felt better late',
      niggles: [
        {
          id: 'niggle-1',
          userId: 'user-1',
          activityId: 'activity-1',
          bodyPart: 'calf',
          severity: 'mild',
          when: ['during'],
          side: null,
          createdAt: '2026-04-15T08:00:00.000Z',
        },
      ],
      fuelEvents: [fuelEvent],
    }));
    mockShoeList.mockResolvedValue([makeShoe()]);

    const { result } = await renderController();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.activity?.id).toBe('activity-1');
    expect(result.current.selectedSessionId).toBe('today-session');
    expect(result.current.selectedShoeId).toBe('shoe-1');
    expect(result.current.selectedShoe?.model).toBe('Pegasus 40');
    expect(result.current.legs).toBe('heavy');
    expect(result.current.breathing).toBe('controlled');
    expect(result.current.overall).toBe('done');
    expect(result.current.notes).toBe('Felt better late');
    expect(result.current.niggles).toEqual([
      { bodyPart: 'calf', bodyPartOtherText: undefined, severity: 'mild', when: ['during'], side: null },
    ]);
    expect(result.current.fuelEvents).toEqual([fuelEvent]);
  });

  it('saves the staged run detail, refreshes the plan, then calls the saved callback', async () => {
    const refreshPlan = vi.fn().mockResolvedValue(undefined);
    const onSaved = vi.fn();
    const fuelEvent = makeFuelEvent({
      gel: {
        ...makeFuelEvent().gel,
        brand: 'Maurten',
        name: 'Gel 100',
        carbsG: 25,
      },
    });
    mockActivityGet.mockResolvedValue(makeActivity());
    mockSaveRunDetail.mockResolvedValue({
      activity: makeActivity({
        subjectiveInput: {
          legs: 'fresh',
          breathing: 'easy',
          overall: 'could-go-again',
        },
      }),
      niggles: [],
    });

    const { result } = await renderController({ refreshPlan, onSaved });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.setLegs('fresh');
      result.current.setBreathing('easy');
      result.current.setOverall('could-go-again');
      result.current.setNotes('  Strong finish  ');
      result.current.setSelectedShoeId('shoe-1');
      result.current.setNiggles([
        { bodyPart: 'hamstring', severity: 'mild', when: ['during'], side: 'left' },
      ]);
      result.current.setFuelEvents([fuelEvent]);
    });

    await act(async () => {
      await result.current.saveRunDetail();
    });

    expect(mockSaveRunDetail).toHaveBeenCalledWith({
      activityId: 'activity-1',
      subjectiveInput: {
        legs: 'fresh',
        breathing: 'easy',
        overall: 'could-go-again',
      },
      niggles: [
        { bodyPart: 'hamstring', severity: 'mild', when: ['during'], side: 'left' },
      ],
      fuelEvents: [fuelEvent],
      notes: 'Strong finish',
      shoeId: 'shoe-1',
      matchedSessionId: 'today-session',
      replaceExistingMatch: false,
    });
    expect(refreshPlan).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(mockSaveRunDetail.mock.invocationCallOrder[0]).toBeLessThan(refreshPlan.mock.invocationCallOrder[0]);
    expect(refreshPlan.mock.invocationCallOrder[0]).toBeLessThan(onSaved.mock.invocationCallOrder[0]);
  });

  it('keeps the draft and reports a fuelling-specific save failure', async () => {
    const refreshPlan = vi.fn().mockResolvedValue(undefined);
    const onSaved = vi.fn();
    const showAlert = vi.fn();
    mockActivityGet.mockResolvedValue(makeActivity());
    mockSaveRunDetail.mockRejectedValue(new Error('column activities.fuel_events does not exist'));

    const { result } = await renderController({ refreshPlan, onSaved, showAlert });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      result.current.setLegs('fresh');
      result.current.setBreathing('easy');
      result.current.setOverall('could-go-again');
      result.current.setNotes('Still here');
    });

    await act(async () => {
      await result.current.saveRunDetail();
    });

    expect(result.current.saveError).toContain('Fuelling storage is not ready yet');
    expect(result.current.notes).toBe('Still here');
    expect(result.current.saving).toBe(false);
    expect(refreshPlan).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(
      'Could not save fuelling',
      'The database is missing the fuelling column. Apply the latest migration, then retry.',
    );
  });

  it('saves an explicit requested-session replacement with replacement intent', async () => {
    mockActivityGet.mockResolvedValue(makeActivity());
    mockSaveRunDetail.mockResolvedValue({
      activity: makeActivity({ matchedSessionId: 'today-session' }),
      niggles: [],
    });

    const { result } = await renderController({
      requestedSessionId: 'today-session',
      currentWeek: makeCurrentWeek({ actualActivityId: 'other-activity' }),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.selectedSessionId).toBe('today-session'));

    await act(async () => {
      result.current.setLegs('fresh');
      result.current.setBreathing('easy');
      result.current.setOverall('could-go-again');
    });

    await act(async () => {
      await result.current.saveRunDetail();
    });

    expect(mockSaveRunDetail).toHaveBeenCalledWith(expect.objectContaining({
      matchedSessionId: 'today-session',
      replaceExistingMatch: true,
    }));
  });

  it('refreshes stale Strava splits once for the loaded activity', async () => {
    mockActivityGet.mockResolvedValue(makeActivity({
      distance: 3.2,
      duration: 1120,
      avgPace: 350,
      splits: [
        { km: 1, distance: 3.2, pace: 350, hr: 144, label: '3.2 km' },
      ],
    }));
    mockRefreshActivity.mockResolvedValue(makeActivity({
      distance: 3.2,
      duration: 1120,
      avgPace: 350,
      splits: [
        { km: 1, distance: 1, pace: 345, hr: 140 },
        { km: 2, distance: 1, pace: 352, hr: 145 },
      ],
    }));

    const { result, rerender } = await renderController();

    await waitFor(() => expect(mockRefreshActivity).toHaveBeenCalledWith({ activityId: 'activity-1' }));
    await waitFor(() => expect(result.current.activity?.splits).toHaveLength(2));

    rerender();

    expect(mockRefreshActivity).toHaveBeenCalledTimes(1);
  });
});
