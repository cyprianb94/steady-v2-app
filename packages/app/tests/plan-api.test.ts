import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPlanGetQuery = vi.hoisted(() => vi.fn());
const mockPlanSaveMutate = vi.hoisted(() => vi.fn());
const mockGetSupabaseClient = vi.hoisted(() => vi.fn());

vi.mock('../lib/trpc', () => ({
  trpc: {
    plan: {
      get: {
        query: mockPlanGetQuery,
      },
      save: {
        mutate: mockPlanSaveMutate,
      },
    },
  },
}));

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: mockGetSupabaseClient,
}));

function makePlanRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'plan-1',
    user_id: 'user-1',
    created_at: '2026-04-01T00:00:00.000Z',
    race_name: 'Marathon 2026',
    race_date: '2026-08-02',
    race_distance: 'Marathon',
    target_time: 'sub-3:15',
    phases: { BASE: 1, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
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
    ...overrides,
  };
}

function makeMaybeSingleChain(response: { data: unknown; error: { message: string } | null }) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue(response);
  return chain;
}

function makeWriteChain(response: { data: unknown; error: { message: string } | null }) {
  const chain = {
    update: vi.fn(),
    insert: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
  };
  chain.update.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.single.mockResolvedValue(response);
  return chain;
}

describe('plan-api', () => {
  beforeEach(() => {
    vi.resetModules();
    mockPlanGetQuery.mockReset();
    mockPlanSaveMutate.mockReset();
    mockGetSupabaseClient.mockReset();
  });

  it('uses tRPC for active plan reads when the backend is reachable', async () => {
    const trpcPlan = {
      id: 'plan-trpc',
      coachAnnotation: 'Keep this one controlled.',
      weeks: [],
    };
    mockPlanGetQuery.mockResolvedValue(trpcPlan);

    const { getActivePlan } = await import('../lib/plan-api');
    const result = await getActivePlan('user-1');

    expect(result).toEqual(trpcPlan);
    expect(mockGetSupabaseClient).not.toHaveBeenCalled();
  });

  it('falls back to Supabase for active plan reads on network failure', async () => {
    mockPlanGetQuery.mockRejectedValue(new Error('Network request failed'));
    const selectChain = makeMaybeSingleChain({
      data: makePlanRow(),
      error: null,
    });
    mockGetSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(selectChain),
    });

    const { getActivePlan } = await import('../lib/plan-api');
    const result = await getActivePlan('user-1');

    expect(result?.id).toBe('plan-1');
    expect(result?.userId).toBe('user-1');
    expect(result?.coachAnnotation).toContain('Building your aerobic foundation');
  });

  it('falls back to Supabase for plan save on network failure', async () => {
    mockPlanSaveMutate.mockRejectedValue(new Error('Network request failed'));
    const existingChain = makeMaybeSingleChain({
      data: null,
      error: null,
    });
    const writeChain = makeWriteChain({
      data: makePlanRow({ id: 'plan-new' }),
      error: null,
    });
    const from = vi.fn()
      .mockReturnValueOnce(existingChain)
      .mockReturnValueOnce(writeChain);
    mockGetSupabaseClient.mockReturnValue({ from });

    const { savePlan } = await import('../lib/plan-api');
    const payload = {
      userId: 'user-1',
      raceName: 'Marathon 2026',
      raceDate: '2026-08-02',
      raceDistance: 'Marathon' as const,
      targetTime: 'sub-3:15',
      phases: { BASE: 1, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
      progressionPct: 7,
      templateWeek: [null, null, null, null, null, null, null],
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE' as const,
          plannedKm: 40,
          sessions: [null, null, null, null, null, null, null],
        },
      ],
    };

    const result = await savePlan(payload);

    expect(mockPlanSaveMutate).toHaveBeenCalledWith({
      raceName: payload.raceName,
      raceDate: payload.raceDate,
      raceDistance: payload.raceDistance,
      targetTime: payload.targetTime,
      phases: payload.phases,
      progressionPct: payload.progressionPct,
      templateWeek: payload.templateWeek,
      weeks: payload.weeks,
    });
    expect(writeChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        race_name: 'Marathon 2026',
        is_active: true,
      }),
    );
    expect(result.id).toBe('plan-new');
  });
});
