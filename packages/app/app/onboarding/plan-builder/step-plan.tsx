import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { C } from '../../../constants/colours';
import { SESSION_TYPE } from '../../../constants/session-types';
import { PHASE_COLOR } from '../../../constants/phase-meta';
import { FONTS } from '../../../constants/typography';
import { Btn } from '../../../components/ui/Btn';
import { SessionDot } from '../../../components/ui/SessionDot';
import { PropagateModal } from '../../../components/plan-builder/PropagateModal';
import { SessionEditorScreen } from '../../../components/plan-builder/SessionEditorScreen';
import { generatePlan, propagateChange, assignDates } from '@steady/types';
import type { PhaseConfig, PlannedSession, PlanWeek, PropagateScope } from '@steady/types';
import {
  buildSessionEditDescription,
  materializeEditedSession,
} from '../../../features/plan-builder/session-editing';
import { savePlan } from '../../../lib/plan-api';
import { usePreferences } from '../../../providers/preferences-context';
import { formatDistance } from '../../../lib/units';
import { DAYS, sessionLabel } from '../../../lib/plan-helpers';

interface EditingSession {
  weekIndex: number;
  dayIndex: number;
}

interface PendingEdit extends EditingSession {
  updated: Partial<PlannedSession> | null;
  desc: string;
}

export default function StepPlan() {
  const { units } = usePreferences();
  const params = useLocalSearchParams<{
    raceDistance: string;
    raceLabel: string;
    raceName: string;
    raceDate: string;
    weeks: string;
    targetTime: string;
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
  const [editing, setEditing] = useState<EditingSession | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);

  const accept = (pct: number) => {
    setPlan(generatePlan(template, weeks, pct, phases));
    setProgState(pct);
  };

  function openSessionEditor(weekIndex: number, dayIndex: number) {
    setEditing({ weekIndex, dayIndex });
  }

  function handleEditorSave(dayIndex: number, updated: Partial<PlannedSession> | null) {
    if (!editing) {
      return;
    }

    setPendingEdit({
      weekIndex: editing.weekIndex,
      dayIndex,
      updated,
      desc: buildSessionEditDescription(dayIndex, updated, units),
    });
    setEditing(null);
  }

  function applyPendingEdit(scope: PropagateScope) {
    if (!pendingEdit) {
      return;
    }

    setPlan((prev) => {
      const sourceWeek = prev[pendingEdit.weekIndex];
      if (!sourceWeek) {
        return prev;
      }

      const existing = sourceWeek.sessions[pendingEdit.dayIndex] ?? null;
      const updatedSession = materializeEditedSession(existing, pendingEdit.updated, {
        id: existing?.id ?? `preview-w${pendingEdit.weekIndex + 1}d${pendingEdit.dayIndex}`,
        date: existing?.date ?? 'preview',
        type: existing?.type ?? 'EASY',
      });

      return propagateChange(
        prev,
        pendingEdit.weekIndex,
        pendingEdit.dayIndex,
        updatedSession,
        scope,
        template,
        sourceWeek.phase,
      );
    });

    setPendingEdit(null);
  }

  const maxKm = Math.max(...plan.map((w) => w.plannedKm), 1);

  const [saving, setSaving] = useState(false);

  const handleDone = async () => {
    setSaving(true);
    try {
      const raceDate = params.raceDate || new Date().toISOString().slice(0, 10);
      const datedWeeks = assignDates(plan, raceDate);
      await savePlan({
        raceName: params.raceName || params.raceLabel || params.raceDistance || 'Race',
        raceDate,
        raceDistance: (params.raceDistance as any) || 'Marathon',
        targetTime: params.targetTime || '',
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

  if (editing) {
    return (
      <SessionEditorScreen
        dayIndex={editing.dayIndex}
        existing={plan[editing.weekIndex]?.sessions[editing.dayIndex] ?? null}
        onSave={handleEditorSave}
        onClose={() => setEditing(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.step}>STEP 3 OF 3</Text>
        <Text style={styles.title}>Your {weeks}-week plan</Text>
        <Text style={styles.subtitle}>
          {params.raceLabel || params.raceDistance} · {params.targetTime} · Tap any week to edit sessions
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
                  <Text style={styles.weekKm}>{formatDistance(w.plannedKm, units)}</Text>
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
                    <Pressable
                      key={di}
                      testID={`plan-week-${wi + 1}-day-${di}`}
                      onPress={() => openSessionEditor(wi, di)}
                      style={({ pressed }) => [
                        styles.sessionEditRow,
                        pressed && styles.sessionEditRowPressed,
                      ]}
                    >
                      <View style={styles.sessionEditDay}>
                        <Text style={styles.sessionEditDayLabel}>{DAYS[di]}</Text>
                      </View>
                      <View style={styles.sessionEditMain}>
                        <SessionDot type={d?.type || 'REST'} size={8} />
                        <View style={styles.sessionEditCopy}>
                          <Text style={styles.sessionEditTitle} numberOfLines={1}>
                            {d && d.type !== 'REST' ? sessionLabel(d, units) : 'Rest day'}
                          </Text>
                          <Text style={styles.sessionEditMeta} numberOfLines={1}>
                            {d && d.type !== 'REST' ? SESSION_TYPE[d.type].label : 'Recovery'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.sessionEditChevron}>›</Text>
                    </Pressable>
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

      {pendingEdit ? (
        <PropagateModal
          changeDesc={pendingEdit.desc}
          weekIndex={pendingEdit.weekIndex}
          totalWeeks={plan.length}
          phaseName={plan[pendingEdit.weekIndex]?.phase ?? 'BUILD'}
          phaseWeekCount={plan.filter((week) => week.phase === plan[pendingEdit.weekIndex]?.phase).length}
          onApply={applyPendingEdit}
          onClose={() => setPendingEdit(null)}
        />
      ) : null}
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
  sessionEditRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  sessionEditRowPressed: {
    opacity: 0.7,
  },
  sessionEditDay: {
    width: 34,
  },
  sessionEditDayLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.muted,
  },
  sessionEditMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionEditCopy: {
    flex: 1,
    minWidth: 0,
  },
  sessionEditTitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12.5,
    color: C.ink,
  },
  sessionEditMeta: {
    fontFamily: FONTS.sans,
    fontSize: 10.5,
    color: C.muted,
    marginTop: 1,
  },
  sessionEditChevron: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: C.muted,
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
