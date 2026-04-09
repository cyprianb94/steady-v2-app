import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { usePlan } from '../../hooks/usePlan';
import { RearrangeSheet } from '../../components/block/RearrangeSheet';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { PHASE_COLOR } from '../../constants/phase-meta';
import { SESSION_TYPE } from '../../constants/session-types';
import { addDaysIso, inferWeekStartDate, weekKm } from '../../lib/plan-helpers';
import { trpc } from '../../lib/trpc';
import {
  buildBlockPhaseSegments,
  buildBlockWeekDayDetails,
  getBlockVolumeTone,
  getInjuryWeekRange,
  getWeekVolumeRatio,
  getWeekVolumeSummary,
  isInjuryWeek,
  type Activity,
  type BlockPhaseSegment,
  type CrossTrainingEntry,
  type PlannedSession,
  type PlanWeek,
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

function getWeekStartDate(week: PlanWeek): string {
  const fallbackDate =
    week.sessions.find((session) => session?.date)?.date ??
    new Date().toISOString().slice(0, 10);
  return inferWeekStartDate(week, fallbackDate);
}

function getWeekEntries(entries: CrossTrainingEntry[], week: PlanWeek): CrossTrainingEntry[] {
  const startDate = getWeekStartDate(week);
  const endDate = addDaysIso(startDate, 6);
  return entries.filter((entry) => entry.date >= startDate && entry.date <= endDate);
}

function getPhaseCaption(
  currentPhase: PlanWeek['phase'] | 'INJURY',
  currentWeekNumber: number,
  totalWeeks: number,
  injuryRange: ReturnType<typeof getInjuryWeekRange>,
): string {
  if (currentPhase === 'INJURY' && injuryRange) {
    return `INJURY phase · Weeks ${injuryRange.startIndex + 1}-${injuryRange.endIndex + 1} affected`;
  }

  return `${currentPhase} phase · Week ${currentWeekNumber} of ${totalWeeks}`;
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

function isFullyCompletedWeek(week: PlanWeek): boolean {
  return (
    week.sessions.length === 7 &&
    week.sessions.every((session) => Boolean(session?.actualActivityId))
  );
}

export default function BlockTab() {
  const { plan, loading, currentWeekIndex, refresh } = usePlan();
  const isFocused = useIsFocused();
  const [expandedWeekNumber, setExpandedWeekNumber] = useState<number | null>(null);
  const [rearrangeWeekIndex, setRearrangeWeekIndex] = useState<number | null>(null);
  const [isSavingRearrange, setIsSavingRearrange] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [crossTrainingEntries, setCrossTrainingEntries] = useState<CrossTrainingEntry[]>([]);
  const [isLoadingCrossTraining, setIsLoadingCrossTraining] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const activeInjury =
    plan?.activeInjury && plan.activeInjury.status !== 'resolved' ? plan.activeInjury : null;
  const injuryRange = plan ? getInjuryWeekRange(plan.weeks, activeInjury, today) : null;

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
      setActivities([]);
      return;
    }

    let cancelled = false;

    async function fetchActivities() {
      try {
        const nextActivities = await trpc.activity.list.query();
        if (!cancelled) {
          setActivities(nextActivities);
        }
      } catch (error) {
        console.error('Failed to fetch activities for block view:', error);
        if (!cancelled) {
          setActivities([]);
        }
      }
    }

    fetchActivities();

    return () => {
      cancelled = true;
    };
  }, [plan?.id]);

  useEffect(() => {
    if (!plan || !injuryRange) {
      setCrossTrainingEntries([]);
      setIsLoadingCrossTraining(false);
      return;
    }

    const startWeek = plan.weeks[injuryRange.startIndex];
    const endWeek = plan.weeks[injuryRange.endIndex];
    if (!startWeek || !endWeek) {
      setCrossTrainingEntries([]);
      setIsLoadingCrossTraining(false);
      return;
    }

    const startDate = getWeekStartDate(startWeek);
    const endDate = addDaysIso(getWeekStartDate(endWeek), 6);
    let cancelled = false;

    async function fetchCrossTraining() {
      try {
        setIsLoadingCrossTraining(true);
        const entries = await trpc.crossTraining.getForDateRange.query({ startDate, endDate });
        if (!cancelled) {
          setCrossTrainingEntries(entries);
        }
      } catch (error) {
        console.error('Failed to fetch block cross-training entries:', error);
        if (!cancelled) {
          setCrossTrainingEntries([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCrossTraining(false);
        }
      }
    }

    fetchCrossTraining();

    return () => {
      cancelled = true;
    };
  }, [activeInjury?.markedDate, activeInjury?.resolvedDate, activeInjury?.status, plan]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No plan yet</Text>
        <Text style={styles.muted}>Build a plan from the Week tab to see the block view.</Text>
      </View>
    );
  }

  const phases = buildBlockPhaseSegments(plan.weeks, currentWeekIndex, activeInjury, today);
  const currentPhase = isInjuryWeek(currentWeekIndex, injuryRange)
    ? 'INJURY'
    : plan.weeks[currentWeekIndex]?.phase ?? 'BUILD';
  const maxKm = Math.max(...plan.weeks.map(weekKm), 1);
  const activitiesById = new Map(activities.map((activity) => [activity.id, activity] as const));

  function toggleWeek(weekNumber: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedWeekNumber((current) => (current === weekNumber ? null : weekNumber));
  }

  async function handleRearrangeDone(
    sessions: (PlannedSession | null)[],
    swapLog: SwapLogEntry[],
  ) {
    if (!plan || rearrangeWeekIndex == null) return;

    const nextWeeks = plan.weeks.map((week, index) => {
      if (index !== rearrangeWeekIndex) return week;
      return {
        ...week,
        sessions,
        plannedKm: Math.round(weekKm(sessions)),
        swapLog: [...(week.swapLog ?? []), ...swapLog],
      };
    });

    try {
      setIsSavingRearrange(true);
      await trpc.plan.updateWeeks.mutate({ weeks: nextWeeks });
      await refresh();
      setRearrangeWeekIndex(null);
    } catch (error) {
      console.error('Failed to rearrange sessions:', error);
    } finally {
      setIsSavingRearrange(false);
    }
  }

  const rearrangeWeek = rearrangeWeekIndex == null ? null : plan.weeks[rearrangeWeekIndex] ?? null;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Race header */}
        <View style={styles.header}>
          <Text style={styles.label}>GOAL RACE</Text>
          <Text style={styles.raceTitle}>{plan.raceName}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaValue, { color: C.clay }]}>{plan.raceDate}</Text>
            <Text style={[styles.metaValue, { color: C.muted }]}>
              {plan.weeks.length - currentWeekIndex} weeks out
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

            return (
              <View
                key={i}
                accessibilityLabel={`${p.name} phase, ${p.weeks} ${p.weeks === 1 ? 'week' : 'weeks'}`}
                style={[
                  styles.phaseSegment,
                  {
                    flex: p.weeks,
                    backgroundColor:
                      p.name === 'INJURY'
                        ? p.isCurrent
                          ? C.clay
                          : C.clayBg
                        : p.isCurrent
                          ? PHASE_COLOR[p.name]
                          : C.border,
                    borderWidth: p.name === 'INJURY' && !p.isCurrent ? 1 : 0,
                    borderColor: p.name === 'INJURY' ? `${C.clay}35` : 'transparent',
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
                          ? p.isCurrent
                            ? 'white'
                            : C.clay
                          : p.isCurrent
                            ? 'white'
                            : C.muted,
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
          {getPhaseCaption(currentPhase, currentWeekIndex + 1, plan.weeks.length, injuryRange)}
        </Text>
      </View>

      {/* Week rows */}
      {plan.weeks.map((week, i) => {
        const isCurrent = i === currentWeekIndex;
        const isPast = i < currentWeekIndex;
        const isFuture = i > currentWeekIndex;
        const injuryWeek = isInjuryWeek(i, injuryRange);
        const isExpanded = expandedWeekNumber === week.weekNumber;
        const weekEntries = injuryWeek ? getWeekEntries(crossTrainingEntries, week) : [];
        const volumeTone = getBlockVolumeTone(i, currentWeekIndex);
        const volumeSummary = getWeekVolumeSummary(week, activitiesById, volumeTone);
        const blockDayDetails = buildBlockWeekDayDetails(week);
        const canRearrange = !injuryWeek && !isFullyCompletedWeek(week);

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
                    {isLoadingCrossTraining ? (
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
                    {week.sessions.map((s, d) => {
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
                      <Text style={styles.weekKmActual}>{volumeSummary.actualKm}km</Text>
                      <Text style={styles.weekKmDivider}> / </Text>
                      <Text style={styles.weekKmPlanned}>{volumeSummary.plannedKm}km</Text>
                    </Text>
                  ) : (
                    <Text style={[styles.weekKm, isCurrent && { color: C.clay }]}>
                      {volumeSummary.plannedKm}km
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
                {canRearrange ? (
                  <Pressable
                    testID={`rearrange-week-${week.weekNumber}`}
                    onPress={() => setRearrangeWeekIndex(i)}
                    style={styles.rearrangeButton}
                  >
                    <Text style={styles.rearrangeButtonText}>
                      {isSavingRearrange && rearrangeWeekIndex === i ? 'Saving...' : 'Rearrange sessions'}
                    </Text>
                  </Pressable>
                ) : null}

                {blockDayDetails.map((detail) => {
                  const badge = getStatusBadge(detail.status);
                  return (
                    <View
                      key={`${week.weekNumber}-${detail.dayLabel}`}
                      style={[styles.dayRow, isFuture && styles.dayRowFuture]}
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

                      <View style={styles.dayRight}>
                        {detail.distanceLabel ? (
                          <Text style={styles.dayDistance}>{detail.distanceLabel}</Text>
                        ) : null}
                        {badge ? (
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
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={{ height: 40 }} />
      </ScrollView>
      {rearrangeWeek ? (
        <RearrangeSheet
          visible={Boolean(rearrangeWeek)}
          weekNumber={rearrangeWeek.weekNumber}
          sessions={rearrangeWeek.sessions}
          onCancel={() => setRearrangeWeekIndex(null)}
          onDone={handleRearrangeDone}
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
    height: 26,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 5,
  },
  phaseSegment: {
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 8,
  },
  expandedWeekNoDivider: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  expandedWeekFuture: {
    gap: 6,
  },
  rearrangeButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${C.clay}45`,
    backgroundColor: C.clayBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  rearrangeButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.clay,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  dayRowFuture: {
    minHeight: 34,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FBF7F0',
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
    minWidth: 74,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  dayDistance: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.ink2,
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
