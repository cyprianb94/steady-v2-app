import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavePlanInput } from '../lib/plan-api';

const mockGetSupabaseClient = vi.hoisted(() => vi.fn());
const mockTrpcPlanGet = vi.hoisted(() => vi.fn());
const mockTrpcPlanSave = vi.hoisted(() => vi.fn());
const mockTrpcPlanUpdateWeeks = vi.hoisted(() => vi.fn());

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: mockGetSupabaseClient,
}));

vi.mock('../lib/trpc', () => ({
  trpc: {
    plan: {
      get: {
        query: mockTrpcPlanGet,
      },
      save: {
        mutate: mockTrpcPlanSave,
      },
      updateWeeks: {
        mutate: mockTrpcPlanUpdateWeeks,
      },
    },
  },
}));

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    user_id: 'user-1',
    created_at: '2026-04-16T10:00:00.000Z',
    race_name: 'Marathon 2026',
    race_date: '2026-10-18',
    race_distance: 'Marathon',
    target_time: 'sub-3:15',
    phases: { BASE: 4, BUILD: 8, RECOVERY: 2, PEAK: 1, TAPER: 1 },
    progression_pct: 7,
    template_week: [null, null, null, null, null, null, null],
    weeks: [
      {
        weekNumber: 1,
        phase: 'BASE',
        plannedKm: 40,
        sessions: [null, null, null, null, null, null, null],
      },
    ],
    active_injury: null,
    is_active: true,
    ...overrides,
  };
}

function makeSaveInput(overrides: Partial<SavePlanInput> = {}): SavePlanInput {
  return {
    raceName: 'Marathon 2026',
    raceDate: '2026-10-18',
    raceDistance: 'Marathon',
    targetTime: 'sub-3:15',
    phases: { BASE: 1, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
    progressionPct: 7,
    templateWeek: [null, null, null, null, null, null, null],
    weeks: [
      {
        weekNumber: 1,
        phase: 'BASE',
        plannedKm: 40,
        sessions: [null, null, null, null, null, null, null],
      },
    ],
    ...overrides,
  };
}

describe('plan api', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetSupabaseClient.mockReset();
    mockTrpcPlanGet.mockReset();
    mockTrpcPlanSave.mockReset();
    mockTrpcPlanUpdateWeeks.mockReset();
    Reflect.set(globalThis, '__DEV__', true);
  });

  it('loads the active plan directly from Supabase in dev', async () => {
    const row = makeRow();
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const limit = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ eq }));

    mockGetSupabaseClient.mockReturnValue({
      from: vi.fn(() => ({ select })),
    });

    const { getPlan } = await import('../lib/plan-api');
    const result = await getPlan();

    expect(result).toEqual(
      expect.objectContaining({
        id: 'plan-1',
        userId: 'user-1',
        todayAnnotation: null,
        coachAnnotation: null,
      }),
    );
    expect(mockTrpcPlanGet).not.toHaveBeenCalled();
  });

  it('saves a new plan directly to Supabase in dev', async () => {
    const insertedRow = makeRow();
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const limit = vi.fn(() => ({ maybeSingle }));
    const eqIsActive = vi.fn(() => ({ limit }));
    const eqUserId = vi.fn(() => ({ eq: eqIsActive }));
    const selectExisting = vi.fn(() => ({ eq: eqUserId }));

    const single = vi.fn().mockResolvedValue({ data: insertedRow, error: null });
    const selectInserted = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select: selectInserted }));

    mockGetSupabaseClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1' } } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: selectExisting,
        insert,
      })),
    });

    const { savePlan } = await import('../lib/plan-api');
    const result = await savePlan(makeSaveInput());

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        race_name: 'Marathon 2026',
        is_active: true,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'plan-1',
        userId: 'user-1',
      }),
    );
    expect(mockTrpcPlanSave).not.toHaveBeenCalled();
  });

  it('uses tRPC in release builds', async () => {
    Reflect.set(globalThis, '__DEV__', false);
    mockTrpcPlanSave.mockResolvedValue({ id: 'plan-remote' });

    const { savePlan } = await import('../lib/plan-api');
    const result = await savePlan(makeSaveInput());

    expect(mockTrpcPlanSave).toHaveBeenCalledWith(makeSaveInput());
    expect(result).toEqual({ id: 'plan-remote' });
  });

  it('updates active plan weeks directly in Supabase in dev', async () => {
    const updatedRow = makeRow({
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 48,
          sessions: [null, null, null, null, null, null, null],
        },
      ],
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: makeRow(), error: null });
    const limit = vi.fn(() => ({ maybeSingle }));
    const eqIsActive = vi.fn(() => ({ limit }));
    const eqUserId = vi.fn(() => ({ eq: eqIsActive }));
    const selectExisting = vi.fn(() => ({ eq: eqUserId }));

    const single = vi.fn().mockResolvedValue({ data: updatedRow, error: null });
    const selectUpdated = vi.fn(() => ({ single }));
    const eqPlanId = vi.fn(() => ({ select: selectUpdated }));
    const update = vi.fn(() => ({ eq: eqPlanId }));

    mockGetSupabaseClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1' } } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: selectExisting,
        update,
      })),
    });

    const { updatePlanWeeks } = await import('../lib/plan-api');
    const result = await updatePlanWeeks(updatedRow.weeks as SavePlanInput['weeks']);

    expect(update).toHaveBeenCalledWith({ weeks: updatedRow.weeks });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'plan-1',
        weeks: updatedRow.weeks,
      }),
    );
    expect(mockTrpcPlanUpdateWeeks).not.toHaveBeenCalled();
  });

  it('uses tRPC for week updates in release builds', async () => {
    Reflect.set(globalThis, '__DEV__', false);
    const weeks = makeSaveInput().weeks;
    mockTrpcPlanUpdateWeeks.mockResolvedValue({ id: 'plan-remote', weeks });

    const { updatePlanWeeks } = await import('../lib/plan-api');
    const result = await updatePlanWeeks(weeks);

    expect(mockTrpcPlanUpdateWeeks).toHaveBeenCalledWith({ weeks });
    expect(result).toEqual({ id: 'plan-remote', weeks });
  });
});
