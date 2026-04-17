import { useState, useEffect, useCallback, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { getDisplayWeekIndex, type TrainingPlanWithAnnotation, type PlanWeek } from '@steady/types';
import { useAuth } from '../lib/auth';
import { isLikelyNetworkError } from '../lib/network-errors';
import { getPlan } from '../lib/plan-api';
import { getResumeWeekOverride } from '../lib/resume-week';
import { useTodayIso } from './useTodayIso';

interface UsePlanResult {
  plan: TrainingPlanWithAnnotation | null;
  loading: boolean;
  refreshing: boolean;
  currentWeek: PlanWeek | null;
  currentWeekIndex: number;
  refresh: () => Promise<void>;
  refreshWithIndicator: () => Promise<void>;
}

interface FetchPlanOptions {
  keepVisibleContent?: boolean;
  showRefreshIndicator?: boolean;
}

export function usePlan(): UsePlanResult {
  const { session, isLoading: authLoading } = useAuth();
  const isFocused = useIsFocused();
  const [plan, setPlan] = useState<TrainingPlanWithAnnotation | null>(null);
  const [resumeWeekNumber, setResumeWeekNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const planRef = useRef<TrainingPlanWithAnnotation | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const wasFocusedRef = useRef(false);

  const fetchPlan = useCallback(async ({
    keepVisibleContent = false,
    showRefreshIndicator = false,
  }: FetchPlanOptions = {}) => {
    if (!session) {
      setPlan(null);
      setResumeWeekNumber(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const isInPlaceRefresh = keepVisibleContent && planRef.current !== null;
    const shouldShowRefreshIndicator = isInPlaceRefresh && showRefreshIndicator;

    try {
      if (shouldShowRefreshIndicator) {
        setRefreshing(true);
      } else if (!isInPlaceRefresh) {
        setLoading(true);
      }
      const result = await getPlan();
      setPlan(result);
      setResumeWeekNumber(result ? await getResumeWeekOverride(result.id) : null);
    } catch (err) {
      if (!isLikelyNetworkError(err)) {
        console.log('Plan bootstrap failed:', err);
      }
      setPlan(null);
      setResumeWeekNumber(null);
    } finally {
      if (shouldShowRefreshIndicator) {
        setRefreshing(false);
      } else if (!isInPlaceRefresh) {
        setLoading(false);
      }
    }
  }, [session]);

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    if (authLoading) {
      hasLoadedOnceRef.current = false;
      setLoading(true);
      setRefreshing(false);
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

    fetchPlan({
      keepVisibleContent: planRef.current !== null,
      showRefreshIndicator: false,
    }).catch((err) => {
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
    refreshing,
    currentWeek: plan?.weeks[currentWeekIndex] ?? null,
    currentWeekIndex,
    refresh: () => fetchPlan({
      keepVisibleContent: planRef.current !== null,
      showRefreshIndicator: false,
    }),
    refreshWithIndicator: () => fetchPlan({
      keepVisibleContent: planRef.current !== null,
      showRefreshIndicator: true,
    }),
  };
}
