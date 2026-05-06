import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  getInjuryWeekRange,
  type BlockReviewModel,
  type PlannedSession,
  type PropagateScope,
  type TrainingPlanWithAnnotation,
} from '@steady/types';
import { usePlan } from '../../hooks/usePlan';
import { useStravaSync } from '../../hooks/useStravaSync';
import { useTodayIso } from '../../hooks/useTodayIso';
import { useAuth } from '../../lib/auth';
import { triggerSelectionChangeHaptic } from '../../lib/haptics';
import { applyBlockReschedule, propagatePlanChange } from '../../lib/plan-api';
import { usePreferences } from '../../providers/preferences-context';
import { consumeSessionEditReturn } from '../plan-builder/session-edit-return';
import { useDirectWeekReschedule } from '../plan-builder/use-direct-week-reschedule';
import { deriveLiveBlockReviewModel } from '../block-review/live-block-review-model';
import { useActivityResolution } from '../run/use-activity-resolution';
import { useRunDetailNavigation } from '../run/use-run-detail-navigation';
import { useRecoveryData } from '../recovery/use-recovery-data';
import { getVisibleHistoricalInjury, MVP_RECOVERY_UI_ENABLED } from '../recovery/recovery-ui-gate';
import { usePlanRefreshCoordinator } from '../sync/use-plan-refresh-coordinator';
import {
  EMPTY_WEEK_SESSIONS,
  buildBlockPhaseStripModel,
  buildBlockWeekRowModels,
  buildPendingEdit,
  formatPhaseName,
  getMaxPlannedWeekKm,
  getRescheduleRevealScrollTarget,
  getWeekStartDate,
  hasMaterialSessionEditForWeek,
  materializeSessionForWeek,
  parseEditSessionResult,
  preserveCurrentAnnotations,
  type BlockPhaseStripModel,
  type BlockWeekRowModel,
  type PendingEdit,
  type PreservedRescheduleDraft,
} from './block-tab-model';
import {
  blockSourceParams,
  parseBlockWeekNumber,
} from './block-return-navigation';
import { firstRouteParamValue } from '../../lib/route-params';
import {
  addDaysIso,
} from '../../lib/plan-helpers';
import { restoreResolvedSwapDraft } from '../run/block-week-resolution';

type Units = 'metric' | 'imperial';

interface PendingRescheduleModal {
  weekIndex: number;
  totalWeeks: number;
  phaseName: TrainingPlanWithAnnotation['weeks'][number]['phase'];
  phaseWeekCount: number;
  body: string;
  applyLabel: string;
  scopeLabels: {
    this: string;
    remaining: string;
    build: string;
  };
  onApply: (scope: PropagateScope) => Promise<void>;
  onClose: () => void;
}

interface PendingEditModal {
  changeDesc: string;
  weekIndex: number;
  totalWeeks: number;
  dayIndex: number;
  sessionDate: string | null;
  phaseName: TrainingPlanWithAnnotation['weeks'][number]['phase'];
  phaseWeekCount: number;
  onApply: (scope: PropagateScope) => Promise<void>;
  onClose: () => void;
}

interface BlockTabReadyState {
  status: 'ready';
  units: Units;
  plan: TrainingPlanWithAnnotation;
  reviewModel: BlockReviewModel;
  safeCurrentWeekIndex: number;
  phaseStrip: BlockPhaseStripModel;
  maxKm: number;
  weekRows: BlockWeekRowModel[];
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  scrollRef: RefObject<ScrollView | null>;
  scrollEnabled: boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onWeekRowLayout: (weekIndex: number, event: LayoutChangeEvent) => void;
  onVolumeChartScrubActiveChange: (active: boolean) => void;
  toggleWeek: (weekNumber: number) => void;
  openSessionEditor: (weekIndex: number, dayIndex: number) => void;
  openRunDetail: (session: PlannedSession | null) => Promise<void>;
  openRescheduleModal: () => void;
  reschedule: ReturnType<typeof useDirectWeekReschedule>;
  onCollapseEnd: (weekNumber: number) => void;
  rescheduleModal: PendingRescheduleModal | null;
  pendingEditModal: PendingEditModal | null;
}

type BlockTabControllerState =
  | { status: 'loading' }
  | { status: 'signedOut'; goToSettings: () => void }
  | { status: 'empty'; goToPlanBuilder: () => void }
  | { status: 'unavailable' }
  | BlockTabReadyState;

function planPhaseWeekCount(
  plan: TrainingPlanWithAnnotation,
  phaseName: TrainingPlanWithAnnotation['weeks'][number]['phase'],
): number {
  return plan.weeks.filter((week) => week.phase === phaseName).length;
}

export function useBlockTabController(): BlockTabControllerState {
  const { units } = usePreferences();
  const routeParams = useLocalSearchParams<{
    editSessionResult?: string | string[];
    editSessionNonce?: string | string[];
    openWeekNumber?: string | string[];
    blockReturnNonce?: string | string[];
  }>();
  const { session, isLoading: authLoading } = useAuth();
  const {
    plan,
    loading,
    refreshing,
    currentWeekIndex,
    refresh,
    refreshWithIndicator,
    replacePlan,
  } = usePlan();
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
  const blockScrollRef = useRef<ScrollView | null>(null);
  const scrollMetricsRef = useRef({ y: 0, viewportHeight: 0 });
  const weekRowLayoutRef = useRef<Record<number, { y: number; height: number }>>({});
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
    returnTo: 'block',
    returnWeekNumber: expandedWeekNumber,
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
    if (!isFocused || !plan) {
      return;
    }

    const storedResult = consumeSessionEditReturn();
    const routeNonce = firstRouteParamValue(routeParams.editSessionNonce);
    const routeResult = parseEditSessionResult(routeParams.editSessionResult);
    const result = storedResult ?? (routeNonce && routeResult ? { ...routeResult, nonce: routeNonce } : null);

    if (!result || processedEditNonceRef.current === result.nonce) {
      return;
    }

    const editedWeekNumber = plan.weeks[result.weekIndex]?.weekNumber;
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

    setPendingEdit(buildPendingEdit(result, units));
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
  const pendingEditWeekNumber = pendingEdit
    ? plan?.weeks[pendingEdit.weekIndex]?.weekNumber ?? null
    : null;
  const visibleExpandedWeekNumber = pendingEditWeekNumber ?? expandedWeekNumber;
  const routeOpenWeekNumber = parseBlockWeekNumber(routeParams.openWeekNumber);
  const routeOpenNonce = firstRouteParamValue(routeParams.blockReturnNonce);
  const processedOpenNonceRef = useRef<string | null>(null);

  function handleBlockScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollMetricsRef.current.y = event.nativeEvent.contentOffset.y;
  }

  function handleBlockScrollLayout(event: LayoutChangeEvent) {
    scrollMetricsRef.current.viewportHeight = event.nativeEvent.layout.height;
  }

  function handleWeekRowLayout(weekIndex: number, event: LayoutChangeEvent) {
    const { y, height } = event.nativeEvent.layout;
    weekRowLayoutRef.current[weekIndex] = { y, height };
  }

  function revealPendingRescheduleCta(weekIndex: number) {
    const rowLayout = weekRowLayoutRef.current[weekIndex];
    const scrollMetrics = scrollMetricsRef.current;

    if (!rowLayout || scrollMetrics.viewportHeight <= 0) {
      return;
    }

    const targetY = getRescheduleRevealScrollTarget({
      currentY: scrollMetrics.y,
      viewportHeight: scrollMetrics.viewportHeight,
      rowY: rowLayout.y,
      rowHeight: rowLayout.height,
    });

    if (targetY == null) {
      return;
    }

    blockScrollRef.current?.scrollTo({ y: targetY, animated: true });
    scrollMetricsRef.current.y = targetY;
  }

  useEffect(() => {
    if (!reschedule.hasChanges || rescheduleWeekIndex == null) {
      return;
    }

    const revealTimer = setTimeout(() => {
      revealPendingRescheduleCta(rescheduleWeekIndex);
    }, 260);

    return () => clearTimeout(revealTimer);
  }, [reschedule.hasChanges, rescheduleWeekIndex, reschedule.swapLog.length]);

  useEffect(() => {
    if (!isFocused || !plan || routeOpenWeekNumber == null || !routeOpenNonce) {
      return;
    }

    if (processedOpenNonceRef.current === routeOpenNonce) {
      return;
    }

    const nextIndex = plan.weeks.findIndex((week) => week.weekNumber === routeOpenWeekNumber);
    if (nextIndex === -1) {
      processedOpenNonceRef.current = routeOpenNonce;
      return;
    }

    processedOpenNonceRef.current = routeOpenNonce;
    setCollapsingWeekNumber(null);
    setExpandedWeekNumber(routeOpenWeekNumber);
    setRescheduleWeekIndex(nextIndex);
  }, [isFocused, plan, routeOpenNonce, routeOpenWeekNumber]);

  function toggleWeek(weekNumber: number) {
    if (!plan || reschedule.hasChanges) {
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

    try {
      setIsSavingRearrange(true);
      const updatedPlan = await applyBlockReschedule({
        weekIndex: rescheduleWeekIndex,
        swapLog: [...reschedule.swapLog],
        scope,
        targetPhase: plan.weeks[rescheduleWeekIndex]?.phase,
        targetSessions: [...reschedule.sessions],
      });
      if (updatedPlan) {
        replacePlan(preserveCurrentAnnotations(plan, updatedPlan));
      }
      setRescheduleScopeVisible(false);
      reschedule.reset();
    } catch (error) {
      console.error('Failed to rearrange sessions:', error);
    } finally {
      setIsSavingRearrange(false);
    }
  }

  function openSessionEditor(weekIndex: number, dayIndex: number) {
    const returnWeekNumber = plan?.weeks[weekIndex]?.weekNumber ?? null;
    router.push({
      pathname: '/edit-session',
      params: {
        weekIndex: String(weekIndex),
        dayIndex: String(dayIndex),
        ...blockSourceParams(returnWeekNumber),
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

    try {
      setIsSavingEdit(true);
      const updatedPlan = await propagatePlanChange({
        weekIndex: pendingEdit.weekIndex,
        dayIndex: pendingEdit.dayIndex,
        updated: updatedSession,
        scope,
        targetPhase: sourceWeek.phase,
      });
      if (updatedPlan) {
        replacePlan(preserveCurrentAnnotations(plan, updatedPlan));
      }
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

  if (authLoading || loading) {
    return { status: 'loading' };
  }

  if (!session) {
    return {
      status: 'signedOut',
      goToSettings: () => router.push('/(tabs)/settings'),
    };
  }

  if (!plan || plan.weeks.length === 0) {
    return {
      status: 'empty',
      goToPlanBuilder: () => router.push('/onboarding/plan-builder/step-goal'),
    };
  }

  if (!reviewModel) {
    return { status: 'unavailable' };
  }

  const phaseStrip = buildBlockPhaseStripModel({
    plan,
    safeCurrentWeekIndex,
    historicalInjury,
    injuryRange,
    today,
  });
  const maxKm = getMaxPlannedWeekKm(plan.weeks);
  const weekRows = buildBlockWeekRowModels({
    plan,
    safeCurrentWeekIndex,
    visibleExpandedWeekNumber,
    collapsingWeekNumber,
    rescheduleWeekIndex,
    rescheduleSessions: reschedule.sessions,
    rescheduleHasChanges: reschedule.hasChanges,
    rescheduleMovedDayIndexes: reschedule.movedDayIndexes,
    rescheduleDragState: reschedule.dragState,
    canDragRescheduleIndex: reschedule.canDragIndex,
    canDropRescheduleIndex: reschedule.canDropIndex,
    today,
    injuryRange,
    recoveryEntries: recoveryData.entries,
    recoveryEntriesLoading: recoveryData.isLoadingEntries,
    activityResolution,
    runDetailNavigation,
    units,
  });
  const reschedulePhaseName = rescheduleWeekIndex == null
    ? null
    : plan.weeks[rescheduleWeekIndex]?.phase ?? 'BUILD';
  const rescheduleModal =
    rescheduleScopeVisible && rescheduleWeekIndex != null && reschedulePhaseName
      ? {
          weekIndex: rescheduleWeekIndex,
          totalWeeks: plan.weeks.length,
          phaseName: reschedulePhaseName,
          phaseWeekCount: planPhaseWeekCount(plan, reschedulePhaseName),
          body: `You’ve rearranged this week. Choose whether the new layout stays local or carries into the rest of the ${formatPhaseName(reschedulePhaseName).toLowerCase()} phase.`,
          applyLabel: isSavingRearrange ? 'Applying…' : 'Apply reschedule',
          scopeLabels: {
            this: 'Just this week',
            remaining: 'This week + following weeks',
            build: `${formatPhaseName(reschedulePhaseName)} weeks only`,
          },
          onApply: applyPendingRearrange,
          onClose: () => setRescheduleScopeVisible(false),
        }
      : null;
  const pendingEditPhaseName = pendingEdit
    ? plan.weeks[pendingEdit.weekIndex]?.phase ?? 'BUILD'
    : null;
  const pendingEditModal =
    pendingEdit && pendingEditPhaseName
      ? {
          changeDesc: isSavingEdit ? 'Saving…' : pendingEdit.desc,
          weekIndex: pendingEdit.weekIndex,
          totalWeeks: plan.weeks.length,
          dayIndex: pendingEdit.dayIndex,
          sessionDate: plan.weeks[pendingEdit.weekIndex]?.sessions[pendingEdit.dayIndex]?.date ?? null,
          phaseName: pendingEditPhaseName,
          phaseWeekCount: planPhaseWeekCount(plan, pendingEditPhaseName),
          onApply: applyPendingEdit,
          onClose: () => setPendingEdit(null),
        }
      : null;

  return {
    status: 'ready',
    units,
    plan,
    reviewModel,
    safeCurrentWeekIndex,
    phaseStrip,
    maxKm,
    weekRows,
    refreshing: Boolean(refreshing || syncing),
    onRefresh: refreshManually,
    scrollRef: blockScrollRef,
    scrollEnabled: !reschedule.isHandleActive && !isScrubbingVolumeChart,
    onScroll: handleBlockScroll,
    onLayout: handleBlockScrollLayout,
    onWeekRowLayout: handleWeekRowLayout,
    onVolumeChartScrubActiveChange: setIsScrubbingVolumeChart,
    toggleWeek,
    openSessionEditor,
    openRunDetail: runDetailNavigation.openRunDetail,
    openRescheduleModal: () => setRescheduleScopeVisible(true),
    reschedule,
    onCollapseEnd: (weekNumber: number) => {
      setCollapsingWeekNumber((current) => (
        current === weekNumber ? null : current
      ));
    },
    rescheduleModal,
    pendingEditModal,
  };
}
