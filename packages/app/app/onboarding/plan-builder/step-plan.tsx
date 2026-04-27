import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { C } from '../../../constants/colours';
import { SESSION_TYPE } from '../../../constants/session-types';
import { PHASE_COLOR } from '../../../constants/phase-meta';
import { FONTS } from '../../../constants/typography';
import { Btn } from '../../../components/ui/Btn';
import { SessionDot } from '../../../components/ui/SessionDot';
import { BlockVolumeCard } from '../../../components/plan-builder/BlockVolumeCard';
import { PropagateModal } from '../../../components/plan-builder/PropagateModal';
import { SessionEditorScreen } from '../../../components/plan-builder/SessionEditorScreen';
import { generatePlan, propagateChange, assignDates } from '@steady/types';
import type { BlockReviewTab, PhaseConfig, PhaseName, PlannedSession, PlanWeek, PropagateScope } from '@steady/types';
import {
  buildSessionEditDescription,
  materializeEditedSession,
} from '../../../features/plan-builder/session-editing';
import { getSharedPlanBuilderReviewComponent } from '../../../features/plan-builder/review-block-integration';
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

type ReviewTab = 'overview' | 'phases' | 'weeks';

const REVIEW_TABS: Array<{ key: ReviewTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'phases', label: 'Phases' },
  { key: 'weeks', label: 'Weeks' },
];

const PHASE_LABEL: Record<PhaseName, string> = {
  BASE: 'Base',
  BUILD: 'Build',
  RECOVERY: 'Recovery',
  PEAK: 'Peak',
  TAPER: 'Taper',
};

const PHASE_COPY: Record<PhaseName, string> = {
  BASE: 'Hold the rhythm while the routine settles.',
  BUILD: 'Main progression. Volume moves towards peak load.',
  RECOVERY: 'Absorb the work before the next push.',
  PEAK: 'Highest load. Sharpen without adding noise.',
  TAPER: 'Reduce volume and keep rhythm into race day.',
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeWholeNumber(value: string, maxLength = 2) {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function progressionPercent(value: string) {
  return clampNumber(Number(value) || 7, 0, 30);
}

function progressionEveryWeeks(value: string) {
  return clampNumber(Number(value) || 2, 1, 12);
}

function formatProgressionSummary(pct: number, everyWeeks: number) {
  if (pct === 0) {
    return 'Flat plan.';
  }

  return everyWeeks === 1
    ? `+${pct}% progression every week.`
    : `+${pct}% progression every ${everyWeeks} weeks.`;
}

function phaseSections(plan: PlanWeek[]) {
  return plan.reduce<Array<{ phase: PhaseName; start: number; end: number; weeks: PlanWeek[] }>>(
    (sections, week, index) => {
      const previous = sections[sections.length - 1];
      if (previous && previous.phase === week.phase) {
        previous.end = index;
        previous.weeks.push(week);
        return sections;
      }

      sections.push({ phase: week.phase, start: index, end: index, weeks: [week] });
      return sections;
    },
    [],
  );
}

function peakWeekIndex(plan: PlanWeek[]) {
  return plan.reduce((peakIndex, week, index) => (
    week.plannedKm > plan[peakIndex].plannedKm ? index : peakIndex
  ), 0);
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
  const [progEveryWeeks, setProgEveryWeeks] = useState(2);
  const [customPct, setCustomPct] = useState('7');
  const [customEveryWeeks, setCustomEveryWeeks] = useState('2');
  const [showCustom, setShowCustom] = useState(false);
  const [activeTab, setActiveTab] = useState<ReviewTab>('overview');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<EditingSession | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [reviewActiveTab, setReviewActiveTab] = useState<BlockReviewTab>('overview');
  const [reviewSelectedWeekIndex, setReviewSelectedWeekIndex] = useState<number | null>(null);

  const accept = (pct: number, everyWeeks = 2) => {
    const safePct = clampNumber(Math.round(pct), 0, 30);
    const safeEveryWeeks = clampNumber(Math.round(everyWeeks), 1, 12);
    setPlan(generatePlan(template, weeks, safePct, phases, safeEveryWeeks));
    setProgState(safePct);
    setProgEveryWeeks(safeEveryWeeks);
  };

  const acceptCustom = () => {
    const pct = progressionPercent(customPct);
    const everyWeeks = progressionEveryWeeks(customEveryWeeks);
    setCustomPct(String(pct));
    setCustomEveryWeeks(String(everyWeeks));
    accept(pct, everyWeeks);
  };

  const openWeek = (weekIndex: number) => {
    setActiveTab('weeks');
    setExpanded(weekIndex);
  };

  const handleChangeProgression = () => {
    setCustomPct(String(progState ?? progressionPercent(customPct)));
    setCustomEveryWeeks(String(progEveryWeeks));
    setShowCustom(true);
    setProgState(null);
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
  const SharedReviewBlock = getSharedPlanBuilderReviewComponent();

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
        progressionEveryWeeks: progEveryWeeks,
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

  const pendingEditModal = pendingEdit ? (
    <PropagateModal
      changeDesc={pendingEdit.desc}
      weekIndex={pendingEdit.weekIndex}
      totalWeeks={plan.length}
      phaseName={plan[pendingEdit.weekIndex]?.phase ?? 'BUILD'}
      phaseWeekCount={plan.filter((week) => week.phase === plan[pendingEdit.weekIndex]?.phase).length}
      onApply={applyPendingEdit}
      onClose={() => setPendingEdit(null)}
    />
  ) : null;

  if (SharedReviewBlock) {
    return (
      <>
        <SharedReviewBlock
          plan={plan}
          template={template}
          weeks={weeks}
          phases={phases}
          raceLabel={params.raceLabel || params.raceDistance || 'Race'}
          targetTime={params.targetTime || ''}
          progressionPct={progState}
          progressionEveryWeeks={progEveryWeeks}
          saving={saving}
          activeTab={reviewActiveTab}
          selectedWeekIndex={reviewSelectedWeekIndex}
          onApplyProgression={accept}
          onChangeProgression={handleChangeProgression}
          onTabChange={setReviewActiveTab}
          onSelectWeek={setReviewSelectedWeekIndex}
          onEditSession={openSessionEditor}
          onSavePlan={handleDone}
        />
        {pendingEditModal}
      </>
    );
  }

  const peakIndex = peakWeekIndex(plan);
  const overviewWeekIndexes = Array.from(new Set([0, peakIndex, plan.length - 1]));
  const sections = phaseSections(plan);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.step}>STEP 6 OF 6</Text>
        <Text style={styles.title}>Review your block</Text>
        <Text style={styles.subtitle}>
          {params.raceLabel || params.raceDistance} · {params.targetTime} · Tap any week to edit sessions
        </Text>
      </View>

      <ScrollView style={styles.weekList} contentContainerStyle={styles.weekListContent}>
        <BlockVolumeCard plan={plan} units={units} raceDate={params.raceDate} />

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
                  <Text style={styles.progBtnSecondaryText}>Custom</Text>
                </Pressable>
                <Pressable onPress={() => accept(0)} style={styles.progBtnSecondary}>
                  <Text style={[styles.progBtnSecondaryText, { color: C.muted }]}>Keep flat</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.customRow}>
                  {['5', '6', '7', '10'].map((p) => (
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
                </View>

                <View style={styles.customFields}>
                  <View style={styles.customField}>
                    <Text style={styles.customLabel}>Progression</Text>
                    <View style={styles.customInputWrap}>
                      <TextInput
                        testID="progression-pct-input"
                        value={customPct}
                        onChangeText={(value) => setCustomPct(sanitizeWholeNumber(value))}
                        keyboardType="number-pad"
                        style={styles.customInput}
                      />
                      <Text style={styles.customSuffix}>%</Text>
                    </View>
                  </View>
                  <View style={styles.customField}>
                    <Text style={styles.customLabel}>Every</Text>
                    <View style={styles.customInputWrap}>
                      <TextInput
                        testID="progression-every-weeks-input"
                        value={customEveryWeeks}
                        onChangeText={(value) => setCustomEveryWeeks(sanitizeWholeNumber(value, 2))}
                        keyboardType="number-pad"
                        style={styles.customInput}
                      />
                      <Text style={styles.customSuffix}>weeks</Text>
                    </View>
                  </View>
                  <Pressable onPress={acceptCustom} style={styles.progBtnPrimary}>
                    <Text style={styles.progBtnPrimaryText}>
                      Apply +{progressionPercent(customPct)}% / {progressionEveryWeeks(customEveryWeeks)}w
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}

        {progState !== null && (
          <View style={styles.progConfirm}>
            <View style={styles.progConfirmLeft}>
              <Text style={styles.progCheckmark}>✓</Text>
              <Text style={styles.progConfirmText}>
                {formatProgressionSummary(progState, progEveryWeeks)}
              </Text>
            </View>
            <Pressable onPress={handleChangeProgression}>
              <Text style={styles.progChangeBtn}>change</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.tabs} testID="review-tabs">
          {REVIEW_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                testID={`review-tab-${tab.key}`}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'overview' ? (
          <View style={styles.keyWeeks}>
            {overviewWeekIndexes.map((weekIndex) => {
              const week = plan[weekIndex];
              const isPeak = weekIndex === peakIndex;
              const isRace = weekIndex === plan.length - 1;
              const title = isRace ? 'Race week' : isPeak ? 'Peak week' : 'Settle into rhythm';
              const detail = isPeak
                ? `${formatDistance(week.plannedKm, units)} · Highest load`
                : `${formatDistance(week.plannedKm, units)} · ${PHASE_LABEL[week.phase]}`;

              return (
                <Pressable
                  key={`overview-${week.weekNumber}`}
                  onPress={() => openWeek(weekIndex)}
                  style={styles.keyWeekRow}
                >
                  <Text style={styles.keyWeekNo}>W{weekIndex + 1}</Text>
                  <View style={styles.keyWeekCopy}>
                    <Text style={styles.keyWeekTitle}>{title}</Text>
                    <Text style={styles.keyWeekDetail}>{detail}</Text>
                  </View>
                  <Text style={styles.keyWeekChevron}>›</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {activeTab === 'phases' ? (
          <View style={styles.phaseList}>
            {sections.map((section) => {
              const pc = PHASE_COLOR[section.phase] || PHASE_COLOR.BUILD;
              const sampleWeek = section.weeks[0];
              const rangeLabel = section.start === section.end
                ? `W${section.start + 1}`
                : `W${section.start + 1}-W${section.end + 1}`;

              return (
                <View key={`${section.phase}-${section.start}`} style={styles.phaseCard}>
                  <View style={styles.phaseCardTop}>
                    <View style={styles.phaseNameRow}>
                      <View style={[styles.phaseDot, { backgroundColor: pc }]} />
                      <Text style={styles.phaseName}>{PHASE_LABEL[section.phase]}</Text>
                    </View>
                    <Text style={styles.phaseRange}>{rangeLabel}</Text>
                  </View>
                  <Text style={styles.phaseCopy}>{PHASE_COPY[section.phase]}</Text>
                  <View style={styles.phaseSessionDots}>
                    {sampleWeek.sessions.map((session, index) => (
                      <SessionDot key={`${section.phase}-${index}`} type={session?.type || 'REST'} size={8} />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Week list */}
        {activeTab === 'weeks' ? plan.map((w, wi) => {
          const isExp = expanded === wi;
          const pc = PHASE_COLOR[w.phase] || PHASE_COLOR.BUILD;

          return (
            <View key={wi} style={{ marginBottom: 6 }}>
              {/* Week header row */}
              <Pressable
                testID={`plan-week-${wi + 1}-header`}
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
        }) : null}
      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <Btn title={saving ? "Saving..." : "Save plan and start training →"} onPress={handleDone} fullWidth disabled={saving} />
      </View>

      {pendingEditModal}
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
    marginHorizontal: 0,
    marginTop: 0,
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
    marginBottom: 10,
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
  customFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 8,
  },
  customField: {
    minWidth: 96,
  },
  customLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 5,
  },
  customInputWrap: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customInput: {
    minWidth: 24,
    paddingVertical: 0,
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.ink,
  },
  customSuffix: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11.5,
    color: C.muted,
  },
  // Progression confirmed
  progConfirm: {
    marginHorizontal: 0,
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
  tabs: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.card,
    padding: 4,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 4,
  },
  tab: {
    flex: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: C.surface,
  },
  tabText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11.5,
    color: C.muted,
  },
  tabTextActive: {
    color: C.ink,
  },
  keyWeeks: {
    gap: 8,
  },
  keyWeekRow: {
    minHeight: 78,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  keyWeekNo: {
    width: 42,
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: C.muted,
  },
  keyWeekCopy: {
    flex: 1,
    minWidth: 0,
  },
  keyWeekTitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: C.ink,
  },
  keyWeekDetail: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    color: C.muted,
    marginTop: 3,
  },
  keyWeekChevron: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: C.muted,
  },
  phaseList: {
    gap: 8,
  },
  phaseCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 14,
  },
  phaseCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  phaseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.ink,
  },
  phaseRange: {
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    color: C.muted,
  },
  phaseCopy: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.ink2,
    marginTop: 10,
  },
  phaseSessionDots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginTop: 12,
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
