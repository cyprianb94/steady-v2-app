import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveTrainingPaceProfile, trainingPaceBandToIntensityTarget } from '@steady/types';
import type { SavePlanInput } from '../lib/plan-api';

const mockGetSupabaseClient = vi.hoisted(() => vi.fn());
const mockTrpcPlanGet = vi.hoisted(() => vi.fn());
const mockTrpcPlanSave = vi.hoisted(() => vi.fn());
const mockTrpcPlanUpdateWeeks = vi.hoisted(() => vi.fn());
const mockTrpcPlanGetTrainingPaceProfile = vi.hoisted(() => vi.fn());
const mockTrpcPlanUpdateTrainingPaceProfile = vi.hoisted(() => vi.fn());

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
      getTrainingPaceProfile: {
        query: mockTrpcPlanGetTrainingPaceProfile,
      },
      updateTrainingPaceProfile: {
        mutate: mockTrpcPlanUpdateTrainingPaceProfile,
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

function makeTrainingPaceProfile() {
  return deriveTrainingPaceProfile({
    raceDistance: 'Marathon',
    targetTime: 'sub-3:15',
  });
}

describe('plan api', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetSupabaseClient.mockReset();
    mockTrpcPlanGet.mockReset();
    mockTrpcPlanSave.mockReset();
    mockTrpcPlanUpdateWeeks.mockReset();
    mockTrpcPlanGetTrainingPaceProfile.mockReset();
    mockTrpcPlanUpdateTrainingPaceProfile.mockReset();
    Reflect.set(globalThis, '__DEV__', true);
  });

  it('loads the active plan directly from Supabase in dev', async () => {
    const row = makeRow();
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const limit = vi.fn(() => ({ maybeSingle }));
    const eqIsActive = vi.fn(() => ({ limit }));
    const eqUserId = vi.fn(() => ({ eq: eqIsActive }));
    const select = vi.fn(() => ({ eq: eqUserId }));

    mockGetSupabaseClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1' } } },
          error: null,
        }),
      },
      from: vi.fn(() => ({ select })),
    });

    const { getPlan } = await import('../lib/plan-api');
    const result = await getPlan();

    expect(result).toEqual(
      expect.objectContaining({
        id: 'plan-1',
        userId: 'user-1',
        trainingPaceProfile: null,
        todayAnnotation: null,
        coachAnnotation: null,
      }),
    );
    expect(eqUserId).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eqIsActive).toHaveBeenCalledWith('is_active', true);
    expect(mockTrpcPlanGet).not.toHaveBeenCalled();
  });

  it('loads a stored training pace profile directly from Supabase in dev', async () => {
    const profile = makeTrainingPaceProfile();
    const row = makeRow({ training_pace_profile: profile });
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const limit = vi.fn(() => ({ maybeSingle }));
    const eqIsActive = vi.fn(() => ({ limit }));
    const eqUserId = vi.fn(() => ({ eq: eqIsActive }));
    const select = vi.fn(() => ({ eq: eqUserId }));

    mockGetSupabaseClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'user-1' } } },
          error: null,
        }),
      },
      from: vi.fn(() => ({ select })),
    });

    const { getPlan, getTrainingPaceProfile } = await import('../lib/plan-api');

    await expect(getPlan()).resolves.toMatchObject({ trainingPaceProfile: profile });
    await expect(getTrainingPaceProfile()).resolves.toEqual(profile);
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
        training_pace_profile: null,
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

  it('serializes an edited training pace profile when saving directly to Supabase', async () => {
    const profile = makeTrainingPaceProfile();
    const insertedRow = makeRow({ training_pace_profile: profile });
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
    const result = await savePlan(makeSaveInput({ trainingPaceProfile: profile }));

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        training_pace_profile: profile,
      }),
    );
    expect(result.trainingPaceProfile).toEqual(profile);
  });

  it('preserves an existing profile when a direct Supabase save omits profile input', async () => {
    const profile = makeTrainingPaceProfile();
    const existingRow = makeRow({ training_pace_profile: profile });
    const updatedRow = makeRow({ training_pace_profile: profile });
    const maybeSingle = vi.fn().mockResolvedValue({ data: existingRow, error: null });
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

    const { savePlan } = await import('../lib/plan-api');
    const result = await savePlan(makeSaveInput({ raceName: 'Updated marathon' }));

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        race_name: 'Updated marathon',
        training_pace_profile: profile,
      }),
    );
    expect(result.trainingPaceProfile).toEqual(profile);
  });

  it('normalizes structured intensity targets before direct Supabase saves', async () => {
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

    const structuredSession = {
      id: 'session-1',
      type: 'TEMPO' as const,
      date: '2026-04-06',
      distance: 10,
      intensityTarget: {
        source: 'manual' as const,
        mode: 'both' as const,
        profileKey: 'threshold' as const,
        paceRange: { min: '4:25', max: '4:15' },
        effortCue: 'controlled hard' as const,
      },
    };

    const { savePlan } = await import('../lib/plan-api');
    await savePlan(makeSaveInput({
      templateWeek: [structuredSession, null, null, null, null, null, null],
      weeks: [{
        weekNumber: 1,
        phase: 'BASE',
        plannedKm: 10,
        sessions: [structuredSession, null, null, null, null, null, null],
      }],
    }));

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      template_week: [
        expect.objectContaining({
          pace: '4:20',
          intensityTarget: expect.objectContaining({
            paceRange: { min: '4:15', max: '4:25' },
          }),
        }),
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      weeks: [
        expect.objectContaining({
          sessions: [
            expect.objectContaining({
              pace: '4:20',
              intensityTarget: expect.objectContaining({
                paceRange: { min: '4:15', max: '4:25' },
              }),
            }),
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        }),
      ],
    }));
  });

  it('uses tRPC in release builds', async () => {
    Reflect.set(globalThis, '__DEV__', false);
    mockTrpcPlanSave.mockResolvedValue({ id: 'plan-remote' });

    const { savePlan } = await import('../lib/plan-api');
    const result = await savePlan(makeSaveInput());

    expect(mockTrpcPlanSave).toHaveBeenCalledWith(makeSaveInput());
    expect(result).toEqual({ id: 'plan-remote' });
  });

  it('updates the active training pace profile and propagates future linked sessions directly in Supabase in dev', async () => {
    const profile = makeTrainingPaceProfile();
    const updatedProfile = {
      ...profile,
      bands: {
        ...profile.bands,
        threshold: {
          ...profile.bands.threshold,
          paceRange: { min: '4:18', max: '4:28' },
        },
      },
    };
    const thresholdTarget = trainingPaceBandToIntensityTarget(profile.bands.threshold);
    const existingRow = makeRow({
      training_pace_profile: profile,
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE',
          plannedKm: 30,
          sessions: [
            {
              id: 'w1d0',
              type: 'TEMPO',
              date: '2099-01-05',
              distance: 10,
              pace: '4:28',
              intensityTarget: thresholdTarget,
            },
            {
              id: 'w1d1',
              type: 'TEMPO',
              date: '2099-01-06',
              distance: 10,
              pace: '4:08',
              intensityTarget: {
                source: 'manual',
                mode: 'pace',
                profileKey: 'threshold',
                pace: '4:08',
              },
            },
            {
              id: 'w1d2',
              type: 'TEMPO',
              date: '2099-01-07',
              distance: 10,
              pace: '4:28',
              intensityTarget: thresholdTarget,
            },
            null, null, null, null,
          ],
        },
      ],
    });
    const updatedRow = makeRow({ training_pace_profile: updatedProfile });
    const maybeSingle = vi.fn().mockResolvedValue({ data: existingRow, error: null });
    const limit = vi.fn(() => ({ maybeSingle }));
    const eqIsActive = vi.fn(() => ({ limit }));
    const eqUserId = vi.fn(() => ({ eq: eqIsActive }));
    const selectExisting = vi.fn(() => ({ eq: eqUserId }));

    const eqActivitiesUserId = vi.fn().mockResolvedValue({
      data: [{ matched_session_id: 'w1d2' }],
      error: null,
    });
    const selectActivities = vi.fn(() => ({ eq: eqActivitiesUserId }));

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
      from: vi.fn((table: string) => (
        table === 'activities'
          ? { select: selectActivities }
          : {
              select: selectExisting,
              update,
            }
      )),
    });

    const { saveTrainingPaceProfile } = await import('../lib/plan-api');
    const result = await saveTrainingPaceProfile(updatedProfile);

    expect(update).toHaveBeenCalledWith({
      training_pace_profile: updatedProfile,
      weeks: [
        expect.objectContaining({
          sessions: [
            expect.objectContaining({
              pace: '4:23',
              intensityTarget: expect.objectContaining({
                source: 'profile',
                profileKey: 'threshold',
                paceRange: { min: '4:18', max: '4:28' },
              }),
            }),
            expect.objectContaining({
              pace: '4:08',
              intensityTarget: expect.objectContaining({ source: 'manual' }),
            }),
            expect.objectContaining({
              pace: '4:28',
              intensityTarget: thresholdTarget,
            }),
            null,
            null,
            null,
            null,
          ],
        }),
      ],
    });
    expect(result).toEqual(updatedProfile);
    expect(mockTrpcPlanUpdateTrainingPaceProfile).not.toHaveBeenCalled();
  });

  it('uses tRPC for training pace profile helpers in release builds', async () => {
    Reflect.set(globalThis, '__DEV__', false);
    const profile = makeTrainingPaceProfile();
    mockTrpcPlanGetTrainingPaceProfile.mockResolvedValue(profile);
    mockTrpcPlanUpdateTrainingPaceProfile.mockResolvedValue(profile);

    const { getTrainingPaceProfile, saveTrainingPaceProfile } = await import('../lib/plan-api');

    await expect(getTrainingPaceProfile()).resolves.toEqual(profile);
    await expect(saveTrainingPaceProfile(profile)).resolves.toEqual(profile);
    expect(mockTrpcPlanGetTrainingPaceProfile).toHaveBeenCalledWith();
    expect(mockTrpcPlanUpdateTrainingPaceProfile).toHaveBeenCalledWith({
      trainingPaceProfile: profile,
    });
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

  it('normalizes structured intensity targets before direct Supabase week updates', async () => {
    const inputWeeks = [
      {
        weekNumber: 1,
        phase: 'BASE' as const,
        plannedKm: 8,
        sessions: [
          {
            id: 'session-1',
            type: 'EASY' as const,
            date: '2026-04-06',
            distance: 8,
            intensityTarget: {
              source: 'manual' as const,
              mode: 'pace' as const,
              paceRange: { min: '5:45', max: '5:15' },
            },
          },
          null, null, null, null, null, null,
        ],
      },
    ];
    const updatedRow = makeRow({ weeks: inputWeeks });
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
    await updatePlanWeeks(inputWeeks);

    expect(update).toHaveBeenCalledWith({
      weeks: [
        expect.objectContaining({
          sessions: [
            expect.objectContaining({
              pace: '5:30',
              intensityTarget: expect.objectContaining({
                paceRange: { min: '5:15', max: '5:45' },
              }),
            }),
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        }),
      ],
    });
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
