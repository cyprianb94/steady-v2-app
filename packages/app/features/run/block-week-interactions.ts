interface BlockWeekGuideOptions {
  injuryWeek: boolean;
  isEditableWeek: boolean;
  isRescheduleWeek: boolean;
  hasRescheduleChanges: boolean;
}

interface BlockDayInteractionOptions {
  injuryWeek: boolean;
  isEditableWeek: boolean;
  isExpanded: boolean;
  isRescheduleWeek: boolean;
  hasRescheduleChanges: boolean;
  isMoved: boolean;
  isLocked: boolean;
  canDragIndex: boolean;
  hasRunDetail: boolean;
}

export function isEditableBlockWeek(weekIndex: number, currentWeekIndex: number): boolean {
  return weekIndex >= currentWeekIndex;
}

export function getBlockWeekGuide({
  injuryWeek,
  isEditableWeek,
  isRescheduleWeek,
  hasRescheduleChanges,
}: BlockWeekGuideOptions): string | null {
  if (injuryWeek) {
    return null;
  }

  if (!isEditableWeek) {
    return 'Past weeks are locked. Tap Logged to review synced run details.';
  }

  if (hasRescheduleChanges && isRescheduleWeek) {
    return 'Tap any unchanged row to edit it. Apply the reschedule when the new order looks right.';
  }

  return 'Tap a day to adjust the session. Use the grip to reschedule it.';
}

export function resolveBlockDayInteraction({
  injuryWeek,
  isEditableWeek,
  isExpanded,
  isRescheduleWeek,
  hasRescheduleChanges,
  isMoved,
  isLocked,
  canDragIndex,
  hasRunDetail,
}: BlockDayInteractionOptions) {
  const canEditDay =
    !injuryWeek &&
    isEditableWeek &&
    !isLocked &&
    (!hasRescheduleChanges || !isMoved);
  const canDragDay =
    !injuryWeek &&
    isEditableWeek &&
    isExpanded &&
    isRescheduleWeek &&
    canDragIndex;
  const canReviewRun = isLocked && hasRunDetail;

  return {
    canEditDay,
    canDragDay,
    canReviewRun,
  };
}
