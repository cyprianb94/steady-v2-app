import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  buildStructuredQualitySummary,
  expectedDistance,
  formatNiggleSummary,
  type PlannedSession,
  type Shoe,
  type SubjectiveBreathing,
  type SubjectiveLegs,
  type SubjectiveOverall,
} from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { usePlan } from '../../hooks/usePlan';
import { usePreferences } from '../../providers/preferences-context';
import {
  formatDistance,
  formatIntensityTargetDisplay,
  formatPace,
  formatSessionTitle,
} from '../../lib/units';
import { shoeWearState } from '../../features/sync/sync-run-detail';
import { useRunDetailController } from '../../features/sync/use-run-detail-controller';
import { MatchPickerModal } from '../../components/sync-run/MatchPickerModal';
import { NigglePickerModal } from '../../components/sync-run/NigglePickerModal';
import { ShoePickerModal } from '../../components/sync-run/ShoePickerModal';
import { FuellingCard } from '../../components/sync-run/FuellingCard';
import { QualitySummaryCard } from '../../components/run/QualitySummaryCard';
import { qualitySummaryCardProps } from '../../features/run/quality-summary-display';
import {
  buildAveragePaceComparison,
  buildTargetAwareSplitsModel,
  type AveragePaceComparisonDirection,
  type TargetAwareSplitTargetStatus,
} from '../../features/run/target-aware-splits';

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hrs > 0
    ? `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatRunMeta(startTime: string): string {
  const value = new Date(startTime);
  const weekday = value.toLocaleDateString([], { weekday: 'short' });
  const monthDay = value.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const time = value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${weekday} ${monthDay} · ${time}`;
}

function shoeLabel(shoe: Shoe): string {
  return `${shoe.brand} ${shoe.model}`;
}

function splitTargetDisplay(value: string): { pace: string | null; effort: string | null } {
  if (!value || value === '—') {
    return { pace: value, effort: null };
  }

  const [first, ...rest] = value.split(' · ');
  const hasPace = first.includes(':') || first.includes('/km') || first.includes('/mi');

  if (!hasPace) {
    return { pace: null, effort: value };
  }

  return {
    pace: first,
    effort: rest.length ? rest.join(' · ') : null,
  };
}

function formatPlannedActualPaceUnit(value: string): string {
  return value.replace(/\s*\/(km|mi)\b/g, ' min/$1');
}

function firstRouteParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}

function targetStatusStyle(status: TargetAwareSplitTargetStatus | null) {
  switch (status) {
    case 'on-target':
      return styles.splitComparisonOnTarget;
    case 'fast':
    case 'slow':
      return styles.splitComparisonVaried;
    default:
      return null;
  }
}

function averageSegmentAnchorStyle(direction: AveragePaceComparisonDirection) {
  return direction === 'fast' ? styles.averageRailSegmentFast : styles.averageRailSegmentSlow;
}

const LEGS_OPTIONS: { value: SubjectiveLegs; label: string }[] = [
  { value: 'fresh', label: 'Fresh' },
  { value: 'normal', label: 'Normal' },
  { value: 'heavy', label: 'Heavy' },
  { value: 'dead', label: 'Dead' },
];

const BREATHING_OPTIONS: { value: SubjectiveBreathing; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'controlled', label: 'Controlled' },
  { value: 'labored', label: 'Labored' },
];

const OVERALL_OPTIONS: { value: SubjectiveOverall; label: string }[] = [
  { value: 'could-go-again', label: 'Could go again' },
  { value: 'done', label: 'Done' },
  { value: 'shattered', label: 'Shattered' },
];

function feelSemanticStyles(value: string | null) {
  if (!value) {
    return {};
  }

  if (value === 'dead' || value === 'shattered') {
    return {
      chip: styles.feelChipSelectedHard,
      text: styles.feelChipTextSelectedHard,
    };
  }

  if (value === 'heavy' || value === 'labored' || value === 'done') {
    return {
      chip: styles.feelChipSelectedWorked,
      text: styles.feelChipTextSelectedWorked,
    };
  }

  return {
    chip: styles.feelChipSelectedRecoverable,
    text: styles.feelChipTextSelectedRecoverable,
  };
}

function FeelRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.feelRow}>
      <Text style={styles.feelLabel}>{label}</Text>
      <View style={styles.feelChips}>
        {options.map((opt) => {
          const selected = opt.value === value;
          const semantic = selected ? feelSemanticStyles(opt.value) : {};
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[styles.feelChip, semantic.chip]}
            >
              <Text style={[styles.feelChipText, semantic.text]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function SyncRunDetailScreen() {
  const { activityId: rawActivityId, sessionId: rawSessionId } = useLocalSearchParams<{
    activityId?: string | string[];
    sessionId?: string | string[];
  }>();
  const activityId = useMemo(
    () => firstRouteParamValue(rawActivityId),
    [rawActivityId],
  );
  const requestedSessionId = useMemo(
    () => firstRouteParamValue(rawSessionId),
    [rawSessionId],
  );
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { units } = usePreferences();
  const { currentWeek, refresh: refreshPlan } = usePlan();
  const [showMatchPicker, setShowMatchPicker] = useState(false);
  const [showShoePicker, setShowShoePicker] = useState(false);
  const [showNigglePicker, setShowNigglePicker] = useState(false);
  const [selectedAverageSplitId, setSelectedAverageSplitId] = useState<string | null>(null);
  const {
    activity,
    shoes,
    loading,
    saving,
    fuelSliderActive,
    setFuelSliderActive,
    loadError,
    saveError,
    planRefreshError,
    todaySession,
    sessionOptions,
    recommendedSessionId,
    selectedSession,
    selectedSessionId,
    setSelectedSessionId,
    selectedShoe,
    selectedShoeId,
    setSelectedShoeId,
    selectedShoeLifetimeKm,
    hasStaleMatchedSession,
    legs,
    setLegs,
    breathing,
    setBreathing,
    overall,
    setOverall,
    notes,
    setNotes,
    niggles,
    setNiggles,
    fuelEvents,
    setFuelEvents,
    recentFuelGels,
    suggestedFuelBrands,
    feelComplete,
    canSave,
    reloadDetail,
    saveRunDetail,
    waitingForCurrentDraft,
  } = useRunDetailController({
    activityId,
    requestedSessionId,
    currentWeek,
    refreshPlan,
    onSaved: () => router.replace('/(tabs)/home'),
    showAlert: (title, body) => Alert.alert(title, body),
  });
  const qualitySummary = activity && selectedSession
    ? buildStructuredQualitySummary(selectedSession, activity)
    : null;
  const qualitySummaryProps = qualitySummaryCardProps(qualitySummary, units);
  const splitModel = activity
    ? buildTargetAwareSplitsModel({
        session: selectedSession,
        splits: activity.splits,
        units,
      })
    : null;
  useEffect(() => {
    setSelectedAverageSplitId(null);
  }, [activityId]);

  const showingPreviousActivity = Boolean(activityId && activity && activity.id !== activityId);

  if (loading || showingPreviousActivity || waitingForCurrentDraft) {
    return (
      <View style={styles.center}>
        <ActivityIndicator testID="run-detail-loading" size="large" color={C.forest} />
      </View>
    );
  }

  if (!activityId || !activity) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>This run is no longer available</Text>
        <Text style={styles.emptyCopy}>
          {loadError ?? 'Go back to the picker and choose another run, or try refreshing this screen.'}
        </Text>
        <Pressable onPress={() => { void reloadDetail(); }}>
          <Text style={styles.emptyAction}>Try again</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/sync-run')}>
          <Text style={styles.emptyAction}>Back to picker</Text>
        </Pressable>
      </View>
    );
  }

  const persistedMatchedSessionId = activity.matchedSessionId ?? null;
  const pendingUnmatch = Boolean(persistedMatchedSessionId && selectedSessionId == null);
  const pendingRematch = Boolean(
    persistedMatchedSessionId
    && selectedSession
    && selectedSession.id !== persistedMatchedSessionId,
  );
  const hasPendingMatchChange = pendingUnmatch || pendingRematch;
  const matchedChipText = selectedSession
    ? `${pendingRematch ? 'Will match to' : 'Matched to'} ${formatSessionTitle(selectedSession, units)}`
    : pendingUnmatch
      ? 'Will be bonus run'
      : 'Bonus run';
  const matchedChipActionText = hasPendingMatchChange ? 'Save to apply' : 'Change';
  const matchedChipStyle = selectedSession ? styles.matchChipConnected : styles.matchChipUnmatched;
  const matchedChipTextStyle = selectedSession ? styles.matchChipTextConnected : styles.matchChipTextUnmatched;
  const maxAveragePaceDelta = splitModel?.rows.reduce(
    (maxDelta, row) => (
      row.averageComparisonEligible
        ? Math.max(maxDelta, Math.abs(Math.round(row.paceSeconds - activity.avgPace)))
        : maxDelta
    ),
    0,
  ) ?? 0;
  const selectedTargetDisplay = selectedSession
    ? formatIntensityTargetDisplay(selectedSession, units, {
        withUnit: true,
        fallbackToLegacyPace: true,
      }) ?? '—'
    : '—';
  const selectedTargetParts = splitTargetDisplay(selectedTargetDisplay);
  const handleNotesFocus = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.navSide} onPress={() => router.back()}>
          <Text style={styles.navAction}>Close</Text>
        </Pressable>
        <Text style={styles.navTitle}>Run detail</Text>
        <Pressable
          style={[styles.saveActionButton, !canSave && styles.saveActionButtonDisabled]}
          onPress={() => { void saveRunDetail(); }}
          disabled={!canSave}
        >
          <Text style={[styles.saveAction, !canSave && styles.saveActionDisabled]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        scrollEnabled={!fuelSliderActive}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => setShowMatchPicker(true)}
            style={[styles.matchChip, matchedChipStyle]}
            accessibilityRole="button"
            accessibilityLabel={`${matchedChipText}. Change match`}
          >
            <Text style={[styles.matchChipText, matchedChipTextStyle]} numberOfLines={1}>
              {matchedChipText}
            </Text>
            <Text style={[styles.matchChipAction, matchedChipTextStyle]}>{matchedChipActionText}</Text>
          </Pressable>
          <Text style={styles.runTitle}>
            {selectedSession ? formatSessionTitle(selectedSession, units) : activity.name ?? 'Bonus run'}
          </Text>
          <Text style={styles.runMeta}>{formatRunMeta(activity.startTime)}</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={[styles.metricCell, styles.metricCellDistance]}>
            <Text style={[styles.metricValue, styles.metricDistanceValue]}>{formatDistance(activity.distance, units, { spaced: true })}</Text>
            <Text style={styles.metricLabel}>Distance</Text>
          </View>
          <View style={[styles.metricCell, styles.metricCellTime]}>
            <Text style={[styles.metricValue, styles.metricTimeValue]}>{formatDuration(activity.duration)}</Text>
            <Text style={styles.metricLabel}>Duration</Text>
          </View>
          <View style={[styles.metricCell, styles.metricCellPace]}>
            <Text style={[styles.metricValue, styles.metricPaceValue]}>{formatPace(activity.avgPace, units, { withUnit: true })}</Text>
            <Text style={styles.metricLabel}>Avg pace</Text>
          </View>
          <View style={[styles.metricCell, styles.metricCellHeartRate]}>
            <Text style={[styles.metricValue, styles.metricHeartRateValue]}>{activity.avgHR ? `${activity.avgHR.toFixed(0)} bpm` : '—'}</Text>
            <Text style={styles.metricLabel}>Avg heart rate</Text>
          </View>
        </View>
        <View style={styles.subMetrics}>
          <Text style={styles.subMetricsText}>Max HR <Text style={[styles.subMetricsBold, styles.metricHeartRateValue]}>{activity.maxHR ? `${activity.maxHR} bpm` : '—'}</Text></Text>
          <Text style={styles.subMetricsText}>Elevation <Text style={[styles.subMetricsBold, styles.metricElevationValue]}>{activity.elevationGain ?? 0} m</Text></Text>
        </View>

        {hasStaleMatchedSession ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Previous match needs review</Text>
            <Text style={styles.statusCopy}>
              This run was matched to a session that is no longer available here. Re-match it before saving, or keep it as a bonus run.
            </Text>
            <Pressable onPress={() => setShowMatchPicker(true)}>
              <Text style={styles.statusAction}>Change match ›</Text>
            </Pressable>
          </View>
        ) : null}

        {!selectedSession ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>No planned session matched</Text>
            <Text style={styles.statusCopy}>
              This will stay as bonus mileage unless you match it to a planned session.
            </Text>
            <Pressable onPress={() => setShowMatchPicker(true)}>
              <Text style={styles.statusAction}>Change match ›</Text>
            </Pressable>
          </View>
        ) : null}

        {saveError ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Save failed</Text>
            <Text style={styles.statusCopy}>{saveError}</Text>
          </View>
        ) : null}

        {planRefreshError ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Plan refresh delayed</Text>
            <Text style={styles.statusCopy}>{planRefreshError}</Text>
          </View>
        ) : null}

        {selectedSession ? (
          <View style={[styles.section, styles.pvaSection]}>
            <Text style={[styles.sectionTitle, styles.pvaTitle]}>Planned vs actual</Text>
            <View style={styles.pvaRow}>
              <Text style={styles.pvaLabel}>Planned</Text>
              <Text style={[styles.pvaValue, styles.metricDistanceValue]}>{formatDistance(expectedDistance(selectedSession), units, { spaced: true })}</Text>
              <Text style={styles.pvaValue}>
                {selectedTargetParts.pace ? (
                  <Text style={styles.metricPaceValue}>{formatPlannedActualPaceUnit(selectedTargetParts.pace)}</Text>
                ) : null}
                {selectedTargetParts.pace && selectedTargetParts.effort ? (
                  '\n'
                ) : null}
                {selectedTargetParts.effort ? (
                  <Text style={styles.metricEffortValue}>{selectedTargetParts.effort}</Text>
                ) : null}
              </Text>
            </View>
            <View style={styles.pvaRow}>
              <Text style={styles.pvaLabel}>Actual</Text>
              <Text style={[styles.pvaValue, styles.metricDistanceValue]}>{formatDistance(activity.distance, units, { spaced: true })}</Text>
              <Text style={[styles.pvaValue, styles.metricPaceValue]}>
                {formatPlannedActualPaceUnit(formatPace(activity.avgPace, units, { withUnit: true }))}
              </Text>
            </View>
          </View>
        ) : null}

        {qualitySummaryProps ? (
          <View style={styles.qualitySummaryWrapper}>
            <QualitySummaryCard {...qualitySummaryProps} />
          </View>
        ) : null}

        {splitModel && activity.splits.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Splits</Text>
              <Text style={styles.splitSummaryLabel}>{splitModel.summaryLabel}</Text>
            </View>
            <View style={styles.splitHeaderRow}>
              <Text style={[styles.splitHeaderCell, styles.splitKmHeader]}>
                {splitModel.rows.some((row) => row.elapsedLabel) ? 'Split' : 'Distance'}
              </Text>
              <Text style={[styles.splitHeaderCell, styles.splitPaceHeader]}>Pace</Text>
              <Text style={[styles.splitHeaderCell, styles.splitBarHeader]}>{splitModel.comparisonHeader}</Text>
              <Text style={[styles.splitHeaderCell, styles.splitHrHeader]}>HR</Text>
            </View>
            {splitModel.rows.map((row, index) => {
              const averageComparison = buildAveragePaceComparison({
                splitPaceSeconds: row.paceSeconds,
                averagePaceSeconds: activity.avgPace,
                maxDeltaSeconds: maxAveragePaceDelta,
              });
              const averageSelected = selectedAverageSplitId === row.id;

              return (
                <View key={row.id} style={styles.splitRow}>
                  <View style={styles.splitLabelCell}>
                    <Text style={styles.splitKm}>{row.label}</Text>
                    {row.elapsedLabel ? <Text style={styles.splitElapsed}>{row.elapsedLabel}</Text> : null}
                  </View>
                  <Text style={styles.splitPace}>{row.paceLabel}</Text>
                  {splitModel.comparisonMode === 'target' ? (
                    <Text style={[styles.splitComparisonText, targetStatusStyle(row.targetStatus)]}>
                      {row.comparisonLabel ?? '—'}
                    </Text>
                  ) : row.averageComparisonEligible ? (
                    <Pressable
                      testID={`split-average-rail-${index}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${row.label} split ${averageComparison.label} versus average`}
                      hitSlop={8}
                      onPress={() => setSelectedAverageSplitId((current) => (current === row.id ? null : row.id))}
                      style={styles.averageRailButton}
                    >
                      {averageSelected ? (
                        <View style={styles.averageComparisonPill}>
                          <Text style={styles.averageComparisonText}>{averageComparison.label}</Text>
                        </View>
                      ) : null}
                      <View style={styles.averageRail}>
                        <View
                          testID={`split-average-segment-${index}`}
                          style={[
                            styles.averageRailSegment,
                            averageSegmentAnchorStyle(averageComparison.direction),
                            { width: `${averageComparison.widthPercent}%` },
                          ]}
                        />
                        <View
                          testID={`split-average-marker-${index}`}
                          style={styles.averageRailMarker}
                        />
                      </View>
                    </Pressable>
                  ) : (
                    <Text style={styles.splitComparisonText}>partial</Text>
                  )}
                  <Text style={styles.splitHr}>{row.heartRateLabel}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How did it feel?</Text>
          <FeelRow label="Legs" options={LEGS_OPTIONS} value={legs} onChange={setLegs} />
          <FeelRow label="Breathing" options={BREATHING_OPTIONS} value={breathing} onChange={setBreathing} />
          <FeelRow label="Overall" options={OVERALL_OPTIONS} value={overall} onChange={setOverall} />
        </View>

        <View style={styles.section}>
          <View style={[styles.sectionHead, styles.shoeSectionHead]}>
            <View style={styles.sectionTitleBlock}>
              <Text style={styles.sectionTitle}>Shoes</Text>
              <Text style={styles.sectionSubtitle}>Pair used for this run</Text>
            </View>
            <Pressable onPress={() => setShowShoePicker(true)} hitSlop={8}>
              <Text style={styles.shoeChange}>Change ›</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setShowShoePicker(true)} style={styles.shoeRow}>
            <View style={styles.shoeBody}>
              <Text style={styles.shoeName}>{selectedShoe ? shoeLabel(selectedShoe) : 'Not tracked'}</Text>
              {selectedShoe ? (
                <>
                  {selectedShoe.nickname ? <Text style={styles.shoeMeta}>{selectedShoe.nickname}</Text> : null}
                  <View style={styles.shoeLifetimePill}>
                    <Text style={styles.shoeLifetimeLabel}>Lifetime</Text>
                    <Text style={styles.shoeLifetimeValue}>{Math.round(selectedShoeLifetimeKm)} km</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.shoeMeta}>Choose the pair used for this run</Text>
              )}
              {selectedShoe?.retireAtKm ? (
                <View style={styles.shoeBar}>
                  <View
                    style={[
                      styles.shoeBarFill,
                      shoeWearState(selectedShoe) === 'warn' && styles.shoeBarFillWarn,
                      shoeWearState(selectedShoe) === 'critical' && styles.shoeBarFillCritical,
                      { width: `${Math.min(100, Math.round((selectedShoeLifetimeKm / selectedShoe.retireAtKm) * 100))}%` },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          </Pressable>
        </View>

        <FuellingCard
          durationSeconds={activity.duration}
          fuelEvents={fuelEvents}
          recentGels={recentFuelGels}
          suggestedBrands={suggestedFuelBrands}
          onSliderDragChange={setFuelSliderActive}
          onChange={setFuelEvents}
        />

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Niggles</Text>
            <Pressable onPress={() => setShowNigglePicker(true)}>
              <Text style={styles.niggleAction}>Flag a niggle</Text>
            </Pressable>
          </View>
          {niggles.length ? (
            <View style={styles.niggleChips}>
              {niggles.map((niggle, index) => (
                <View key={`${niggle.bodyPart}-${niggle.when}-${index}`} style={styles.niggleChip}>
                  <Text style={styles.niggleChipText}>{formatNiggleSummary(niggle)}</Text>
                  <Pressable onPress={() => setNiggles((current) => current.filter((_, currentIndex) => currentIndex !== index))}>
                    <Text style={styles.niggleChipRemove}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptySectionCopy}>No niggles flagged for this run.</Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.sectionAction}>Optional</Text>
          </View>
          <TextInput
            testID="run-detail-notes-input"
            style={styles.notesInput}
            placeholder="Anything worth remembering about this run?"
            placeholderTextColor={C.muted}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
            onFocus={handleNotesFocus}
          />
        </View>

        <Pressable
          onPress={() => { void saveRunDetail(); }}
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          disabled={!canSave}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving…' : feelComplete ? 'Save run' : 'Fill in how it felt to save'}
          </Text>
        </Pressable>
      </ScrollView>

      <MatchPickerModal
        visible={showMatchPicker}
        activity={activity}
        sessionOptions={sessionOptions}
        selectedSessionId={selectedSessionId}
        recommendedSessionId={recommendedSessionId}
        todaySessionId={todaySession?.id}
        onSelect={setSelectedSessionId}
        onClose={() => setShowMatchPicker(false)}
        onConfirm={() => setShowMatchPicker(false)}
      />
      <ShoePickerModal
        visible={showShoePicker}
        shoes={shoes}
        selectedShoeId={selectedShoeId}
        onSelect={setSelectedShoeId}
        onClose={() => setShowShoePicker(false)}
        onDone={() => setShowShoePicker(false)}
      />
      <NigglePickerModal
        visible={showNigglePicker}
        onClose={() => setShowNigglePicker(false)}
        onAdd={(niggle) => {
          setNiggles((current) => [...current, niggle]);
          setShowNigglePicker(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cream,
    padding: 24,
  },
  emptyTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 24,
    color: C.ink,
    marginBottom: 10,
  },
  emptyCopy: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
    textAlign: 'center',
    marginBottom: 14,
  },
  emptyAction: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.forest,
    marginTop: 10,
  },
  navBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navAction: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.muted,
  },
  navSide: {
    width: 74,
  },
  navTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 15,
    color: C.ink,
  },
  saveActionButton: {
    width: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.forestBg,
    borderWidth: 1,
    borderColor: C.forest,
  },
  saveActionButtonDisabled: {
    opacity: 0.5,
  },
  saveAction: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.forest,
  },
  saveActionDisabled: {
    color: C.muted,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 96,
  },
  header: {
    paddingHorizontal: 4,
    paddingTop: 26,
    paddingBottom: 20,
  },
  matchChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchChipConnected: {
    backgroundColor: C.statusConnectedBg,
    borderColor: C.statusConnected,
  },
  matchChipUnmatched: {
    backgroundColor: '#F2F2F4',
    borderColor: C.slate,
    borderStyle: 'dashed',
  },
  matchChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    flexShrink: 1,
  },
  matchChipTextConnected: {
    color: C.statusConnected,
  },
  matchChipTextUnmatched: {
    color: C.slate,
  },
  matchChipAction: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  runTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 32,
    lineHeight: 36,
    color: C.ink,
    marginBottom: 6,
  },
  runMeta: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  metricCell: {
    width: '48.5%',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  metricCellDistance: {
    borderLeftColor: C.metricDistance,
  },
  metricCellTime: {
    borderLeftColor: C.metricTime,
  },
  metricCellPace: {
    borderLeftColor: C.metricPace,
  },
  metricCellHeartRate: {
    borderLeftColor: C.metricHeartRate,
  },
  metricValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 22,
    color: C.ink,
    marginBottom: 5,
  },
  metricDistanceValue: {
    color: C.metricDistance,
  },
  metricTimeValue: {
    color: C.metricTime,
  },
  metricPaceValue: {
    color: C.metricPace,
  },
  metricHeartRateValue: {
    color: C.metricHeartRate,
  },
  metricElevationValue: {
    color: C.metricElevation,
  },
  metricEffortValue: {
    color: C.metricEffort,
  },
  metricLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  subMetrics: {
    paddingHorizontal: 4,
    marginBottom: 22,
    flexDirection: 'row',
    gap: 14,
  },
  subMetricsText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.muted,
  },
  subMetricsBold: {
    fontFamily: FONTS.monoBold,
    color: C.ink,
  },
  statusCard: {
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(196,82,42,0.30)',
    backgroundColor: C.clayBg,
  },
  statusTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 14,
    color: C.ink,
    marginBottom: 4,
  },
  statusCopy: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.ink2,
    marginBottom: 10,
  },
  statusAction: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.surface,
    alignSelf: 'flex-start',
    backgroundColor: C.ink,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  section: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitleBlock: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 17,
    color: C.ink,
  },
  sectionSubtitle: {
    marginTop: 3,
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
  },
  sectionAction: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.muted,
  },
  niggleAction: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  shoeSectionHead: {
    alignItems: 'flex-start',
  },
  shoeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shoeBody: {
    flex: 1,
  },
  shoeName: {
    fontFamily: FONTS.serifBold,
    fontSize: 16,
    color: C.ink,
    marginBottom: 2,
  },
  shoeMeta: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.muted,
  },
  shoeLifetimePill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.metricShoes,
    backgroundColor: C.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  shoeLifetimeLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  shoeLifetimeValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: C.metricShoes,
  },
  shoeBar: {
    marginTop: 6,
    height: 4,
    borderRadius: 999,
    backgroundColor: C.card,
    overflow: 'hidden',
  },
  shoeBarFill: {
    height: '100%',
    backgroundColor: C.metricShoes,
    borderRadius: 999,
  },
  shoeBarFillWarn: {
    backgroundColor: C.amber,
  },
  shoeBarFillCritical: {
    backgroundColor: C.clay,
  },
  shoeChange: {
    fontFamily: FONTS.sansSemiBold,
    fontWeight: '800',
    fontSize: 12,
    color: C.ink,
    marginTop: 2,
  },
  pvaSection: {
    paddingTop: 14,
  },
  pvaTitle: {
    lineHeight: 21,
    marginBottom: 12,
  },
  pvaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  pvaLabel: {
    width: 64,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pvaValue: {
    flex: 1,
    fontFamily: FONTS.monoBold,
    fontSize: 14,
    color: C.ink,
  },
  qualitySummaryWrapper: {
    marginBottom: 14,
  },
  splitSummaryLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontWeight: '700',
    fontSize: 12,
    color: C.ink2,
  },
  splitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  splitHeaderCell: {
    fontFamily: FONTS.sansSemiBold,
    fontWeight: '700',
    fontSize: 9,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  splitKmHeader: {
    width: 64,
  },
  splitPaceHeader: {
    width: 58,
  },
  splitBarHeader: {
    flex: 1,
    textAlign: 'center',
  },
  splitHrHeader: {
    width: 56,
    textAlign: 'right',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  splitLabelCell: {
    width: 64,
  },
  splitKm: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.metricDistance,
  },
  splitElapsed: {
    marginTop: 2,
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: C.metricTime,
  },
  splitPace: {
    width: 58,
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.metricPace,
  },
  averageRailButton: {
    flex: 1,
    height: 28,
    justifyContent: 'flex-end',
  },
  averageRail: {
    position: 'relative',
    height: 8,
    borderRadius: 999,
    backgroundColor: C.metricPaceBg,
  },
  averageRailSegment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: C.metricPace,
  },
  averageRailSegmentFast: {
    right: '50%',
  },
  averageRailSegmentSlow: {
    left: '50%',
  },
  averageRailMarker: {
    position: 'absolute',
    left: '50%',
    top: -3,
    width: 2,
    height: 14,
    borderRadius: 1,
    backgroundColor: C.slate,
  },
  averageComparisonPill: {
    position: 'absolute',
    top: -2,
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  averageComparisonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    color: C.ink2,
  },
  splitComparisonText: {
    flex: 1,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  splitComparisonOnTarget: {
    color: C.statusConnected,
  },
  splitComparisonVaried: {
    color: C.amber,
  },
  splitHr: {
    width: 56,
    textAlign: 'right',
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.metricHeartRate,
  },
  feelRow: {
    marginBottom: 14,
  },
  feelLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  feelChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  feelChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cream,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  feelChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: C.ink2,
  },
  feelChipSelectedRecoverable: {
    borderWidth: 2,
    borderColor: C.metricEffort,
    backgroundColor: C.metricEffortBg,
  },
  feelChipTextSelectedRecoverable: {
    color: C.metricEffort,
    fontFamily: FONTS.sansSemiBold,
    fontWeight: '800',
  },
  feelChipSelectedWorked: {
    borderWidth: 2,
    borderColor: C.amber,
    backgroundColor: C.amberBg,
  },
  feelChipTextSelectedWorked: {
    color: C.amber,
    fontFamily: FONTS.sansSemiBold,
    fontWeight: '800',
  },
  feelChipSelectedHard: {
    borderWidth: 2,
    borderColor: C.clay,
    backgroundColor: C.clayBg,
  },
  feelChipTextSelectedHard: {
    color: C.clay,
    fontFamily: FONTS.sansSemiBold,
    fontWeight: '800',
  },
  notesInput: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.ink,
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  niggleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  niggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(196,82,42,0.25)',
    backgroundColor: C.clayBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  niggleChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.ink2,
  },
  niggleChipRemove: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.clay,
  },
  emptySectionCopy: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
  },
  saveButton: {
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: C.forest,
    alignItems: 'center',
    paddingVertical: 16,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: C.surface,
  },
});
