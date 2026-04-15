import { useState, useEffect, useCallback, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { getDisplayWeekIndex, type TrainingPlanWithAnnotation, type PlanWeek } from '@steady/types';
import { trpc } from '../lib/trpc';
import { useAuth } from '../lib/auth';
import { isLikelyNetworkError } from '../lib/network-errors';
import { getResumeWeekOverride } from '../lib/resume-week';
import { useTodayIso } from './useTodayIso';

interface UsePlanResult {
  plan: TrainingPlanWithAnnotation | null;
  loading: boolean;
  currentWeek: PlanWeek | null;
  currentWeekIndex: number;
  refresh: () => Promise<void>;
}

export function usePlan(): UsePlanResult {
  const { session, isLoading: authLoading } = useAuth();
  const isFocused = useIsFocused();
  const [plan, setPlan] = useState<TrainingPlanWithAnnotation | null>(null);
  const [resumeWeekNumber, setResumeWeekNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  const wasFocusedRef = useRef(false);

  const fetchPlan = useCallback(async () => {
    if (!session) {
      setPlan(null);
      setResumeWeekNumber(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await trpc.plan.get.query();
      setPlan(result);
      setResumeWeekNumber(result ? await getResumeWeekOverride(result.id) : null);
    } catch (err) {
      if (!isLikelyNetworkError(err)) {
        console.log('Plan bootstrap failed:', err);
      }
      setPlan(null);
      setResumeWeekNumber(null);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (authLoading) {
      hasLoadedOnceRef.current = false;
      setLoading(true);
      return;
    }
    fetchPlan()
      .finally(() => {
        hasLoadedOnceRef.current = true;
      });
  }, [authLoading, fetchPlan]);

  useEffect(() => {
    const gainedFocus = isFocused && !wasFocusedRef.current;
    wasFocusedRef.current = isFocused;

    if (!gainedFocus || authLoading || !session || !hasLoadedOnceRef.current) {
      return;
    }

    fetchPlan().catch((err) => {
      if (!isLikelyNetworkError(err)) {
        console.log('Plan refresh on focus failed:', err);
      }
    });
  }, [authLoading, fetchPlan, isFocused, session]);

  const today = useTodayIso();
  const currentWeekIndex = plan
    ? getDisplayWeekIndex(plan.weeks, today, resumeWeekNumber)
    : 0;

  return {
    plan,
    loading,
    currentWeek: plan?.weeks[currentWeekIndex] ?? null,
    currentWeekIndex,
    refresh: fetchPlan,
  };
}
