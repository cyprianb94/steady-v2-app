import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveTrainingPaceProfile } from '@steady/types';
import type { SavePlanInput } from '../lib/plan-api';

const mockTrpcPlanGet = vi.hoisted(() => vi.fn());
const mockTrpcPlanSave = vi.hoisted(() => vi.fn());
const mockTrpcPlanUpdateWeeks = vi.hoisted(() => vi.fn());
const mockTrpcPlanPropagate = vi.hoisted(() => vi.fn());
const mockTrpcPlanRescheduleBlockWeek = vi.hoisted(() => vi.fn());
const mockTrpcPlanMarkSessionSkipped = vi.hoisted(() => vi.fn());
const mockTrpcPlanClearSessionSkipped = vi.hoisted(() => vi.fn());
const mockTrpcPlanGetTrainingPaceProfile = vi.hoisted(() => vi.fn());
const mockTrpcPlanUpdateTrainingPaceProfile = vi.hoisted(() => vi.fn());
const mockIsScreenshotDemoMode = vi.hoisted(() => vi.fn());
const mockGetScreenshotDemoPlan = vi.hoisted(() => vi.fn());

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
      propagate: {
        mutate: mockTrpcPlanPropagate,
      },
      rescheduleBlockWeek: {
        mutate: mockTrpcPlanRescheduleBlockWeek,
      },
      markSessionSkipped: {
        mutate: mockTrpcPlanMarkSessionSkipped,
      },
      clearSessionSkipped: {
        mutate: mockTrpcPlanClearSessionSkipped,
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

vi.mock('../demo/screenshot-demo', () => ({
  isScreenshotDemoMode: mockIsScreenshotDemoMode,
  getScreenshotDemoPlan: mockGetScreenshotDemoPlan,
}));

function makePlan() {
  return {
    id: 'plan-1',
    userId: 'user-1',
    createdAt: '2026-04-16T10:00:00.000Z',
    raceName: 'Marathon 2026',
    raceDate: '2026-10-18',
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
    trainingPaceProfile: null,
    activeInjury: null,
    todayAnnotation: 'Keep this one easy.',
    coachAnnotation: null,
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
    mockTrpcPlanGet.mockReset();
    mockTrpcPlanSave.mockReset();
    mockTrpcPlanUpdateWeeks.mockReset();
    mockTrpcPlanPropagate.mockReset();
    mockTrpcPlanRescheduleBlockWeek.mockReset();
    mockTrpcPlanMarkSessionSkipped.mockReset();
    mockTrpcPlanClearSessionSkipped.mockReset();
    mockTrpcPlanGetTrainingPaceProfile.mockReset();
    mockTrpcPlanUpdateTrainingPaceProfile.mockReset();
    mockIsScreenshotDemoMode.mockReset();
    mockGetScreenshotDemoPlan.mockReset();
    mockIsScreenshotDemoMode.mockReturnValue(false);
  });

  it.each([true, false])(
    'routes real plan persistence through tRPC when __DEV__ is %s',
    async (isDev) => {
      Reflect.set(globalThis, '__DEV__', isDev);
      const plan = makePlan();
      const input = makeSaveInput();
      const profile = makeTrainingPaceProfile();
      mockTrpcPlanGet.mockResolvedValue(plan);
      mockTrpcPlanSave.mockResolvedValue(plan);
      mockTrpcPlanGetTrainingPaceProfile.mockResolvedValue(profile);
      mockTrpcPlanUpdateTrainingPaceProfile.mockResolvedValue(profile);
      mockTrpcPlanUpdateWeeks.mockResolvedValue(plan);
      mockTrpcPlanPropagate.mockResolvedValue(plan);
      mockTrpcPlanRescheduleBlockWeek.mockResolvedValue(plan);
      mockTrpcPlanMarkSessionSkipped.mockResolvedValue(plan);
      mockTrpcPlanClearSessionSkipped.mockResolvedValue(plan);

      const {
        getPlan,
        savePlan,
        getTrainingPaceProfile,
        saveTrainingPaceProfile,
        updatePlanWeeks,
        propagatePlanChange,
        applyBlockReschedule,
        markPlannedSessionSkipped,
        clearPlannedSessionSkipped,
      } = await import('../lib/plan-api');

      await expect(getPlan()).resolves.toEqual(plan);
      await expect(savePlan(input)).resolves.toEqual(plan);
      await expect(getTrainingPaceProfile()).resolves.toEqual(profile);
      await expect(saveTrainingPaceProfile(profile)).resolves.toEqual(profile);
      await expect(updatePlanWeeks(input.weeks)).resolves.toEqual(plan);
      await expect(propagatePlanChange({
        weekIndex: 0,
        dayIndex: 0,
        updated: null,
        scope: 'this',
        targetPhase: 'BASE',
      })).resolves.toEqual(plan);
      await expect(applyBlockReschedule({
        weekIndex: 0,
        swapLog: [{ from: 0, to: 2 }],
        scope: 'remaining',
        targetPhase: 'BASE',
        targetSessions: input.weeks[0].sessions,
      })).resolves.toEqual(plan);
      await expect(markPlannedSessionSkipped({
        sessionId: 'w1d0',
        reason: 'busy',
      })).resolves.toEqual(plan);
      await expect(clearPlannedSessionSkipped({
        sessionId: 'w1d0',
      })).resolves.toEqual(plan);

      expect(mockTrpcPlanGet).toHaveBeenCalledWith();
      expect(mockTrpcPlanSave).toHaveBeenCalledWith(input);
      expect(mockTrpcPlanGetTrainingPaceProfile).toHaveBeenCalledWith();
      expect(mockTrpcPlanUpdateTrainingPaceProfile).toHaveBeenCalledWith({
        trainingPaceProfile: profile,
      });
      expect(mockTrpcPlanUpdateWeeks).toHaveBeenCalledWith({ weeks: input.weeks });
      expect(mockTrpcPlanPropagate).toHaveBeenCalledWith({
        weekIndex: 0,
        dayIndex: 0,
        updated: null,
        scope: 'this',
        targetPhase: 'BASE',
      });
      expect(mockTrpcPlanRescheduleBlockWeek).toHaveBeenCalledWith({
        weekIndex: 0,
        swapLog: [{ from: 0, to: 2 }],
        scope: 'remaining',
        targetPhase: 'BASE',
        targetSessions: input.weeks[0].sessions,
      });
      expect(mockTrpcPlanMarkSessionSkipped).toHaveBeenCalledWith({
        sessionId: 'w1d0',
        reason: 'busy',
      });
      expect(mockTrpcPlanClearSessionSkipped).toHaveBeenCalledWith({
        sessionId: 'w1d0',
      });
    },
  );

  it('normalizes training pace profile input before saving', async () => {
    const profile = makeTrainingPaceProfile();
    const reversedEasyRange = {
      ...profile,
      bands: {
        ...profile.bands,
        easy: {
          ...profile.bands.easy,
          paceRange: { min: '5:45', max: '5:15' },
        },
      },
    };
    mockTrpcPlanUpdateTrainingPaceProfile.mockImplementation(async ({ trainingPaceProfile }) => (
      trainingPaceProfile
    ));

    const { saveTrainingPaceProfile } = await import('../lib/plan-api');
    const result = await saveTrainingPaceProfile(reversedEasyRange);

    expect(result?.bands.easy.paceRange).toEqual({ min: '5:15', max: '5:45' });
    expect(mockTrpcPlanUpdateTrainingPaceProfile).toHaveBeenCalledWith({
      trainingPaceProfile: expect.objectContaining({
        bands: expect.objectContaining({
          easy: expect.objectContaining({
            paceRange: { min: '5:15', max: '5:45' },
          }),
        }),
      }),
    });
  });

  it('bypasses tRPC only for screenshot demo mode', async () => {
    const plan = makePlan();
    mockIsScreenshotDemoMode.mockReturnValue(true);
    mockGetScreenshotDemoPlan.mockResolvedValue(plan);

    const {
      getPlan,
      savePlan,
      getTrainingPaceProfile,
      saveTrainingPaceProfile,
      updatePlanWeeks,
      propagatePlanChange,
      applyBlockReschedule,
      markPlannedSessionSkipped,
      clearPlannedSessionSkipped,
    } = await import('../lib/plan-api');

    await expect(getPlan()).resolves.toEqual(plan);
    await expect(savePlan(makeSaveInput())).resolves.toEqual(plan);
    await expect(getTrainingPaceProfile()).resolves.toBeNull();
    await expect(saveTrainingPaceProfile(null)).resolves.toBeNull();
    await expect(updatePlanWeeks(makeSaveInput().weeks)).resolves.toEqual(plan);
    await expect(propagatePlanChange({
      weekIndex: 0,
      dayIndex: 0,
      updated: null,
      scope: 'this',
    })).resolves.toEqual(plan);
    await expect(applyBlockReschedule({
      weekIndex: 0,
      swapLog: [{ from: 0, to: 1 }],
      scope: 'this',
      targetSessions: makeSaveInput().weeks[0].sessions,
    })).resolves.toEqual(plan);
    await expect(markPlannedSessionSkipped({
      sessionId: 'w1d0',
      reason: 'busy',
    })).resolves.toEqual(plan);
    await expect(clearPlannedSessionSkipped({
      sessionId: 'w1d0',
    })).resolves.toEqual(plan);

    expect(mockTrpcPlanGet).not.toHaveBeenCalled();
    expect(mockTrpcPlanSave).not.toHaveBeenCalled();
    expect(mockTrpcPlanGetTrainingPaceProfile).not.toHaveBeenCalled();
    expect(mockTrpcPlanUpdateTrainingPaceProfile).not.toHaveBeenCalled();
    expect(mockTrpcPlanUpdateWeeks).not.toHaveBeenCalled();
    expect(mockTrpcPlanPropagate).not.toHaveBeenCalled();
    expect(mockTrpcPlanRescheduleBlockWeek).not.toHaveBeenCalled();
    expect(mockTrpcPlanMarkSessionSkipped).not.toHaveBeenCalled();
    expect(mockTrpcPlanClearSessionSkipped).not.toHaveBeenCalled();
  });
});
