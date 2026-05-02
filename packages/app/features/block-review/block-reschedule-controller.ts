import {
  propagateSwap,
  type PlanWeek,
  type PropagateScope,
  type SwapLogEntry,
} from '@steady/types';
import { preserveResolvedLockedWeeks } from '../run/block-week-resolution';
import type { ActivityResolution } from '../run/activity-resolution';

export interface ApplyBlockRescheduleDraftInput {
  weeks: PlanWeek[];
  weekIndex: number | null | undefined;
  swapLog: readonly SwapLogEntry[];
  scope: PropagateScope;
  resolution: Pick<ActivityResolution, 'isSessionComplete'>;
}

export function applyBlockRescheduleDraft({
  weeks,
  weekIndex,
  swapLog,
  scope,
  resolution,
}: ApplyBlockRescheduleDraftInput): PlanWeek[] {
  if (
    weekIndex == null
    || !Number.isInteger(weekIndex)
    || weekIndex < 0
    || weekIndex >= weeks.length
    || swapLog.length === 0
  ) {
    return weeks;
  }

  const sourceWeek = weeks[weekIndex];

  return swapLog.reduce<PlanWeek[]>((currentWeeks, swap) => {
    const propagated = propagateSwap(
      currentWeeks,
      weekIndex,
      swap.from,
      swap.to,
      scope,
      sourceWeek.phase,
    );

    return preserveResolvedLockedWeeks(currentWeeks, propagated, swap, resolution);
  }, weeks);
}
