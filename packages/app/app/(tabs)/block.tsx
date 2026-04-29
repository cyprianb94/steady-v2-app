import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { usePlan } from '../../hooks/usePlan';
import { useStravaSync } from '../../hooks/useStravaSync';
import { useTodayIso } from '../../hooks/useTodayIso';
import { AnimatedWeekExpansion } from '../../components/block/AnimatedWeekExpansion';
import { BlockVolumeChart } from '../../components/block-review';
import { DragHandle } from '../../components/plan-builder/DragHandle';
import { PropagateModal } from '../../components/plan-builder/PropagateModal';
import { RunStatusIcon, type RunStatusIconStatus } from '../../components/run/RunStatusIcon';
import { Btn } from '../../components/ui/Btn';
import { AnimatedProgressFill } from '../../components/ui/AnimatedProgressFill';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { PHASE_COLOR } from '../../constants/phase-meta';
import { SESSION_TYPE } from '../../constants/session-types';
import {
  buildSessionEditDescription,
  hasMaterialSessionEdit,
  materializeEditedSession,
  resolveProfileLinkedSessionTarget,
} from '../../features/plan-builder/session-editing';
import { consumeSessionEditReturn } from '../../features/plan-builder/session-edit-return';
import { useDirectWeekReschedule } from '../../features/plan-builder/use-direct-week-reschedule';
import { deriveLiveBlockReviewModel } from '../../features/block-review/live-block-review-model';
import { formatSessionRowText } from '../../lib/session-row-text';
import { useAuth } from '../../lib/auth';
import { triggerSelectionChangeHaptic } from '../../lib/haptics';
import { createId } from '../../lib/id';
import { updatePlanWeeks } from '../../lib/plan-api';
import { addDaysIso, inferWeekStartDate, todayIsoLocal, weekKm } from '../../lib/plan-helpers';
import { usePreferences } from '../../providers/preferences-context';
import { formatDistance } from '../../lib/units';
import {
  buildResolvedBlockWeekDayDetails,
  getResolvedWeekVolumeSummary,
  preserveResolvedLockedWeeks,
  restoreResolvedSwapDraft,
} from '../../features/run/block-week-resolution';
import {
  getBlockWeekGuide,
  isEditableBlockWeek,
  resolveBlockDayInteraction,
} from '../../features/run/block-week-interactions';
import { buildDisplayWeek } from '../../features/run/display-week';
import { useActivityResolution } from '../../features/run/use-activity-resolution';
import { useRunDetailNavigation } from '../../features/run/use-run-detail-navigation';
import { useRecoveryData } from '../../features/recovery/use-recovery-data';
import { getVisibleHistoricalInjury, MVP_RECOVERY_UI_ENABLED } from '../../features/recovery/recovery-ui-gate';
import { usePlanRefreshCoordinator } from '../../features/sync/use-plan-refresh-coordinator';
import {
  buildBlockPhaseSegments,
  getBlockVolumeTone,
  getInjuryWeekRange,
  getWeekVolumeRatio,
  isInjuryWeek,
  propagateSwap,
  propagateChange,
  type BlockPhaseSegment,
  type CrossTrainingEntry,
  type Injury,
  type PlannedSession,
  type PlanWeek,
  type PropagateScope,
  type SessionType,
  type SwapLogEntry,
} from '@steady/types';

const COMPACT_PHASE_LABEL: Record<BlockPhaseSegment['name'], string> = {
  BASE: 'B',
  BUILD: 'BLD',
  RECOVERY: 'REC',
  PEAK: 'PK',
  TAPER: 'TP',
  INJURY: 'INJ',
};

const EMPTY_WEEK_SESSIONS: (PlannedSession | null)[] = [null, null, null, null, null, null, null];

const INACTIVE_PHASE_BACKGROUND: Record<PlanWeek['phase'], string> = {
  BASE: `${C.navy}59`,
  BUILD: `${C.clay}59`,
  RECOVERY: `${PHASE_COLOR.RECOVERY}59`,
  PEAK: `${C.amber}59`,
  TAPER: `${C.forest}59`,
};

function formatRaceDate(date: string | null | undefined): string {
  if (!date) return '';
  const value = new Date(`${date}T00:00:00`);
  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getWeekStartDate(week: PlanWeek): string {
  const fallbackDate =
    week.sessions.find((session) => session?.date)?.date ??
    todayIsoLocal();
  return inferWeekStartDate(week, fallbackDate);
}

function getWeekEntries(entries: CrossTrainingEntry[], week: PlanWeek): CrossTrainingEntry[] {
  const startDate = getWeekStartDate(week);
  const endDate = addDaysIso(startDate, 6);
  return entries.filter((entry) => entry.date >= startDate && entry.date <= endDate);
}

function formatPhaseName(phase: PlanWeek['phase'] | 'INJURY'): string {
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
  injuryRange: ReturnType<typeof getInjuryWeekRange>,
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

function getPhaseCaption(
  weeks: PlanWeek[],
  currentWeekIndex: number,
  currentPhase: PlanWeek['phase'] | 'INJURY',
  injuryRange: ReturnType<typeof getInjuryWeekRange>,
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

function getPhaseStripLabel(segment: BlockPhaseSegment, totalWeeks: number): string {
  const charsPerWeek = totalWeeks >= 20 ? 2.2 : totalWeeks >= 14 ? 3 : 4.5;
  const maxFullLabelChars = Math.max(1, Math.floor(segment.weeks * charsPerWeek));

  return segment.name.length > maxFullLabelChars
    ? COMPACT_PHASE_LABEL[segment.name]
    : segment.name;
}

function formatShortDate(date: string | null): string {
  if (!date) return '';
  const value = new Date(`${date}T00:00:00`);
  return value.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function getStatusIconStatus(
  status: ReturnType<typeof buildResolvedBlockWeekDayDetails>[number]['status'],
): RunStatusIconStatus | null {
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

interface PreservedRescheduleDraft {
  weekNumber: number;
  swapLog: SwapLogEntry[];
}

interface PendingEdit {
  weekIndex: number;
  dayIndex: number;
  updated: Partial<PlannedSession> | null;
  desc: string;
  nonce?: string;
}

function materializeSessionForWeek(
  week: PlanWeek,
  dayIndex: number,
  updated: Partial<PlannedSession> | null,
): PlannedSession | null {
  const existing = week.sessions[dayIndex];
  return materializeEditedSession(existing, updated, {
    id: existing?.id ?? createId(),
    date: existing?.date ?? addDaysIso(getWeekStartDate(week), dayIndex),
    type: existing?.type ?? 'EASY',
  });
}

function hasMaterialSessionEditForWeek(
  week: PlanWeek,
  dayIndex: number,
  updated: Partial<PlannedSession> | null,
): boolean {
  const existing = week.sessions[dayIndex];
  return hasMaterialSessionEdit(existing, updated, {
    id: existing?.id ?? createId(),
    date: existing?.date ?? addDaysIso(getWeekStartDate(week), dayIndex),
    type: existing?.type ?? 'EASY',
  });
}

function normalizeEditedDayIdentity(
  originalWeeks: PlanWeek[],
  nextWeeks: PlanWeek[],
  dayIndex: number,
): PlanWeek[] {
  return nextWeeks.map((nextWeek, weekIndex) => {
    const nextSession = nextWeek.sessions[dayIndex];
    if (!nextSession) return nextWeek;

    const originalWeek = originalWeeks[weekIndex] ?? nextWeek;
    const originalSession = originalWeek.sessions[dayIndex];
    const id = originalSession?.id ?? createId();
    const date = addDaysIso(getWeekStartDate(originalWeek), dayIndex);

    if (nextSession.id === id && nextSession.date === date) {
      return nextWeek;
    }

    const sessions = [...nextWeek.sessions];
    sessions[dayIndex] = {
      ...nextSession,
      id,
      date,
    };

    return {
      ...nextWeek,
      sessions,
    };
  });
}

function firstRouteParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}

type ParsedEditSessionResult = Omit<PendingEdit, 'desc'>;

function parseEditSessionResult(value: string | string[] | undefined): ParsedEditSessionResult | null {
  const raw = firstRouteParamValue(value);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      weekIndex?: unknown;
      dayIndex?: unknown;
      updated?: Partial<PlannedSession> | null;
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

export default function BlockTab() {
  const { units } = usePreferences();
  const routeParams = useLocalSearchParams<{
    editSessionResult?: string | string[];
    editSessionNonce?: string | string[];
  }>();
  const { session, isLoading: authLoading } = useAuth();
  const { plan, loading, refreshing, currentWeekIndex, refresh, refreshWithIndicator } = usePlan();
  const isFocused = useIsFocused();
  const { forceSync, syncRevision, syncing } = useStravaSync();
  const [expandedWeekNumber, setExpandedWeekNumber] = useState<number | null>(null);
  const [collapsingWeekNumber, setCollapsingWeekNumber] = useState<number | null>(null);
  const [rescheduleWeekIndex, setRescheduleWeekIndex] = useState<number | null>(null);
  const [rescheduleScopeVisible, setRescheduleScopeVisible] = useState(false);
  const [isSavingRearrange, setIsSavingRearrange] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isScrubbingVolumeChart, setIsScrubbingVolumeChart] = useState(false);
  const [preservedReschedule, setPreservedReschedule] = useState<PreservedRescheduleDraft | null>(null);
  const processedEditNonceRef = useRef<string | null>(null);
  const today = useTodayIso();

  const activityResolution = useActivityResolution({
    enabled: Boolean(session),
    isFocused,
    planId: plan?.id,
    syncRevision,
    today,
    fetchErrorMessage: 'Failed to fetch activities for block view:',
  });
  const runDetailNavigation = useRunDetailNavigation({
    activityForSession: activityResolution.activityForSession,
    activityIdForSession: activityResolution.activityIdForSession,
  });
  const historicalInjury = getVisibleHistoricalInjury(plan);
  const injuryRange = plan ? getInjuryWeekRange(plan.weeks, historicalInjury, today) : null;
  const recoveryScope = useMemo(() => {
    if (!plan || !injuryRange) {
      return null;
    }

    const startWeek = plan.weeks[injuryRange.startIndex];
    const endWeek = plan.weeks[injuryRange.endIndex];

    if (!startWeek || !endWeek) {
      return null;
    }

    return {
      type: 'range' as const,
      startDate: getWeekStartDate(startWeek),
      endDate: addDaysIso(getWeekStartDate(endWeek), 6),
    };
  }, [injuryRange, plan]);
  const recoveryData = useRecoveryData({
    plan,
    enabled: Boolean(session) && MVP_RECOVERY_UI_ENABLED,
    isFocused,
    injury: historicalInjury,
    scope: recoveryScope,
    fetchErrorMessage: 'Failed to fetch block cross-training entries:',
  });
  const rescheduleBaseWeek = rescheduleWeekIndex == null
    ? null
    : plan?.weeks[rescheduleWeekIndex] ?? null;
  const reschedule = useDirectWeekReschedule({
    initialSessions: rescheduleBaseWeek?.sessions ?? EMPTY_WEEK_SESSIONS,
    canDragDay: (nextSession) => !activityResolution.isSessionComplete(nextSession),
    canDropDay: (nextSession) => !activityResolution.isSessionComplete(nextSession),
  });

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (!plan) {
      return;
    }

    const storedResult = consumeSessionEditReturn();
    const routeNonce = firstRouteParamValue(routeParams.editSessionNonce);
    const routeResult = parseEditSessionResult(routeParams.editSessionResult);
    const result = storedResult ?? (routeNonce && routeResult ? { ...routeResult, nonce: routeNonce } : null);

    if (!result || processedEditNonceRef.current === result.nonce) {
      return;
    }

    const editedWeekNumber = plan?.weeks[result.weekIndex]?.weekNumber;
    processedEditNonceRef.current = result.nonce;
    if (editedWeekNumber != null) {
      setExpandedWeekNumber(editedWeekNumber);
    }
    const editedWeek = plan.weeks[result.weekIndex];
    if (!editedWeek || !hasMaterialSessionEditForWeek(
      editedWeek,
      result.dayIndex,
      result.updated,
    )) {
      return;
    }
    setPendingEdit({
      ...result,
      desc: buildSessionEditDescription(result.dayIndex, result.updated, units),
    });
  }, [isFocused, plan, routeParams.editSessionNonce, routeParams.editSessionResult, units]);

  useEffect(() => {
    if (!isFocused) {
      setExpandedWeekNumber(null);
      setCollapsingWeekNumber(null);
    }
  }, [isFocused]);

  useEffect(() => {
    if (!plan) {
      return;
    }

    if (expandedWeekNumber == null) {
      if (!reschedule.hasChanges) {
        setRescheduleWeekIndex(null);
      }
      return;
    }

    const nextIndex = plan.weeks.findIndex((week) => week.weekNumber === expandedWeekNumber);
    if (nextIndex === -1) {
      return;
    }

    setRescheduleWeekIndex((current) => (current === nextIndex ? current : nextIndex));
  }, [expandedWeekNumber, plan, reschedule.hasChanges]);

  useEffect(() => {
    if (!plan || !preservedReschedule) {
      return;
    }

    const restoredWeekIndex = plan.weeks.findIndex(
      (week) => week.weekNumber === preservedReschedule.weekNumber,
    );
    if (restoredWeekIndex === -1) {
      setPreservedReschedule(null);
      return;
    }

    const restoredWeek = plan.weeks[restoredWeekIndex];
    const restoredDraft = restoreResolvedSwapDraft(
      restoredWeek.sessions,
      preservedReschedule.swapLog,
      activityResolution,
    );
    setRescheduleWeekIndex(restoredWeekIndex);
    reschedule.restoreDraft(
      restoredDraft.sessions,
      restoredDraft.swapLog,
    );
    setPreservedReschedule(null);
  }, [activityResolution, plan, preservedReschedule, reschedule]);

  useEffect(() => {
    if (!reschedule.hasChanges) {
      setRescheduleScopeVisible(false);
    }
  }, [reschedule.hasChanges]);

  const { refreshManually } = usePlanRefreshCoordinator({
    enabled: Boolean(session),
    isFocused,
    forceSync,
    refreshPlan: refresh,
    refreshPlanWithIndicator: refreshWithIndicator,
    syncRevision,
    syncRefreshErrorMessage: 'Failed to refresh block plan after Strava sync:',
    manualRefreshErrorMessage: 'Failed to refresh block screen:',
  });
  const safeCurrentWeekIndex = plan?.weeks.length
    ? Math.min(currentWeekIndex, plan.weeks.length - 1)
    : 0;
  const reviewModel = useMemo(() => {
    if (!plan || plan.weeks.length === 0) {
      return null;
    }

    return deriveLiveBlockReviewModel({
      plan,
      currentWeekIndex: safeCurrentWeekIndex,
    });
  }, [plan, safeCurrentWeekIndex]);

  if (authLoading || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.clay} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Sign in to see your plan</Text>
        <Text style={styles.muted}>
          Use the Settings tab to continue with Google, then come back here.
        </Text>
        <View style={{ marginTop: 20 }}>
          <Btn title="Go to settings" onPress={() => router.push('/(tabs)/settings')} />
        </View>
      </View>
    );
  }

  if (!plan || plan.weeks.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No plan yet</Text>
        <Text style={styles.muted}>Build your training plan to get started</Text>
        <View style={{ marginTop: 20 }}>
          <Btn
            title="Build a plan"
            onPress={() => router.push('/onboarding/plan-builder/step-goal')}
          />
        </View>
      </View>
    );
  }

  if (!reviewModel) {
    return null;
  }

  const phases = buildBlockPhaseSegments(plan.weeks, safeCurrentWeekIndex, historicalInjury, today);
  const currentPhase = isInjuryWeek(safeCurrentWeekIndex, injuryRange)
    ? 'INJURY'
    : plan.weeks[safeCurrentWeekIndex]?.phase ?? 'BUILD';
  const isHistoricalCurrentInjury = currentPhase === 'INJURY' && historicalInjury?.status === 'resolved';
  const maxKm = Math.max(...plan.weeks.map(weekKm), 1);
  const pendingEditWeekNumber = pendingEdit
    ? plan.weeks[pendingEdit.weekIndex]?.weekNumber ?? null
    : null;
  const visibleExpandedWeekNumber = pendingEditWeekNumber ?? expandedWeekNumber;

  function toggleWeek(weekNumber: number) {
    if (!plan) {
      return;
    }

    if (reschedule.hasChanges) {
      return;
    }

    const previousExpandedWeekNumber = expandedWeekNumber;
    const nextExpandedWeekNumber = previousExpandedWeekNumber === weekNumber ? null : weekNumber;
    setCollapsingWeekNumber(
      previousExpandedWeekNumber == null || previousExpandedWeekNumber === nextExpandedWeekNumber
        ? null
        : previousExpandedWeekNumber,
    );
    setExpandedWeekNumber(nextExpandedWeekNumber);

    if (nextExpandedWeekNumber == null) {
      setRescheduleWeekIndex(null);
      return;
    }

    triggerSelectionChangeHaptic();

    const nextIndex = plan.weeks.findIndex((nextWeek) => nextWeek.weekNumber === nextExpandedWeekNumber);
    if (nextIndex !== -1) {
      setRescheduleWeekIndex(nextIndex);
    }
  }

  async function applyPendingRearrange(scope: PropagateScope) {
    if (!plan || rescheduleWeekIndex == null || reschedule.swapLog.length === 0) return;
    const sourceWeek = plan.weeks[rescheduleWeekIndex];
    if (!sourceWeek) return;

    const nextWeeks = reschedule.swapLog.reduce((weeks, swap) => {
      const propagated = propagateSwap(
        weeks,
        rescheduleWeekIndex,
        swap.from,
        swap.to,
        scope,
        sourceWeek.phase,
      );

      return preserveResolvedLockedWeeks(weeks, propagated, swap, activityResolution);
    }, plan.weeks);


    try {
      setIsSavingRearrange(true);
      await updatePlanWeeks(nextWeeks);
      await refresh();
      setRescheduleScopeVisible(false);
      reschedule.reset();
    } catch (error) {
      console.error('Failed to rearrange sessions:', error);
    } finally {
      setIsSavingRearrange(false);
    }
  }

  function openSessionEditor(weekIndex: number, dayIndex: number) {
    router.push({
      pathname: '/edit-session',
      params: {
        weekIndex: String(weekIndex),
        dayIndex: String(dayIndex),
      },
    });
  }

  async function applyPendingEdit(scope: PropagateScope) {
    if (!plan || !pendingEdit) return;

    const sourceWeek = plan.weeks[pendingEdit.weekIndex];
    if (!sourceWeek) return;
    const preservedDraft =
      reschedule.hasChanges && rescheduleWeekIndex != null
        ? {
            weekNumber: plan.weeks[rescheduleWeekIndex]?.weekNumber ?? 0,
            swapLog: reschedule.swapLog,
          }
        : null;

    const updatedSession = materializeSessionForWeek(
      sourceWeek,
      pendingEdit.dayIndex,
      pendingEdit.updated,
    );

    const nextWeeks = normalizeEditedDayIdentity(
      plan.weeks,
      propagateChange(
        plan.weeks,
        pendingEdit.weekIndex,
        pendingEdit.dayIndex,
        updatedSession,
        scope,
        plan.templateWeek,
        sourceWeek.phase,
        {
          shouldPreserveSession: (sessionToCheck) =>
            activityResolution.isSessionComplete(sessionToCheck),
        },
      ),
      pendingEdit.dayIndex,
    );

    try {
      setIsSavingEdit(true);
      await updatePlanWeeks(nextWeeks);
      await refresh();
      if (preservedDraft && preservedDraft.weekNumber > 0) {
        setPreservedReschedule(preservedDraft);
      }
      setExpandedWeekNumber(sourceWeek.weekNumber);
      setPendingEdit(null);
    } catch (error) {
      console.error('Failed to edit session:', error);
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        scrollEnabled={!reschedule.isHandleActive && !isScrubbingVolumeChart}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || syncing}
            onRefresh={refreshManually}
            tintColor={C.clay}
          />
        }
      >
        {/* Race header */}
        <View style={styles.header}>
          <Text style={styles.label}>GOAL RACE</Text>
          <Text style={styles.raceTitle}>{plan.raceName}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaValue, { color: C.clay }]}>{formatRaceDate(plan.raceDate)}</Text>
            <Text style={[styles.metaValue, { color: C.muted }]}>
              {plan.weeks.length - safeCurrentWeekIndex} weeks out
            </Text>
            <Text style={[styles.metaValue, { color: C.navy }]}>{plan.targetTime}</Text>
          </View>
        </View>

      <BlockVolumeChart
        model={reviewModel}
        title="Block overview"
        raceDate={plan.raceDate}
        onScrubActiveChange={setIsScrubbingVolumeChart}
        formatDistance={(km) => formatDistance(km, units)}
        showPhaseStrip={false}
      />

      {/* Phase strip */}
      <View style={styles.phaseSection}>
        <View style={styles.phaseStrip}>
          {phases.map((p, i) => {
            const label = getPhaseStripLabel(p, plan.weeks.length);
            const isCompactLabel = label !== p.name;
            const isHistoricalCurrentSegment =
              p.name === 'INJURY' && p.isCurrent && isHistoricalCurrentInjury;
            const showCurrentPhaseEmphasis = p.isCurrent && !isHistoricalCurrentSegment;

            return (
              <View
                key={i}
                style={[
                  styles.phaseSegment,
                  {
                    flex: p.weeks,
                    backgroundColor:
                      p.name === 'INJURY'
                        ? isHistoricalCurrentSegment
                          ? C.clayBg
                          : p.isCurrent
                          ? C.clay
                          : C.clayBg
                        : p.isCurrent
                          ? PHASE_COLOR[p.name]
                          : INACTIVE_PHASE_BACKGROUND[p.name],
                    borderWidth: p.name === 'INJURY' && (!p.isCurrent || isHistoricalCurrentSegment) ? 1 : 0,
                    borderColor: p.name === 'INJURY' ? `${C.clay}35` : 'transparent',
                  },
                  showCurrentPhaseEmphasis && styles.phaseSegmentCurrent,
                  showCurrentPhaseEmphasis && {
                    shadowColor: p.name === 'INJURY' ? C.clay : PHASE_COLOR[p.name],
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.phaseLabel,
                    isCompactLabel && styles.phaseLabelCompact,
                    {
                      color:
                        p.name === 'INJURY'
                          ? isHistoricalCurrentSegment
                            ? C.clay
                            : p.isCurrent
                            ? 'white'
                            : C.clay
                          : p.isCurrent
                            ? 'white'
                            : 'rgba(255,255,255,0.74)',
                    },
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.phaseCaption}>
          <Text style={styles.phaseCaptionLead}>
            {isHistoricalCurrentInjury ? 'Current week:' : 'Current phase:'}
          </Text>
          <Text>{` ${getPhaseCaption(plan.weeks, safeCurrentWeekIndex, currentPhase, injuryRange, historicalInjury)}`}</Text>
        </Text>
      </View>

      {/* Week rows */}
      {plan.weeks.map((week, i) => {
        const isCurrent = i === safeCurrentWeekIndex;
        const isPast = i < safeCurrentWeekIndex;
        const isFuture = i > safeCurrentWeekIndex;
        const isEditableWeek = isEditableBlockWeek(i, safeCurrentWeekIndex);
        const injuryWeek = isInjuryWeek(i, injuryRange);
        const isExpanded = visibleExpandedWeekNumber === week.weekNumber;
        const isCollapsing = collapsingWeekNumber === week.weekNumber && !isExpanded;
        const shouldRenderExpandedWeek = isExpanded || isCollapsing;
        const isRescheduleWeek = rescheduleWeekIndex === i;
        const shouldUseRescheduleDraft =
          isExpanded
          && isRescheduleWeek
          && (reschedule.hasChanges || reschedule.sessions === week.sessions);
        const baseDisplayWeek =
          shouldUseRescheduleDraft
            ? {
                ...week,
                sessions: reschedule.sessions,
                plannedKm: Math.round(weekKm(reschedule.sessions)),
              }
            : week;
        const datedDisplayWeek = buildDisplayWeek(baseDisplayWeek, getWeekStartDate(week));
        const resolvedDisplaySessions = datedDisplayWeek.sessions.map((session) => (
          resolveProfileLinkedSessionTarget(session, plan.trainingPaceProfile, { today })
        ));
        const hasResolvedDisplayTargets = resolvedDisplaySessions.some(
          (session, index) => session !== datedDisplayWeek.sessions[index],
        );
        const displayWeek = hasResolvedDisplayTargets
          ? {
              ...datedDisplayWeek,
              sessions: resolvedDisplaySessions,
              plannedKm: Math.round(weekKm(resolvedDisplaySessions) * 10) / 10,
            }
          : datedDisplayWeek;
        const weekEntries = injuryWeek ? getWeekEntries(recoveryData.entries, week) : [];
        const volumeTone = getBlockVolumeTone(i, safeCurrentWeekIndex);
        const volumeSummary = getResolvedWeekVolumeSummary(displayWeek, volumeTone, activityResolution);
        const blockDayDetails = buildResolvedBlockWeekDayDetails(displayWeek, activityResolution);
        const weekGuide = getBlockWeekGuide({
          injuryWeek,
          isEditableWeek,
          isRescheduleWeek,
          hasRescheduleChanges: reschedule.hasChanges,
        });

        return (
          <View
            key={week.weekNumber}
            testID={`block-week-row-${week.weekNumber}`}
            style={[
              styles.weekRow,
              isCurrent && styles.weekRowCurrent,
              isPast && styles.weekRowPast,
              injuryWeek && styles.weekRowInjury,
              shouldRenderExpandedWeek && isFuture && styles.weekRowFutureExpanded,
              shouldRenderExpandedWeek && styles.weekRowExpanded,
            ]}
          >
            <Pressable
              onPress={() => toggleWeek(week.weekNumber)}
              style={styles.weekPressable}
              testID={`block-week-row-press-${week.weekNumber}`}
            >
              <View style={styles.weekRowMain}>
                <View style={styles.weekLeft}>
                  <Text
                    style={[
                      styles.weekNum,
                      isCurrent && { color: C.clay, fontWeight: '700' },
                    ]}
                  >
                    W{week.weekNumber}
                  </Text>
                  <Text style={[styles.weekPhaseTag, injuryWeek && styles.weekPhaseTagInjury]}>
                    {injuryWeek ? 'INJURY' : week.phase}
                  </Text>
                </View>

                {injuryWeek ? (
                  <View style={styles.injuryEntries}>
                    {recoveryData.isLoadingEntries ? (
                      <Text style={styles.injuryHelper}>Loading cross-training…</Text>
                    ) : weekEntries.length > 0 ? (
                      weekEntries.map((entry) => (
                        <View key={entry.id} style={styles.crossTrainingChip}>
                          <View style={styles.crossTrainingDot} />
                          <Text style={styles.crossTrainingText}>
                            {entry.type} {entry.durationMinutes}m
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.injuryHelper}>No cross-training logged</Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.dots}>
                    {displayWeek.sessions.map((s, d) => {
                      const type: SessionType = s?.type ?? 'REST';
                      return (
                        <View
                          key={d}
                          style={[
                            styles.dot,
                            {
                              backgroundColor: SESSION_TYPE[type].color,
                              opacity: !isPast && !isCurrent ? 0.55 : 1,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                )}

                <View style={styles.weekRight}>
                  {injuryWeek ? (
                    <Text style={[styles.weekKm, isCurrent && { color: C.clay }, styles.weekKmInjury]}>
                      {`${weekEntries.length} XT`}
                    </Text>
                  ) : volumeSummary.showActual && volumeSummary.actualKm != null ? (
                    <Text style={styles.weekKmComposite}>
                      <Text style={styles.weekKmActual}>{formatDistance(volumeSummary.actualKm, units)}</Text>
                      <Text style={styles.weekKmDivider}> / </Text>
                      <Text style={styles.weekKmPlanned}>{formatDistance(volumeSummary.plannedKm, units)}</Text>
                    </Text>
                  ) : (
                    <Text style={[styles.weekKm, isCurrent && { color: C.clay }]}>
                      {formatDistance(volumeSummary.plannedKm, units)}
                    </Text>
                  )}
                </View>
              </View>

              <View
                style={[
                  styles.volumeTrack,
                  volumeTone === 'current' && styles.volumeTrackCurrent,
                ]}
              >
                <AnimatedProgressFill
                  progress={getWeekVolumeRatio(volumeSummary.barKm, maxKm)}
                  fillStyle={[
                    styles.volumeFill,
                    volumeTone === 'past' && styles.volumeFillPast,
                    volumeTone === 'current' && styles.volumeFillCurrent,
                    volumeTone === 'future' && styles.volumeFillFuture,
                  ]}
                />
              </View>
            </Pressable>

            {shouldRenderExpandedWeek ? (
              <AnimatedWeekExpansion
                expanded={isExpanded}
                showDivider={isPast}
                onCollapseEnd={() => {
                  setCollapsingWeekNumber((current) => (
                    current === week.weekNumber ? null : current
                  ));
                }}
              >
                {weekGuide ? <Text style={styles.weekGuide}>{weekGuide}</Text> : null}

                {blockDayDetails.map((detail, dayIndex) => {
                  const statusIcon = getStatusIconStatus(detail.status);
                  const session = displayWeek.sessions[dayIndex] ?? null;
                  const locked = activityResolution.isSessionComplete(session);
                  const moved = isRescheduleWeek && reschedule.movedDayIndexes.has(dayIndex);
                  const dragging =
                    shouldUseRescheduleDraft
                    && reschedule.dragState?.fromIndex === dayIndex;
                  const dropTarget =
                    shouldUseRescheduleDraft &&
                    reschedule.dragState?.overIndex === dayIndex &&
                    reschedule.dragState.fromIndex !== dayIndex;
                  const invalidDropTarget = Boolean(dropTarget && !reschedule.canDropIndex(dayIndex));
                  const canDragVisibleDay = shouldUseRescheduleDraft
                    ? reschedule.canDragIndex(dayIndex)
                    : !locked;
                  const { canEditDay, canDragDay, canReviewRun } = resolveBlockDayInteraction({
                    injuryWeek,
                    isEditableWeek,
                    isExpanded,
                    isRescheduleWeek,
                    hasRescheduleChanges: reschedule.hasChanges,
                    isMoved: moved,
                    isLocked: locked,
                    canDragIndex: canDragVisibleDay,
                    hasRunDetail: runDetailNavigation.canOpenRunDetail(session),
                  });
                  const sessionRowText = formatSessionRowText(session, units);
                  const dayPressHandler = canReviewRun
                    ? () => { void runDetailNavigation.openRunDetail(session); }
                    : canEditDay
                      ? () => openSessionEditor(i, dayIndex)
                      : undefined;
                  return (
                    <Animated.View
                      key={`${week.weekNumber}-${detail.dayLabel}`}
                      onLayout={(event) => {
                        reschedule.registerSlotLayout(
                          dayIndex,
                          event.nativeEvent.layout.y,
                          event.nativeEvent.layout.height,
                        );
                      }}
                      style={[
                        styles.dayRowWrap,
                        dragging && { transform: [{ translateY: reschedule.dragY }] },
                      ]}
                    >
                      <View
                        style={[
                          styles.dayRow,
                          canEditDay && styles.dayRowEditable,
                          locked && styles.dayRowLocked,
                          dropTarget && styles.dayRowDropTarget,
                          dragging && styles.dayRowDragging,
                        ]}
                      >
                        {dropTarget ? (
                          <View
                            pointerEvents="none"
                            style={[
                              styles.dayRowDropTargetOutline,
                              invalidDropTarget && styles.dayRowDropTargetOutlineInvalid,
                            ]}
                          />
                        ) : null}
                        <Pressable
                          testID={`block-day-${week.weekNumber}-${dayIndex}`}
                          disabled={!dayPressHandler}
                          onPress={dayPressHandler}
                          style={styles.dayRowPressable}
                        >
                          <View style={styles.dayMeta}>
                            <Text style={styles.dayName}>{detail.dayLabel}</Text>
                            <Text style={styles.dayDate}>{formatShortDate(detail.date)}</Text>
                          </View>

                          <View style={styles.daySession}>
                            <View
                              style={[
                                styles.dayDot,
                                { backgroundColor: SESSION_TYPE[detail.sessionType].color },
                                detail.isRest && styles.dayDotRest,
                              ]}
                            />
                            <View style={styles.daySessionCopy}>
                              <Text
                                style={[styles.daySessionLabel, detail.isRest && styles.daySessionLabelRest]}
                                numberOfLines={1}
                              >
                                {sessionRowText.title}
                              </Text>
                              <Text
                                style={[styles.daySessionCaption, detail.isRest && styles.daySessionCaptionRest]}
                                numberOfLines={1}
                              >
                                {sessionRowText.caption}
                              </Text>
                            </View>
                          </View>
                        </Pressable>

                        <View style={styles.dayRight}>
                          {statusIcon && !canDragDay ? (
                            canReviewRun ? (
                              <Pressable
                                accessibilityLabel={`Review ${statusIcon === 'varied' ? 'varied' : statusIcon} run`}
                                accessibilityRole="button"
                                testID={`block-review-run-${week.weekNumber}-${dayIndex}`}
                                onPress={() => runDetailNavigation.openRunDetail(session)}
                                style={({ pressed }) => [
                                  styles.dayStatusButton,
                                  pressed && styles.dayStatusIconPressed,
                                ]}
                              >
                                <RunStatusIcon
                                  status={statusIcon}
                                  size={18}
                                  testID={`block-day-status-${week.weekNumber}-${dayIndex}`}
                                />
                              </Pressable>
                            ) : (
                              <RunStatusIcon
                                status={statusIcon}
                                size={18}
                                testID={`block-day-status-${week.weekNumber}-${dayIndex}`}
                              />
                            )
                          ) : canDragDay ? (
                            <DragHandle
                              testID={`block-drag-handle-${week.weekNumber}-${dayIndex}`}
                              disabled={false}
                              active={dragging}
                              quiet
                              alignEnd
                              onMouseDown={(event) => {
                                event.stopPropagation?.();
                                reschedule.recordTouchStart(event.clientY);
                                reschedule.beginDrag(dayIndex);
                              }}
                              onMouseMove={(event) => {
                                event.stopPropagation?.();
                                reschedule.updateDrag(event.clientY);
                              }}
                              onMouseUp={(event) => {
                                event.stopPropagation?.();
                                reschedule.finishDrag();
                              }}
                              onTouchStart={(event) => {
                                event.stopPropagation?.();
                                reschedule.recordTouchStart(event.nativeEvent.pageY);
                              }}
                              onLongPress={(event) => {
                                reschedule.recordTouchStart(event.nativeEvent.pageY);
                                reschedule.beginDrag(dayIndex);
                              }}
                              onTouchMove={(event) => {
                                event.stopPropagation?.();
                                reschedule.updateDrag(event.nativeEvent.pageY);
                              }}
                              onTouchCancel={() => {
                                reschedule.cancelDrag();
                              }}
                              onTouchEnd={() => {
                                reschedule.finishDrag();
                              }}
                            />
                          ) : null}
                        </View>
                      </View>
                    </Animated.View>
                  );
                })}

                {isRescheduleWeek && reschedule.hasChanges ? (
                  <View style={styles.pendingStrip}>
                    <Text style={styles.pendingPrompt}>Do you want to apply reschedule?</Text>
                    <View style={styles.pendingActions}>
                      <Pressable
                        testID="block-reschedule-reset"
                        onPress={() => reschedule.reset()}
                        style={styles.pendingSecondary}
                      >
                        <Text style={styles.pendingSecondaryText}>No</Text>
                      </Pressable>
                      <Pressable
                        testID="block-apply-reschedule"
                        onPress={() => setRescheduleScopeVisible(true)}
                        style={styles.pendingPrimary}
                      >
                        <Text style={styles.pendingPrimaryText}>Yes</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </AnimatedWeekExpansion>
            ) : null}
          </View>
        );
      })}

      <View style={{ height: 40 }} />
      </ScrollView>
      {rescheduleScopeVisible && rescheduleWeekIndex != null ? (
        <PropagateModal
          weekIndex={rescheduleWeekIndex}
          totalWeeks={plan.weeks.length}
          phaseName={plan.weeks[rescheduleWeekIndex]?.phase ?? 'BUILD'}
          phaseWeekCount={plan.weeks.filter((week) => week.phase === plan.weeks[rescheduleWeekIndex]?.phase).length}
          title="Where should this reschedule apply?"
          body={`You’ve rearranged this week. Choose whether the new layout stays local or carries into the rest of the ${formatPhaseName(plan.weeks[rescheduleWeekIndex]?.phase ?? 'BUILD').toLowerCase()} phase.`}
          applyLabel={isSavingRearrange ? 'Applying…' : 'Apply reschedule'}
          scopeLabels={{
            this: 'Just this week',
            remaining: 'This week + following weeks',
            build: `${formatPhaseName(plan.weeks[rescheduleWeekIndex]?.phase ?? 'BUILD')} weeks only`,
          }}
          onApply={applyPendingRearrange}
          onClose={() => setRescheduleScopeVisible(false)}
        />
      ) : null}
      {pendingEdit ? (
        <PropagateModal
          changeDesc={isSavingEdit ? 'Saving…' : pendingEdit.desc}
          weekIndex={pendingEdit.weekIndex}
          totalWeeks={plan.weeks.length}
          dayIndex={pendingEdit.dayIndex}
          sessionDate={plan.weeks[pendingEdit.weekIndex]?.sessions[pendingEdit.dayIndex]?.date ?? null}
          phaseName={plan.weeks[pendingEdit.weekIndex]?.phase ?? 'BUILD'}
          phaseWeekCount={plan.weeks.filter((week) => week.phase === plan.weeks[pendingEdit.weekIndex]?.phase).length}
          initialScope="this"
          onApply={applyPendingEdit}
          onClose={() => setPendingEdit(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  content: {
    padding: 18,
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    backgroundColor: C.cream,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  // Header
  header: {
    marginBottom: 14,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  raceTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    color: C.ink,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  metaValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
  },

  // Phase strip
  phaseSection: {
    marginTop: 10,
    marginBottom: 18,
  },
  phaseStrip: {
    flexDirection: 'row',
    gap: 2,
    height: 28,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  phaseSegment: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  phaseSegmentCurrent: {
    shadowColor: C.clay,
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  phaseLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 8.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    maxWidth: '100%',
    includeFontPadding: false,
  },
  phaseLabelCompact: {
    fontSize: 8,
    letterSpacing: 0.6,
  },
  phaseCaption: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  phaseCaptionLead: {
    fontFamily: FONTS.sansSemiBold,
    color: C.clay,
  },

  // Week rows
  weekRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  weekRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekPressable: {
    width: '100%',
  },
  weekRowCurrent: {
    backgroundColor: C.surface,
    borderColor: `${C.clay}35`,
    borderWidth: 1.5,
  },
  weekRowPast: {
    borderColor: C.border,
  },
  weekRowInjury: {
    backgroundColor: C.clayBg,
    borderColor: `${C.clay}22`,
  },
  weekRowFutureExpanded: {
    backgroundColor: C.surface,
    borderColor: `${C.muted}55`,
    borderWidth: 1.5,
  },
  weekRowExpanded: {
    paddingBottom: 12,
  },
  weekLeft: {
    width: 38,
  },
  weekNum: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.muted,
  },
  weekPhaseTag: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: C.muted,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  weekPhaseTagInjury: {
    color: C.clay,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    gap: 3.5,
    alignItems: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  injuryEntries: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  crossTrainingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: `${C.navy}16`,
  },
  crossTrainingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.navy,
  },
  crossTrainingText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    color: C.navy,
  },
  injuryHelper: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  weekRight: {
    width: 50,
    alignItems: 'flex-end',
  },
  weekKm: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.ink,
  },
  weekKmComposite: {
    fontFamily: FONTS.mono,
    fontSize: 10,
  },
  weekKmActual: {
    color: C.forest,
  },
  weekKmDivider: {
    color: C.muted,
  },
  weekKmPlanned: {
    color: C.muted,
  },
  weekKmInjury: {
    color: C.clay,
  },
  volumeTrack: {
    height: 2,
    marginTop: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  volumeTrackCurrent: {
    backgroundColor: C.border,
  },
  volumeFill: {
    height: '100%',
    borderRadius: 999,
  },
  volumeFillPast: {
    backgroundColor: C.forest,
  },
  volumeFillCurrent: {
    backgroundColor: C.clay,
  },
  volumeFillFuture: {
    backgroundColor: C.border,
    opacity: 0.55,
  },
  weekGuide: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 17,
    color: C.ink2,
    marginBottom: 4,
  },
  dayRowWrap: {
    marginBottom: 4,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    borderRadius: 10,
  },
  dayRowPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayRowEditable: {
    borderRadius: 8,
  },
  dayRowLocked: {
    opacity: 0.74,
  },
  dayRowDropTarget: {
    position: 'relative',
  },
  dayRowDropTargetOutline: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    left: -10,
    right: -6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.clay,
  },
  dayRowDropTargetOutlineInvalid: {
    borderColor: C.border,
  },
  dayRowDragging: {
    shadowColor: C.clay,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dayMeta: {
    width: 74,
  },
  dayName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  dayDate: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
  },
  daySession: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  daySessionCopy: {
    flex: 1,
    minWidth: 0,
  },
  dayDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dayDotRest: {
    backgroundColor: C.slate,
  },
  daySessionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.ink,
  },
  daySessionLabelRest: {
    fontFamily: FONTS.sansMedium,
    color: C.ink,
  },
  daySessionCaption: {
    fontFamily: FONTS.sans,
    fontSize: 10.5,
    color: C.muted,
    marginTop: 1,
  },
  daySessionCaptionRest: {
    color: C.muted,
  },
  dayRight: {
    minWidth: 26,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  dayStatusButton: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayStatusIconPressed: {
    opacity: 0.75,
  },
  pendingStrip: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: `${C.clay}35`,
    backgroundColor: C.surface,
    gap: 12,
  },
  pendingPrompt: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    color: C.ink,
    textAlign: 'center',
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  pendingSecondary: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  pendingSecondaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink2,
  },
  pendingPrimary: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.clay,
  },
  pendingPrimaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Empty/loading
  emptyTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 20,
    color: C.ink,
    marginBottom: 8,
  },
  muted: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
  },
});
