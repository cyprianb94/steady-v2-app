import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { C } from '../../../constants/colours';
import { SESSION_TYPE } from '../../../constants/session-types';
import { PHASE_COLOR } from '../../../constants/phase-meta';
import { FONTS } from '../../../constants/typography';
import { Btn } from '../../../components/ui/Btn';
import { SessionDot } from '../../../components/ui/SessionDot';
import { SessionRow } from '../../../components/plan-builder/SessionRow';
import { raceDateForPlanStartingThisWeek, todayIsoLocal } from '../../../lib/plan-helpers';
import { generatePlan, propagateChange, assignDates } from '@steady/types';
import { trpc } from '../../../lib/trpc';
import type { PlannedSession, PhaseConfig, PlanWeek } from '@steady/types';

export default function StepPlan() {
  const params = useLocalSearchParams<{
    race: string;
    weeks: string;
    target: string;
    phases: string;
    template: string;
  }>();

  const weeks = Number(params.weeks) || 16;
  const phases: PhaseConfig = JSON.parse(params.phases || '{}');
  const template: (PlannedSession | null)[] = JSON.parse(params.template || '[]');

  const [plan, setPlan] = useState<PlanWeek[]>(() => generatePlan(template, weeks, 0, phases));
  const [progState, setProgState] = useState<number | null>(null);
  const [customPct, setCustomPct] = useState('7');
  const [showCustom, setShowCustom] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const accept = (pct: number) => {
    setPlan(generatePlan(template, weeks, pct, phases));
    setProgState(pct);
  };

  const applyChange = (
    weekIndex: number,
    dayIndex: number,
    updated: Partial<PlannedSession> | null,
    scope: 'this' | 'remaining' | 'build',
  ) => {
    setPlan((prev) =>
      propagateChange(
        prev,
        weekIndex,
        dayIndex,
        updated as PlannedSession | null,
        scope,
        template,
        prev[weekIndex]?.phase,
      ),
    );
  };

  const maxKm = Math.max(...plan.map((w) => w.plannedKm), 1);

  const [saving, setSaving] = useState(false);

  const handleDone = async () => {
    setSaving(true);
    try {
      const today = todayIsoLocal();
      const raceDate = raceDateForPlanStartingThisWeek(today, weeks);
      const datedWeeks = assignDates(plan, raceDate);
      await trpc.plan.save.mutate({
        raceName: params.race || 'Race',
        raceDate,
        raceDistance: (params.race as any) || 'Marathon',
        targetTime: params.target || '',
        phases,
        progressionPct: progState ?? 0,
        templateWeek: template,
        weeks: datedWeeks,
      });
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error('Failed to save plan:', err);
      Alert.alert(
        'Could not save plan',
        err instanceof Error
          ? err.message
          : 'Please make sure you are signed in and the server is running.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.step}>STEP 3 OF 3</Text>
        <Text style={styles.title}>Your {weeks}-week plan</Text>
        <Text style={styles.subtitle}>
          {params.race} · {params.target} · Tap any week to edit sessions
        </Text>
      </View>

      {/* Progression card */}
      {progState === null && (
        <View style={styles.progCard}>
          <Text style={styles.progText}>
            <Text style={styles.progStrong}>Steady</Text> — Add progressive overload? Volume builds
            automatically through the build phase, then tapers before race day.
          </Text>
          {!showCustom ? (
            <View style={styles.progButtons}>
              <Pressable onPress={() => accept(7)} style={styles.progBtnPrimary}>
                <Text style={styles.progBtnPrimaryText}>Yes, +7% / 2 weeks</Text>
              </Pressable>
              <Pressable onPress={() => setShowCustom(true)} style={styles.progBtnSecondary}>
                <Text style={styles.progBtnSecondaryText}>Custom %</Text>
              </Pressable>
              <Pressable onPress={() => accept(0)} style={styles.progBtnSecondary}>
                <Text style={[styles.progBtnSecondaryText, { color: C.muted }]}>Keep flat</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.customRow}>
              {['5', '7', '10', '12', '15'].map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setCustomPct(p)}
                  style={[
                    styles.pctChip,
                    {
                      borderColor: customPct === p ? C.amber : C.border,
                      backgroundColor: customPct === p ? `${C.amber}18` : C.cream,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pctChipText,
                      { color: customPct === p ? C.amber : C.muted, fontWeight: customPct === p ? '700' : '400' },
                    ]}
                  >
                    {p}%
                  </Text>
                </Pressable>
              ))}
              <Pressable onPress={() => accept(Number(customPct) || 7)} style={styles.progBtnPrimary}>
                <Text style={styles.progBtnPrimaryText}>Apply {customPct}%</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {progState !== null && (
        <View style={styles.progConfirm}>
          <View style={styles.progConfirmLeft}>
            <Text style={styles.progCheckmark}>✓</Text>
            <Text style={styles.progConfirmText}>
              {progState === 0 ? 'Flat plan.' : `+${progState}% progression every 2 weeks.`}
            </Text>
          </View>
          <Pressable onPress={() => setProgState(null)}>
            <Text style={styles.progChangeBtn}>change</Text>
          </Pressable>
        </View>
      )}

      {/* Week list */}
      <ScrollView style={styles.weekList} contentContainerStyle={styles.weekListContent}>
        {plan.map((w, wi) => {
          const isExp = expanded === wi;
          const pc = PHASE_COLOR[w.phase] || PHASE_COLOR.BUILD;

          return (
            <View key={wi} style={{ marginBottom: 6 }}>
              {/* Week header row */}
              <Pressable
                onPress={() => setExpanded(isExp ? null : wi)}
                style={[
                  styles.weekHeader,
                  {
                    borderColor: isExp ? C.clay : C.border,
                    backgroundColor: isExp ? C.clayBg : C.surface,
                    borderBottomLeftRadius: isExp ? 0 : 12,
                    borderBottomRightRadius: isExp ? 0 : 12,
                  },
                ]}
              >
                <View style={styles.weekHeaderTop}>
                  <Text
                    style={[
                      styles.weekNum,
                      { color: isExp ? C.clay : C.muted, fontWeight: isExp ? '700' : '400' },
                    ]}
                  >
                    W{wi + 1}
                  </Text>
                  <View style={styles.dotRow}>
                    {w.sessions.map((d, di) => (
                      <SessionDot key={di} type={d?.type || 'REST'} size={8} />
                    ))}
                  </View>
                  <Text style={styles.weekKm}>{w.plannedKm}km</Text>
                  <View style={[styles.phaseBadge, { backgroundColor: `${pc}18` }]}>
                    <Text style={[styles.phaseBadgeText, { color: pc }]}>{w.phase}</Text>
                  </View>
                  <Text
                    style={[
                      styles.chevron,
                      { color: isExp ? C.clay : C.muted, transform: [{ rotate: isExp ? '90deg' : '0deg' }] },
                    ]}
                  >
                    ›
                  </Text>
                </View>
                {/* Volume bar */}
                <View style={styles.volumeBarBg}>
                  <View
                    style={[
                      styles.volumeBarFg,
                      {
                        width: `${Math.round((w.plannedKm / maxKm) * 100)}%`,
                        backgroundColor: pc,
                      },
                    ]}
                  />
                </View>
              </Pressable>

              {/* Expanded session rows */}
              {isExp && (
                <View style={styles.expandedBody}>
                  <Text style={styles.expandedHint}>
                    Edit sessions · any change will ask where to apply
                  </Text>
                  {w.sessions.map((d, di) => (
                    <SessionRow
                      key={di}
                      sess={d}
                      dayIndex={di}
                      weekIndex={wi}
                      totalWeeks={plan.length}
                      phaseName={w.phase}
                      phaseWeekCount={plan.filter((week) => week.phase === w.phase).length}
                      onChanged={(dayIdx, updated, scope) => applyChange(wi, dayIdx, updated, scope)}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <Btn title={saving ? "Saving..." : "Save plan and start training →"} onPress={handleDone} fullWidth disabled={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 60,
    paddingBottom: 6,
  },
  step: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    color: C.ink,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
    marginTop: 3,
  },
  // Progression card
  progCard: {
    marginHorizontal: 18,
    marginTop: 6,
    marginBottom: 8,
    backgroundColor: C.amberBg,
    borderWidth: 1.5,
    borderColor: `${C.amber}45`,
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
  },
  progText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink2,
    lineHeight: 20,
    marginBottom: 10,
  },
  progStrong: {
    color: C.amber,
    fontWeight: '600',
  },
  progButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  progBtnPrimary: {
    backgroundColor: C.amber,
    borderWidth: 1.5,
    borderColor: C.amber,
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  progBtnPrimaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: 'white',
  },
  progBtnSecondary: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  progBtnSecondaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink,
  },
  customRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  pctChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  pctChipText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
  },
  // Progression confirmed
  progConfirm: {
    marginHorizontal: 18,
    marginBottom: 8,
    backgroundColor: C.forestBg,
    borderWidth: 1,
    borderColor: `${C.forest}25`,
    borderRadius: 10,
    padding: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progConfirmLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progCheckmark: {
    color: C.forest,
    fontSize: 14,
  },
  progConfirmText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12.5,
    color: C.forest,
  },
  progChangeBtn: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  // Week list
  weekList: {
    flex: 1,
  },
  weekListContent: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  weekHeader: {
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  weekHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weekNum: {
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
  dotRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  weekKm: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.ink,
  },
  phaseBadge: {
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  phaseBadgeText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chevron: {
    fontFamily: FONTS.sans,
    fontSize: 13,
  },
  volumeBarBg: {
    marginTop: 7,
    height: 2,
    backgroundColor: C.border,
    borderRadius: 1,
    overflow: 'hidden',
  },
  volumeBarFg: {
    height: '100%',
    borderRadius: 1,
  },
  // Expanded
  expandedBody: {
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: C.clay,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: C.cream,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  expandedHint: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    color: C.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 6,
  },
  // Footer
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
});
