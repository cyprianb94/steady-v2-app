import { act, renderHook, waitFor } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.hoisted(() => ({
  session: { user: { id: 'user-1' } },
  isLoading: false,
}));

const mockUseIsFocused = vi.hoisted(() => vi.fn(() => false));
const mockGetPlan = vi.hoisted(() => vi.fn());

vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockUseIsFocused(),
}));

vi.mock('../lib/plan-api', () => ({
  getPlan: mockGetPlan,
}));

vi.mock('../hooks/useTodayIso', () => ({
  useTodayIso: () => '2026-04-15',
}));

function makePlan(id: string, weekNumber: number) {
  return {
    id,
    userId: 'user-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    raceName: 'Marathon 2026',
    raceDate: '2026-08-02',
    raceDistance: 'Marathon' as const,
    targetTime: 'sub-3:15',
    phases: { BASE: 1, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
    progressionPct: 0,
    templateWeek: [null, null, null, null, null, null, null],
    weeks: [
      {
        weekNumber,
        phase: 'BASE' as const,
        plannedKm: 40,
        sessions: [
          { id: `${id}-mon`, type: 'EASY' as const, date: '2026-04-13', distance: 8, pace: '5:20' },
          null,
          { id: `${id}-wed`, type: 'EASY' as const, date: '2026-04-15', distance: 8, pace: '5:20' },
          null,
          null,
          null,
          null,
        ],
      },
    ],
    activeInjury: null,
    todayAnnotation: 'Stay controlled today.',
    coachAnnotation: 'Stay controlled.',
  };
}

describe('usePlan', () => {
  beforeEach(() => {
    mockAuth.session = { user: { id: 'user-1' } };
    mockAuth.isLoading = false;
    mockUseIsFocused.mockReset();
    mockUseIsFocused.mockReturnValue(false);
    mockGetPlan.mockReset();
    vi.mocked(AsyncStorage.getItem).mockReset();
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });

  it('loads the plan once on initial focused mount', async () => {
    mockUseIsFocused.mockReturnValue(true);
    mockGetPlan.mockResolvedValue(makePlan('plan-a', 1));
    const { usePlan } = await import('../hooks/usePlan');

    const { result } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.plan?.id).toBe('plan-a'));

    expect(mockGetPlan).toHaveBeenCalledTimes(1);
    expect(result.current.currentWeek?.weekNumber).toBe(1);
  });

  it('refreshes the plan when the screen gains focus after the initial load without showing pull-to-refresh', async () => {
    let resolveRefresh: ((value: ReturnType<typeof makePlan>) => void) | null = null;
    mockGetPlan
      .mockResolvedValueOnce(makePlan('plan-a', 1))
      .mockImplementationOnce(
        () =>
          new Promise<ReturnType<typeof makePlan>>((resolve) => {
            resolveRefresh = resolve;
          }),
      );
    const { usePlan } = await import('../hooks/usePlan');

    const { result, rerender } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.plan?.id).toBe('plan-a'));
    expect(mockGetPlan).toHaveBeenCalledTimes(1);

    mockUseIsFocused.mockReturnValue(true);
    rerender();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.refreshing).toBe(false);
      expect(result.current.plan?.id).toBe('plan-a');
    });

    await act(async () => {
      if (!resolveRefresh) {
        throw new Error('Expected focus refresh promise resolver to be set');
      }

      resolveRefresh(makePlan('plan-b', 2));
    });

    await waitFor(() => expect(result.current.plan?.id).toBe('plan-b'));
    expect(mockGetPlan).toHaveBeenCalledTimes(2);
    expect(result.current.currentWeek?.weekNumber).toBe(2);
  });

  it('keeps the current plan visible while a manual refresh is in flight', async () => {
    let resolveRefresh: ((value: ReturnType<typeof makePlan>) => void) | null = null;
    mockUseIsFocused.mockReturnValue(true);
    mockGetPlan
      .mockResolvedValueOnce(makePlan('plan-a', 1))
      .mockImplementationOnce(
        () =>
          new Promise<ReturnType<typeof makePlan>>((resolve) => {
            resolveRefresh = resolve;
          }),
      );
    const { usePlan } = await import('../hooks/usePlan');

    const { result } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.plan?.id).toBe('plan-a'));

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.refreshWithIndicator();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.refreshing).toBe(true);
      expect(result.current.plan?.id).toBe('plan-a');
    });

    await act(async () => {
      if (!resolveRefresh) {
        throw new Error('Expected refresh promise resolver to be set');
      }

      resolveRefresh(makePlan('plan-b', 2));
      await refreshPromise;
    });

    await waitFor(() => {
      expect(result.current.refreshing).toBe(false);
      expect(result.current.plan?.id).toBe('plan-b');
      expect(result.current.currentWeek?.weekNumber).toBe(2);
    });
  });
});
