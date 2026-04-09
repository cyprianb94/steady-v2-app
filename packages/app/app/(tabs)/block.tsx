import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { usePlan } from '../../hooks/usePlan';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { PHASE_COLOR } from '../../constants/phase-meta';
import { SESSION_TYPE } from '../../constants/session-types';
import { addDaysIso, inferWeekStartDate, weekKm } from '../../lib/plan-helpers';
import { trpc } from '../../lib/trpc';
import {
  buildBlockPhaseSegments,
  getBlockVolumeTone,
  getInjuryWeekRange,
  getWeekVolumeRatio,
  isInjuryWeek,
  type CrossTrainingEntry,
  type PlanWeek,
  type SessionType,
} from '@steady/types';

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

export default function BlockTab() {
  const { plan, loading, currentWeekIndex } = usePlan();
  const [crossTrainingEntries, setCrossTrainingEntries] = useState<CrossTrainingEntry[]>([]);
  const [isLoadingCrossTraining, setIsLoadingCrossTraining] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const injury = plan?.activeInjury ?? null;
  const injuryRange = plan ? getInjuryWeekRange(plan.weeks, injury, today) : null;

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
  }, [injury?.markedDate, injury?.resolvedDate, injury?.status, plan]);

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

  const phases = buildBlockPhaseSegments(plan.weeks, currentWeekIndex, injury, today);
  const currentPhase = isInjuryWeek(currentWeekIndex, injuryRange)
    ? 'INJURY'
    : plan.weeks[currentWeekIndex]?.phase ?? 'BUILD';
  const maxKm = Math.max(...plan.weeks.map(weekKm), 1);
  return (
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
          {phases.map((p, i) => (
            <View
              key={i}
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
                style={[
                  styles.phaseLabel,
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
                {p.name}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.phaseCaption}>
          {getPhaseCaption(currentPhase, currentWeekIndex + 1, plan.weeks.length, injuryRange)}
        </Text>
      </View>

      {/* Week rows */}
      {plan.weeks.map((week, i) => {
        const isCurrent = i === currentWeekIndex;
        const isPast = i < currentWeekIndex;
        const injuryWeek = isInjuryWeek(i, injuryRange);
        const weekEntries = injuryWeek ? getWeekEntries(crossTrainingEntries, week) : [];
        const km = weekKm(week);

        return (
          <View
            key={week.weekNumber}
            style={[
              styles.weekRow,
              isCurrent && styles.weekRowCurrent,
              isPast && styles.weekRowPast,
              injuryWeek && styles.weekRowInjury,
            ]}
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
                            backgroundColor:
                              isPast || isCurrent
                                ? SESSION_TYPE[type].color
                                : C.border,
                            opacity: !isPast && !isCurrent ? 0.4 : 1,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              )}

              <View style={styles.weekRight}>
                <Text style={[styles.weekKm, isCurrent && { color: C.clay }, injuryWeek && styles.weekKmInjury]}>
                  {injuryWeek ? `${weekEntries.length} XT` : `${km}km`}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.volumeTrack,
                getBlockVolumeTone(i, currentWeekIndex) === 'current' && styles.volumeTrackCurrent,
              ]}
            >
              <View
                style={[
                  styles.volumeFill,
                  {
                    width: `${getWeekVolumeRatio(km, maxKm) * 100}%`,
                  },
                  getBlockVolumeTone(i, currentWeekIndex) === 'past' && styles.volumeFillPast,
                  getBlockVolumeTone(i, currentWeekIndex) === 'current' && styles.volumeFillCurrent,
                  getBlockVolumeTone(i, currentWeekIndex) === 'future' && styles.volumeFillFuture,
                ]}
              />
            </View>
          </View>
        );
      })}

      <View style={{ height: 40 }} />
    </ScrollView>
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
