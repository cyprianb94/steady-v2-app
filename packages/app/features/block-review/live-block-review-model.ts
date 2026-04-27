import {
  buildBlockReviewModel,
  type BlockReviewModel,
  type TrainingPlan,
} from '@steady/types';

export type LiveBlockReviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; model: BlockReviewModel };

export interface DeriveLiveBlockReviewOptions {
  plan: TrainingPlan | null | undefined;
  currentWeekIndex: number;
  loading?: boolean;
  error?: string | Error | null;
}

function clampWeekIndex(currentWeekIndex: number, totalWeeks: number): number {
  if (totalWeeks <= 0) return 0;
  if (!Number.isFinite(currentWeekIndex)) return 0;
  return Math.max(0, Math.min(Math.floor(currentWeekIndex), totalWeeks - 1));
}

export function deriveLiveBlockReviewModel({
  plan,
  currentWeekIndex,
}: Pick<DeriveLiveBlockReviewOptions, 'plan' | 'currentWeekIndex'>): BlockReviewModel {
  if (!plan || plan.weeks.length === 0) {
    throw new Error('Cannot derive BlockReviewModel without a populated training plan.');
  }

  return buildBlockReviewModel({
    weeks: plan.weeks,
    phases: plan.phases,
    progressionPct: plan.progressionPct,
    currentWeekIndex: clampWeekIndex(currentWeekIndex, plan.weeks.length),
  });
}

export function deriveLiveBlockReviewState({
  loading = false,
  error = null,
  ...options
}: DeriveLiveBlockReviewOptions): LiveBlockReviewState {
  if (loading) {
    return { status: 'loading' };
  }

  if (error) {
    return {
      status: 'error',
      message: typeof error === 'string' ? error : error.message,
    };
  }

  if (!options.plan || options.plan.weeks.length === 0) {
    return { status: 'empty' };
  }

  return {
    status: 'ready',
    model: deriveLiveBlockReviewModel(options),
  };
}
