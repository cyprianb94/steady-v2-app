import { useState, useEffect, useCallback } from 'react';
import { trpc } from '../lib/trpc';
import type { TrainingPlan, PlanWeek } from '@steady/types';

interface UsePlanResult {
  plan: TrainingPlan | null;
  loading: boolean;
  currentWeek: PlanWeek | null;
  currentWeekIndex: number;
  refresh: () => Promise<void>;
}

export function usePlan(): UsePlanResult {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true);
      const result = await trpc.plan.get.query();
      setPlan(result);
    } catch (err) {
      console.error('Failed to fetch plan:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const today = new Date().toISOString().slice(0, 10);
  let currentWeekIndex = 0;

  if (plan) {
    for (let i = 0; i < plan.weeks.length; i++) {
      const sessions = plan.weeks[i].sessions.filter(Boolean);
      const dates = sessions.map((s) => s!.date);
      if (dates.some((d) => d >= today)) {
        currentWeekIndex = i;
        break;
      }
    }
  }

  return {
    plan,
    loading,
    currentWeek: plan?.weeks[currentWeekIndex] ?? null,
    currentWeekIndex,
    refresh: fetchPlan,
  };
}
