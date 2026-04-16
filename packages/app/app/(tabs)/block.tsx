import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
  RefreshControl,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { usePlan } from '../../hooks/usePlan';
import { useStravaSync } from '../../hooks/useStravaSync';
import { useTodayIso } from '../../hooks/useTodayIso';
import { DragHandle } from '../../components/plan-builder/DragHandle';
import { PropagateModal } from '../../components/plan-builder/PropagateModal';
import { SessionEditor } from '../../components/plan-builder/SessionEditor';
import { Btn } from '../../components/ui/Btn';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { PHASE_COLOR } from '../../constants/phase-meta';
import { SESSION_TYPE } from '../../constants/session-types';
import { useDirectWeekReschedule } from '../../features/plan-builder/use-direct-week-reschedule';
import { useAuth } from '../../lib/auth';
import { createId } from '../../lib/id';
import { addDaysIso, DAYS, inferWeekStartDate, sessionLabel, todayIsoLocal, weekKm } from '../../lib/plan-helpers';
import { trpc } from '../../lib/trpc';
import { usePreferences } from '../../providers/preferences-context';
import { formatDistance, type DistanceUnits } from '../../lib/units';
import { useActivityResolution } from '../../features/run/use-activity-resolution';
import { useRecoveryData } from '../../features/recovery/use-recovery-data';
import { getVisibleHistoricalInjury, MVP_RECOVERY_UI_ENABLED } from '../../features/recovery/recovery-ui-gate';
import { usePlanRefreshCoordinator } from '../../features/sync/use-plan-refresh-coordinator';
import {
  buildBlockPhaseSegments,
  buildBlockWeekDayDetails,
  getBlockVolumeTone,
  getInjuryWeekRange,
  getWeekVolumeRatio,
  getWeekVolumeSummary,
  isInjuryWeek,
  propagateSwap,
  propagateChange,
  swapSessions,
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

function getStatusBadge(status: ReturnType<typeof buildBlockWeekDayDetails>[number]['status']): string | null {
  switch (status) {
    case 'completed':
      return '✓';
    case 'off-target':
      return '⚠';
    case 'missed':
      return '—';
    default:
      return null;
  }
}

interface PreservedRescheduleDraft {
  weekNumber: number;
  swapLog: SwapLogEntry[];
}

interface EditingDay {
  weekIndex: number;
  dayIndex: number;
}

interface PendingEdit {
  weekIndex: number;
  dayIndex: number;
  updated: Partial<PlannedSession> | null;
  desc: string;
}

function buildEditDescription(
  dayIndex: number,
  updated: Partial<PlannedSession> | null,
  units: DistanceUnits,
): string {
  return updated ? `${DAYS[dayIndex]} → ${sessionLabel(updated, units)}` : `${DAYS[dayIndex]} → Rest`;
}

function materializeSessionForWeek(
  week: PlanWeek,
  dayIndex: number,
  updated: Partial<PlannedSession> | null,
): PlannedSession | null {
  if (!updated || updated.type === 'REST') return null;

  const existing = week.sessions[dayIndex];
  return {
    ...existing,
    ...updated,
    type: updated.type ?? existing?.type ?? 'EASY',
    id: existing?.id ?? createId(),
    date: existing?.date ?? addDaysIso(getWeekStartDate(week), dayIndex),
  };
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
    const date = originalSession?.date ?? addDaysIso(getWeekStartDate(originalWeek), dayIndex);

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

function applySwapLogToSessions(
  sessions: (PlannedSession | null)[],
  swapLog: SwapLogEntry[],
) {
  return swapLog.reduce<(PlannedSession | null)[]>((current, swap) => {
    if (current[swap.from]?.actualActivityId || current[swap.to]?.actualActivityId) {
      return current;
    }

    return swapSessions(current, swap.from, swap.to);
  }, sessions);
}

function buildPendingRescheduleSummary(
  initialSessions: (PlannedSession | null)[],
  nextSessions: (PlannedSession | null)[],
) {
  const summaries = nextSessions.flatMap((session, index) => {
    if (!session) {
      return [];
    }

    const originalIndex = initialSessions.findIndex(
      (candidate) => candidate?.id === session.id,
    );

    if (originalIndex === -1 || originalIndex === index) {
      return [];
    }

    return `${SESSION_TYPE[session.type].label} moved to ${DAYS[index]}`;
  });

  return summaries.join('. ');
}

export default function BlockTab() {
  const { units } = usePreferences();
  const { session, isLoading: authLoading } = useAuth();
  const { plan, loading, currentWeekIndex, refresh } = usePlan();
  const isFocused = useIsFocused();
  const { requestAutoSync, forceSync, syncRevision, syncing } = useStravaSync();
  const [expandedWeekNumber, setExpandedWeekNumber] = useState<number | null>(null);
  const [rescheduleWeekIndex, setRescheduleWeekIndex] = useState<number | null>(null);
  const [rescheduleScopeVisible, setRescheduleScopeVisible] = useState(false);
  const [isSavingRearrange, setIsSavingRearrange] = useState(false);
  const [editingDay, setEditingDay] = useState<EditingDay | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [preservedReschedule, setPreservedReschedule] = useState<PreservedRescheduleDraft | null>(null);
  const today = useTodayIso();

  const activityResolution = useActivityResolution({
    enabled: Boolean(session),
    isFocused,
    planId: plan?.id,
    syncRevision,
    fetchErrorMessage: 'Failed to fetch activities for block view:',
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
    canDragDay: (nextSession) => Boolean(nextSession) && !nextSession?.actualActivityId,
    canDropDay: (nextSession) => !nextSession?.actualActivityId,
  });

  useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  useEffect(() => {
    if (!isFocused) {
      setExpandedWeekNumber(null);
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
    setRescheduleWeekIndex(restoredWeekIndex);
    reschedule.restoreDraft(
      applySwapLogToSessions(restoredWeek.sessions, preservedReschedule.swapLog),
      preservedReschedule.swapLog,
    );
    setPreservedReschedule(null);
  }, [plan, preservedReschedule, reschedule]);

  useEffect(() => {
    if (!reschedule.hasChanges) {
      setRescheduleScopeVisible(false);
    }
  }, [reschedule.hasChanges]);

  const { refreshManually } = usePlanRefreshCoordinator({
    enabled: Boolean(session),
    isFocused,
    requestAutoSync,
    forceSync,
    refreshPlan: refresh,
    syncRevision,
    autoSyncErrorMessage: 'Failed to auto-sync Strava on block focus:',
    syncRefreshErrorMessage: 'Failed to refresh block plan after Strava sync:',
    manualRefreshErrorMessage: 'Failed to refresh block screen:',
  });

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

  const safeCurrentWeekIndex = Math.min(currentWeekIndex, plan.weeks.length - 1);
  const phases = buildBlockPhaseSegments(plan.weeks, safeCurrentWeekIndex, historicalInjury, today);
  const currentPhase = isInjuryWeek(safeCurrentWeekIndex, injuryRange)
    ? 'INJURY'
    : plan.weeks[safeCurrentWeekIndex]?.phase ?? 'BUILD';
  const isHistoricalCurrentInjury = currentPhase === 'INJURY' && historicalInjury?.status === 'resolved';
  const maxKm = Math.max(...plan.weeks.map(weekKm), 1);
  const activitiesById = activityResolution.activityById;

  function toggleWeek(weekNumber: number) {
    if (reschedule.hasChanges) {
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedWeekNumber((current) => (current === weekNumber ? null : weekNumber));
  }

  async function applyPendingRearrange(scope: PropagateScope) {
    if (!plan || rescheduleWeekIndex == null || reschedule.swapLog.length === 0) return;
    const sourceWeek = plan.weeks[rescheduleWeekIndex];
    if (!sourceWeek) return;

    const nextWeeks = reschedule.swapLog.reduce(
      (weeks, swap) => propagateSwap(
        weeks,
        rescheduleWeekIndex,
        swap.from,
        swap.to,
        scope,
        sourceWeek.phase,
      ),
      plan.weeks,
    );


    try {
      setIsSavingRearrange(true);
      await trpc.plan.updateWeeks.mutate({ weeks: nextWeeks });
      await refresh();
      setRescheduleScopeVisible(false);
      reschedule.reset();
    } catch (error) {
      console.error('Failed to rearrange sessions:', error);
    } finally {
      setIsSavingRearrange(false);
    }
  }

  function handleDayEditSave(
    weekIndex: number,
    dayIndex: number,
    updated: Partial<PlannedSession> | null,
  ) {
    setEditingDay(null);
    setPendingEdit({
      weekIndex,
      dayIndex,
      updated,
      desc: buildEditDescription(dayIndex, updated, units),
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
      ),
      pendingEdit.dayIndex,
    );

    try {
      setIsSavingEdit(true);
      await trpc.plan.updateWeeks.mutate({ weeks: nextWeeks });
      await refresh();
      if (preservedDraft && preservedDraft.weekNumber > 0) {
        setPreservedReschedule(preservedDraft);
      }
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
        refreshControl={
          <RefreshControl
            refreshing={loading || syncing}
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
        const injuryWeek = isInjuryWeek(i, injuryRange);
        const isExpanded = expandedWeekNumber === week.weekNumber;
        const isRescheduleWeek = rescheduleWeekIndex === i;
        const displayWeek =
          isExpanded && isRescheduleWeek
            ? {
                ...week,
                sessions: reschedule.sessions,
                plannedKm: Math.round(weekKm(reschedule.sessions)),
              }
            : week;
        const weekEntries = injuryWeek ? getWeekEntries(recoveryData.entries, week) : [];
        const volumeTone = getBlockVolumeTone(i, safeCurrentWeekIndex);
        const volumeSummary = getWeekVolumeSummary(displayWeek, activitiesById, volumeTone);
        const blockDayDetails = buildBlockWeekDayDetails(displayWeek);
        const pendingSummary =
          isExpanded && isRescheduleWeek
            ? buildPendingRescheduleSummary(week.sessions, reschedule.sessions)
            : '';

        return (
          <View
            key={week.weekNumber}
            style={[
              styles.weekRow,
              isCurrent && styles.weekRowCurrent,
              isPast && styles.weekRowPast,
              injuryWeek && styles.weekRowInjury,
              isExpanded && isFuture && styles.weekRowFutureExpanded,
              isExpanded && styles.weekRowExpanded,
            ]}
          >
            <Pressable onPress={() => toggleWeek(week.weekNumber)} style={styles.weekPressable}>
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
                <View
                  style={[
                    styles.volumeFill,
                    {
                      width: `${getWeekVolumeRatio(volumeSummary.barKm, maxKm) * 100}%`,
                    },
                    volumeTone === 'past' && styles.volumeFillPast,
                    volumeTone === 'current' && styles.volumeFillCurrent,
                    volumeTone === 'future' && styles.volumeFillFuture,
                  ]}
                />
              </View>
            </Pressable>

            {isExpanded ? (
              <View
                style={[
                  styles.expandedWeek,
                  !isPast && styles.expandedWeekNoDivider,
                  isFuture && styles.expandedWeekFuture,
                ]}
              >
                {!injuryWeek ? (
                  <Text style={styles.weekGuide}>
                    {reschedule.hasChanges && isRescheduleWeek
                      ? 'Tap any unchanged row to edit it. The moved rows stay marked until you apply the reschedule.'
                      : 'Tap a day to adjust the session. Use the grip to reschedule it.'}
                  </Text>
                ) : null}

                {blockDayDetails.map((detail, dayIndex) => {
                  const badge = getStatusBadge(detail.status);
                  const session = displayWeek.sessions[dayIndex] ?? null;
                  const locked = Boolean(session?.actualActivityId);
                  const moved = isRescheduleWeek && reschedule.movedDayIndexes.has(dayIndex);
                  const dragging =
                    isExpanded && isRescheduleWeek && reschedule.dragState?.fromIndex === dayIndex;
                  const dropTarget =
                    isExpanded &&
                    isRescheduleWeek &&
                    reschedule.dragState?.overIndex === dayIndex &&
                    reschedule.dragState.fromIndex !== dayIndex;
                  const invalidDropTarget = Boolean(dropTarget && !reschedule.canDropIndex(dayIndex));
                  const canEditDay =
                    !injuryWeek &&
                    !locked &&
                    (!reschedule.hasChanges || !moved);
                  const canDragDay =
                    !injuryWeek &&
                    isExpanded &&
                    isRescheduleWeek &&
                    reschedule.canDragIndex(dayIndex);
                  const distanceLabel = session?.type === 'INTERVAL'
                    ? detail.distanceLabel
                    : session?.distance != null
                      ? formatDistance(session.distance, units)
                      : detail.distanceLabel;
                  return (
                    <Animated.View
                      key={`${week.weekNumber}-${detail.dayLabel}`}
                      style={[
                        styles.dayRowWrap,
                        dragging && { transform: [{ translateY: reschedule.dragY }] },
                      ]}
                    >
                      <View
                        style={[
                          styles.dayRow,
                          isFuture && styles.dayRowFuture,
                          canEditDay && styles.dayRowEditable,
                          canEditDay && isFuture && styles.dayRowFutureEditable,
                          moved && styles.dayRowMoved,
                          locked && styles.dayRowLocked,
                          dropTarget && styles.dayRowDropTarget,
                          invalidDropTarget && styles.dayRowInvalidDropTarget,
                          dragging && styles.dayRowDragging,
                        ]}
                      >
                        <Pressable
                          testID={`block-day-${week.weekNumber}-${dayIndex}`}
                          disabled={!canEditDay}
                          onPress={canEditDay ? () => setEditingDay({ weekIndex: i, dayIndex }) : undefined}
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
                            <Text style={[styles.daySessionLabel, detail.isRest && styles.daySessionLabelRest]}>
                              {detail.sessionLabel}
                            </Text>
                          </View>
                        </Pressable>

                        <View style={styles.dayRight}>
                          {distanceLabel ? (
                            <Text style={styles.dayDistance}>{distanceLabel}</Text>
                          ) : null}
                          {locked ? (
                            <Text style={[styles.dayStatusChip, styles.dayStatusChipLocked]}>Logged</Text>
                          ) : moved ? (
                            <Text style={[styles.dayStatusChip, styles.dayStatusChipMoved]}>Moved</Text>
                          ) : canEditDay ? (
                            <Text style={styles.dayEdit}>Edit</Text>
                          ) : null}
                          {badge && !locked ? (
                            <Text
                              style={[
                                styles.dayBadge,
                                detail.status === 'completed' && styles.dayBadgeComplete,
                                detail.status === 'off-target' && styles.dayBadgeWarning,
                                detail.status === 'missed' && styles.dayBadgeMissed,
                              ]}
                            >
                              {badge}
                            </Text>
                          ) : null}
                          {!injuryWeek ? (
                            <DragHandle
                              testID={`block-drag-handle-${week.weekNumber}-${dayIndex}`}
                              disabled={!canDragDay}
                              active={dragging}
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
                              onLongPress={() => {
                                reschedule.beginDrag(dayIndex);
                              }}
                              onTouchMove={(event) => {
                                event.stopPropagation?.();
                                reschedule.updateDrag(event.nativeEvent.pageY);
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
                    <View style={styles.pendingCopy}>
                      <Text style={styles.pendingLabel}>
                        {`${reschedule.swapLog.length} reschedule${reschedule.swapLog.length === 1 ? '' : 's'} pending`}
                      </Text>
                      <Text style={styles.pendingText}>
                        {pendingSummary || 'Review the new order, then choose where it should apply.'}
                      </Text>
                    </View>
                    <View style={styles.pendingActions}>
                      <Pressable
                        testID="block-reschedule-reset"
                        onPress={() => reschedule.reset()}
                        style={styles.pendingSecondary}
                      >
                        <Text style={styles.pendingSecondaryText}>Reset</Text>
                      </Pressable>
                      <Pressable
                        testID="block-apply-reschedule"
                        onPress={() => setRescheduleScopeVisible(true)}
                        style={styles.pendingPrimary}
                      >
                        <Text style={styles.pendingPrimaryText}>Apply reschedule</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={{ height: 40 }} />
      </ScrollView>
      {rescheduleScopeVisible && rescheduleWeekIndex != null ? (
        <PropagateModal
          changeDesc={`${reschedule.swapLog.length} reschedule${reschedule.swapLog.length === 1 ? '' : 's'} staged`}
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
      {editingDay ? (
        <SessionEditor
          dayIndex={editingDay.dayIndex}
          existing={plan.weeks[editingDay.weekIndex]?.sessions[editingDay.dayIndex] ?? null}
          onSave={(dayIndex, updated) => handleDayEditSave(editingDay.weekIndex, dayIndex, updated)}
          onClose={() => setEditingDay(null)}
        />
      ) : null}
      {pendingEdit ? (
        <PropagateModal
          changeDesc={isSavingEdit ? 'Saving…' : pendingEdit.desc}
          weekIndex={pendingEdit.weekIndex}
          totalWeeks={plan.weeks.length}
          phaseName={plan.weeks[pendingEdit.weekIndex]?.phase ?? 'BUILD'}
          phaseWeekCount={plan.weeks.filter((week) => week.phase === plan.weeks[pendingEdit.weekIndex]?.phase).length}
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
  expandedWeek: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    gap: 10,
  },
  expandedWeekNoDivider: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  expandedWeekFuture: {
    gap: 6,
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
    minHeight: 28,
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
  dayRowMoved: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: `${C.clay}35`,
  },
  dayRowLocked: {
    opacity: 0.74,
  },
  dayRowDropTarget: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.clay,
    backgroundColor: C.clayBg,
  },
  dayRowInvalidDropTarget: {
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  dayRowDragging: {
    shadowColor: C.clay,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dayRowFuture: {
    minHeight: 34,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FBF7F0',
  },
  dayRowFutureEditable: {
    backgroundColor: C.surface,
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
  dayDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dayDotRest: {
    backgroundColor: C.slate,
  },
  daySessionLabel: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.ink,
  },
  daySessionLabelRest: {
    color: C.muted,
  },
  dayRight: {
    minWidth: 104,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  dayEdit: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.clay,
    textTransform: 'uppercase',
  },
  dayDistance: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.ink2,
  },
  dayStatusChip: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  dayStatusChipMoved: {
    color: C.clay,
    backgroundColor: C.clayBg,
  },
  dayStatusChipLocked: {
    color: C.forest,
    backgroundColor: C.forestBg,
  },
  dayBadge: {
    minWidth: 16,
    textAlign: 'center',
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
  },
  dayBadgeComplete: {
    color: C.forest,
  },
  dayBadgeWarning: {
    color: C.amber,
  },
  dayBadgeMissed: {
    color: C.muted,
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
  pendingCopy: {
    gap: 4,
  },
  pendingLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: C.clay,
  },
  pendingText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.ink2,
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
