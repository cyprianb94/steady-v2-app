import { useState, useEffect, useCallback } from 'react';
import { getDisplayWeekIndex, type TrainingPlan, type PlanWeek } from '@steady/types';
import { trpc } from '../lib/trpc';
import { useAuth } from '../lib/auth';
import { getResumeWeekOverride } from '../lib/resume-week';

interface UsePlanResult {
  plan: TrainingPlan | null;
  loading: boolean;
  currentWeek: PlanWeek | null;
  currentWeekIndex: number;
  refresh: () => Promise<void>;
}

export function usePlan(): UsePlanResult {
  const { session, isLoading: authLoading } = useAuth();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [resumeWeekNumber, setResumeWeekNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

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
      console.error('Failed to fetch plan:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    fetchPlan();
  }, [authLoading, fetchPlan]);

  const today = new Date().toISOString().slice(0, 10);
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
