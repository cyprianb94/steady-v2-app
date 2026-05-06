import {
  buildSessionEditDescription,
  hasMaterialSessionEdit,
  materializeEditedSession,
  resolveProfileLinkedWeekTargets,
  type SessionEditorResult,
} from '../plan-builder/session-editing';
import type { WeekRescheduleDragState } from '../plan-builder/use-direct-week-reschedule';
import {
  buildResolvedBlockWeekDayDetails,
  getResolvedWeekVolumeSummary,
} from '../run/block-week-resolution';
import {
  getBlockWeekGuide,
  isEditableBlockWeek,
  resolveBlockDayInteraction,
} from '../run/block-week-interactions';
import { buildDisplayWeek } from '../run/display-week';
import type { ActivityResolution } from '../run/activity-resolution';
import { formatSessionRowText } from '../../lib/session-row-text';
import { createId } from '../../lib/id';
import {
  addDaysIso,
  inferWeekStartDate,
  todayIsoLocal,
  weekKm,
} from '../../lib/plan-helpers';
import {
  formatRaceDateLabel,
  formatShortMonthDayLabel,
} from '../../lib/date-labels';
import { firstRouteParamValue } from '../../lib/route-params';
import { formatDistance } from '../../lib/units';
import {
  buildBlockPhaseSegments,
  getBlockVolumeTone,
  getInjuryWeekRange,
  isInjuryWeek,
  weekKmBreakdown,
  type BlockPhaseSegment,
  type BlockVolumeTone,
  type CrossTrainingEntry,
  type Injury,
  type PlannedSession,
  type PlanWeek,
  type SwapLogEntry,
  type TrainingPlan,
  type TrainingPlanWithAnnotation,
  type WeekVolumeSummary,
} from '@steady/types';

const COMPACT_PHASE_LABEL: Record<BlockPhaseSegment['name'], string> = {
  BASE: 'B',
  BUILD: 'BLD',
  RECOVERY: 'REC',
  PEAK: 'PK',
  TAPER: 'TP',
  INJURY: 'INJ',
};

export const EMPTY_WEEK_SESSIONS: (PlannedSession | null)[] = [null, null, null, null, null, null, null];

const RESCHEDULE_REVEAL_BOTTOM_INSET = 118;
const RESCHEDULE_REVEAL_EXTRA_GAP = 14;

type BlockResolution = Pick<
  ActivityResolution,
  'completionStatusForSession' | 'isSessionComplete' | 'weekActualKm'
>;

interface RunDetailAvailability {
  canOpenRunDetail: (session: PlannedSession | null) => boolean;
}

export type InjuryWeekRange = ReturnType<typeof getInjuryWeekRange>;

export type RescheduleRevealMetrics = {
  currentY: number;
  viewportHeight: number;
  rowY: number;
  rowHeight: number;
  bottomInset?: number;
  extraGap?: number;
};

export interface PreservedRescheduleDraft {
  weekNumber: number;
  swapLog: SwapLogEntry[];
}

export interface PendingEdit {
  weekIndex: number;
  dayIndex: number;
  updated: SessionEditorResult;
  desc: string;
  nonce?: string;
}

export type ParsedEditSessionResult = Omit<PendingEdit, 'desc'>;

export interface BlockPhaseStripModel {
  phases: BlockPhaseSegment[];
  currentPhase: PlanWeek['phase'] | 'INJURY';
  isHistoricalCurrentInjury: boolean;
  caption: string;
}

export interface BlockWeekRowDayModel {
  detail: ReturnType<typeof buildResolvedBlockWeekDayDetails>[number];
  dayIndex: number;
  statusIcon: 'completed' | 'missed' | null;
  session: PlannedSession | null;
  locked: boolean;
  moved: boolean;
  dragging: boolean;
  dropTarget: boolean;
  invalidDropTarget: boolean;
  canEditDay: boolean;
  canDragDay: boolean;
  canReviewRun: boolean;
  sessionRowText: ReturnType<typeof formatSessionRowText>;
}

export interface BlockWeekRowModel {
  week: PlanWeek;
  index: number;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  isEditableWeek: boolean;
  injuryWeek: boolean;
  isExpanded: boolean;
  isCollapsing: boolean;
  shouldRenderExpandedWeek: boolean;
  isRescheduleWeek: boolean;
  shouldUseRescheduleDraft: boolean;
  displayWeek: PlanWeek;
  weekEntries: CrossTrainingEntry[];
  recoveryEntriesLoading: boolean;
  volumeTone: BlockVolumeTone;
  volumeSummary: WeekVolumeSummary;
  plannedVolumeLabel: string;
  weekGuide: string | null;
  days: BlockWeekRowDayModel[];
}

export interface BlockWeekRowsInput {
  plan: TrainingPlan;
  safeCurrentWeekIndex: number;
  visibleExpandedWeekNumber: number | null;
  collapsingWeekNumber: number | null;
  rescheduleWeekIndex: number | null;
  rescheduleSessions: (PlannedSession | null)[];
  rescheduleHasChanges: boolean;
  rescheduleMovedDayIndexes: ReadonlySet<number>;
  rescheduleDragState: WeekRescheduleDragState | null;
  canDragRescheduleIndex: (index: number) => boolean;
  canDropRescheduleIndex: (index: number) => boolean;
  today: string;
  injuryRange: InjuryWeekRange;
  recoveryEntries: CrossTrainingEntry[];
  recoveryEntriesLoading: boolean;
  activityResolution: BlockResolution;
  runDetailNavigation: RunDetailAvailability;
  units: 'metric' | 'imperial';
}

export function getRescheduleRevealScrollTarget({
  currentY,
  viewportHeight,
  rowY,
  rowHeight,
  bottomInset = RESCHEDULE_REVEAL_BOTTOM_INSET,
  extraGap = RESCHEDULE_REVEAL_EXTRA_GAP,
}: RescheduleRevealMetrics): number | null {
  if (viewportHeight <= 0 || rowHeight <= 0) {
    return null;
  }

  const targetBottom = rowY + rowHeight + extraGap;
  const visibleBottom = currentY + viewportHeight - bottomInset;

  if (targetBottom <= visibleBottom) {
    return null;
  }

  return Math.max(0, targetBottom - viewportHeight + bottomInset);
}

export function formatRaceDate(date: string | null | undefined): string {
  return formatRaceDateLabel(date);
}

export function getWeekStartDate(week: PlanWeek): string {
  const fallbackDate =
    week.sessions.find((session) => session?.date)?.date ??
    todayIsoLocal();
  return inferWeekStartDate(week, fallbackDate);
}

export function getWeekEntries(entries: CrossTrainingEntry[], week: PlanWeek): CrossTrainingEntry[] {
  const startDate = getWeekStartDate(week);
  const endDate = addDaysIso(startDate, 6);
  return entries.filter((entry) => entry.date >= startDate && entry.date <= endDate);
}

export function formatPhaseName(phase: PlanWeek['phase'] | 'INJURY'): string {
  return phase === 'INJURY'
    ? 'Injury'
    : `${phase.slice(0, 1)}${phase.slice(1).toLowerCase()}`;
}

function getPhaseOutlook(phase: PlanWeek['phase'] | 'INJURY'): string {
  switch (phase) {
    case 'BASE':
      return 'Aerobic foundation building steadily.';
    case 'BUILD':
      return 'Peak volume approaching.';
    case 'RECOVERY':
      return 'Absorb the work and keep it light.';
    case 'PEAK':
      return 'Race-specific sharpness is coming together.';
    case 'TAPER':
      return 'Freshening up for race day.';
    case 'INJURY':
      return 'Modified training is in progress.';
    default:
      return '';
  }
}

function getPhaseProgress(
  weeks: PlanWeek[],
  currentWeekIndex: number,
  currentPhase: PlanWeek['phase'] | 'INJURY',
  injuryRange: InjuryWeekRange,
): { weekInPhase: number; totalWeeksInPhase: number } {
  if (currentPhase === 'INJURY' && injuryRange) {
    return {
      weekInPhase: currentWeekIndex - injuryRange.startIndex + 1,
      totalWeeksInPhase: injuryRange.endIndex - injuryRange.startIndex + 1,
    };
  }

  let start = currentWeekIndex;
  let end = currentWeekIndex;

  while (start > 0 && weeks[start - 1]?.phase === currentPhase) {
    start -= 1;
  }

  while (end < weeks.length - 1 && weeks[end + 1]?.phase === currentPhase) {
    end += 1;
  }

  return {
    weekInPhase: currentWeekIndex - start + 1,
    totalWeeksInPhase: end - start + 1,
  };
}

export function getPhaseCaption(
  weeks: PlanWeek[],
  currentWeekIndex: number,
  currentPhase: PlanWeek['phase'] | 'INJURY',
  injuryRange: InjuryWeekRange,
  injury: Injury | null | undefined,
): string {
  const { weekInPhase, totalWeeksInPhase } = getPhaseProgress(
    weeks,
    currentWeekIndex,
    currentPhase,
    injuryRange,
  );

  if (currentPhase === 'INJURY' && injury?.status === 'resolved') {
    return `Injury history. Week ${weekInPhase} of ${totalWeeksInPhase}. Recovery is complete and this period stays visible in the block.`;
  }

  return `${formatPhaseName(currentPhase)}. Week ${weekInPhase} of ${totalWeeksInPhase}. ${getPhaseOutlook(currentPhase)}`;
}

export function getPhaseStripLabel(segment: BlockPhaseSegment, totalWeeks: number): string {
  const charsPerWeek = totalWeeks >= 20 ? 2.2 : totalWeeks >= 14 ? 3 : 4.5;
  const maxFullLabelChars = Math.max(1, Math.floor(segment.weeks * charsPerWeek));

  return segment.name.length > maxFullLabelChars
    ? COMPACT_PHASE_LABEL[segment.name]
    : segment.name;
}

export function formatShortDate(date: string | null): string {
  return formatShortMonthDayLabel(date);
}

export function formatPlannedDistance(
  km: number,
  hasEstimate: boolean,
  units: 'metric' | 'imperial',
): string {
  const label = formatDistance(km, units);
  return hasEstimate ? `~${label}` : label;
}

function getStatusIconStatus(
  status: ReturnType<typeof buildResolvedBlockWeekDayDetails>[number]['status'],
): BlockWeekRowDayModel['statusIcon'] {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'off-target':
      return 'completed';
    case 'missed':
      return 'missed';
    default:
      return null;
  }
}

export function materializeSessionForWeek(
  week: PlanWeek,
  dayIndex: number,
  updated: SessionEditorResult,
): PlannedSession | null {
  const existing = week.sessions[dayIndex];
  return materializeEditedSession(existing, updated, {
    id: existing?.id ?? createId(),
    date: existing?.date ?? addDaysIso(getWeekStartDate(week), dayIndex),
    type: existing?.type ?? 'EASY',
  });
}

export function hasMaterialSessionEditForWeek(
  week: PlanWeek,
  dayIndex: number,
  updated: SessionEditorResult,
): boolean {
  const existing = week.sessions[dayIndex];
  return hasMaterialSessionEdit(existing, updated, {
    id: existing?.id ?? createId(),
    date: existing?.date ?? addDaysIso(getWeekStartDate(week), dayIndex),
    type: existing?.type ?? 'EASY',
  });
}

export function preserveCurrentAnnotations(
  currentPlan: TrainingPlanWithAnnotation,
  updatedPlan: TrainingPlan,
): TrainingPlanWithAnnotation {
  return {
    ...updatedPlan,
    todayAnnotation: currentPlan.todayAnnotation,
    coachAnnotation: currentPlan.coachAnnotation ?? null,
  };
}

export function parseEditSessionResult(value: string | string[] | undefined): ParsedEditSessionResult | null {
  const raw = firstRouteParamValue(value);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      weekIndex?: unknown;
      dayIndex?: unknown;
      updated?: SessionEditorResult;
    };

    if (
      typeof parsed.weekIndex !== 'number'
      || typeof parsed.dayIndex !== 'number'
      || parsed.weekIndex < 0
      || parsed.dayIndex < 0
      || parsed.dayIndex > 6
    ) {
      return null;
    }

    return {
      weekIndex: parsed.weekIndex,
      dayIndex: parsed.dayIndex,
      updated: parsed.updated ?? null,
    };
  } catch {
    return null;
  }
}

export function buildPendingEdit(
  input: ParsedEditSessionResult,
  units: 'metric' | 'imperial',
): PendingEdit {
  return {
    ...input,
    desc: buildSessionEditDescription(input.dayIndex, input.updated, units),
  };
}

export function buildBlockPhaseStripModel({
  plan,
  safeCurrentWeekIndex,
  historicalInjury,
  injuryRange,
  today,
}: {
  plan: TrainingPlan;
  safeCurrentWeekIndex: number;
  historicalInjury: Injury | null | undefined;
  injuryRange: InjuryWeekRange;
  today: string;
}): BlockPhaseStripModel {
  const currentPhase = isInjuryWeek(safeCurrentWeekIndex, injuryRange)
    ? 'INJURY'
    : plan.weeks[safeCurrentWeekIndex]?.phase ?? 'BUILD';
  const isHistoricalCurrentInjury = currentPhase === 'INJURY' && historicalInjury?.status === 'resolved';

  return {
    phases: buildBlockPhaseSegments(plan.weeks, safeCurrentWeekIndex, historicalInjury, today),
    currentPhase,
    isHistoricalCurrentInjury,
    caption: getPhaseCaption(plan.weeks, safeCurrentWeekIndex, currentPhase, injuryRange, historicalInjury),
  };
}

export function getMaxPlannedWeekKm(weeks: PlanWeek[]): number {
  return Math.max(...weeks.map((week) => weekKmBreakdown(week).totalKm), 1);
}

export function buildBlockWeekRowModels({
  plan,
  safeCurrentWeekIndex,
  visibleExpandedWeekNumber,
  collapsingWeekNumber,
  rescheduleWeekIndex,
  rescheduleSessions,
  rescheduleHasChanges,
  rescheduleMovedDayIndexes,
  rescheduleDragState,
  canDragRescheduleIndex,
  canDropRescheduleIndex,
  today,
  injuryRange,
  recoveryEntries,
  recoveryEntriesLoading,
  activityResolution,
  runDetailNavigation,
  units,
}: BlockWeekRowsInput): BlockWeekRowModel[] {
  return plan.weeks.map((week, index) => {
    const isCurrent = index === safeCurrentWeekIndex;
    const isPast = index < safeCurrentWeekIndex;
    const isFuture = index > safeCurrentWeekIndex;
    const isEditableWeek = isEditableBlockWeek(index, safeCurrentWeekIndex);
    const injuryWeek = isInjuryWeek(index, injuryRange);
    const isExpanded = visibleExpandedWeekNumber === week.weekNumber;
    const isCollapsing = collapsingWeekNumber === week.weekNumber && !isExpanded;
    const shouldRenderExpandedWeek = isExpanded || isCollapsing;
    const isRescheduleWeek = rescheduleWeekIndex === index;
    const shouldUseRescheduleDraft =
      isExpanded
      && isRescheduleWeek
      && (rescheduleHasChanges || rescheduleSessions === week.sessions);
    const baseDisplayWeek =
      shouldUseRescheduleDraft
        ? {
            ...week,
            sessions: rescheduleSessions,
            plannedKm: weekKm(rescheduleSessions),
          }
        : week;
    const datedDisplayWeek = buildDisplayWeek(baseDisplayWeek, getWeekStartDate(week));
    const displayWeek = resolveProfileLinkedWeekTargets(
      datedDisplayWeek,
      plan.trainingPaceProfile,
      { today },
    );
    const weekEntries = injuryWeek ? getWeekEntries(recoveryEntries, week) : [];
    const volumeTone = getBlockVolumeTone(index, safeCurrentWeekIndex);
    const volumeSummary = getResolvedWeekVolumeSummary(displayWeek, volumeTone, activityResolution);
    const plannedVolumeLabel = formatPlannedDistance(
      volumeSummary.plannedKm,
      volumeSummary.hasEstimatedPlannedKm,
      units,
    );
    const blockDayDetails = buildResolvedBlockWeekDayDetails(displayWeek, activityResolution);
    const weekGuide = getBlockWeekGuide({
      injuryWeek,
      isEditableWeek,
      isRescheduleWeek,
      hasRescheduleChanges: rescheduleHasChanges,
    });
    const days = blockDayDetails.map((detail, dayIndex) => {
      const session = displayWeek.sessions[dayIndex] ?? null;
      const locked = activityResolution.isSessionComplete(session);
      const moved = isRescheduleWeek && rescheduleMovedDayIndexes.has(dayIndex);
      const dragging =
        shouldUseRescheduleDraft
        && rescheduleDragState?.fromIndex === dayIndex;
      const dropTarget =
        shouldUseRescheduleDraft
        && rescheduleDragState?.overIndex === dayIndex
        && rescheduleDragState.fromIndex !== dayIndex;
      const invalidDropTarget = Boolean(dropTarget && !canDropRescheduleIndex(dayIndex));
      const canDragVisibleDay = shouldUseRescheduleDraft
        ? canDragRescheduleIndex(dayIndex)
        : !locked;
      const { canEditDay, canDragDay, canReviewRun } = resolveBlockDayInteraction({
        injuryWeek,
        isEditableWeek,
        isExpanded,
        isRescheduleWeek,
        hasRescheduleChanges: rescheduleHasChanges,
        isMoved: moved,
        isLocked: locked,
        canDragIndex: canDragVisibleDay,
        hasRunDetail: runDetailNavigation.canOpenRunDetail(session),
      });

      return {
        detail,
        dayIndex,
        statusIcon: getStatusIconStatus(detail.status),
        session,
        locked,
        moved,
        dragging,
        dropTarget,
        invalidDropTarget,
        canEditDay,
        canDragDay,
        canReviewRun,
        sessionRowText: formatSessionRowText(session, units),
      };
    });

    return {
      week,
      index,
      isCurrent,
      isPast,
      isFuture,
      isEditableWeek,
      injuryWeek,
      isExpanded,
      isCollapsing,
      shouldRenderExpandedWeek,
      isRescheduleWeek,
      shouldUseRescheduleDraft,
      displayWeek,
      weekEntries,
      recoveryEntriesLoading,
      volumeTone,
      volumeSummary,
      plannedVolumeLabel,
      weekGuide,
      days,
    };
  });
}
