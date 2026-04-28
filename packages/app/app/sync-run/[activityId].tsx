import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type DimensionValue } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  expectedDistance,
  formatNiggleSummary,
  shoeLifetimeKm,
  type Activity,
  type PlannedSession,
  type RunFuelEvent,
  type Shoe,
  type SubjectiveBreathing,
  type SubjectiveInput,
  type SubjectiveLegs,
  type SubjectiveOverall,
} from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { trpc } from '../../lib/trpc';
import { usePlan } from '../../hooks/usePlan';
import { findSessionForDateOrWeekday, todayIsoLocal } from '../../lib/plan-helpers';
import { usePreferences } from '../../providers/preferences-context';
import {
  formatDistance,
  formatIntensityTargetDisplay,
  formatPace,
  formatSessionTitle,
  formatSplitLabel,
  inferSplitLabelMode,
} from '../../lib/units';
import { type EditableNiggle, isActivityDateCompatibleWithSession, isRunnableSession, isSessionSelectable, listMatchableSessions, resolveDefaultMatchSessionId, shoeWearState, toEditableNiggles } from '../../features/sync/sync-run-detail';
import { buildCurrentDisplayWeek } from '../../features/run/display-week';
import { MatchPickerModal } from '../../components/sync-run/MatchPickerModal';
import { NigglePickerModal } from '../../components/sync-run/NigglePickerModal';
import { ShoePickerModal } from '../../components/sync-run/ShoePickerModal';
import { FuellingCard } from '../../components/sync-run/FuellingCard';
import { GEL_BRANDS } from '../../features/fuelling/gel-catalogue';
import { suggestedBrands as buildSuggestedFuelBrands, uniqueRecentFuelGels } from '../../features/fuelling/fuel-events';

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

function paceBarWidth(splitPace: number, fastestPace: number, slowestPace: number): DimensionValue {
  if (slowestPace === fastestPace) return '70%';
  const ratio = (slowestPace - splitPace) / (slowestPace - fastestPace);
  return `${35 + ratio * 55}%`;
}

function shoeLabel(shoe: Shoe): string {
  return `${shoe.brand} ${shoe.model}`;
}

function firstRouteParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
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

const RUN_DETAIL_LOAD_TIMEOUT_MS = 8000;

function saveRunFailureCopy(error: unknown): { inline: string; alertTitle: string; alertBody: string } {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('fuel_events') || message.toLowerCase().includes('fuel events')) {
    return {
      inline: 'Fuelling storage is not ready yet. Apply the latest database migration, then retry. Your notes and selections are still here.',
      alertTitle: 'Could not save fuelling',
      alertBody: 'The database is missing the fuelling column. Apply the latest migration, then retry.',
    };
  }

  return {
    inline: 'Could not save this run yet. Your notes and selections are still here so you can retry.',
    alertTitle: 'Could not save run',
    alertBody: 'Please try again in a moment.',
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
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
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[styles.feelChip, selected && styles.feelChipSelected]}
            >
              <Text style={[styles.feelChipText, selected && styles.feelChipTextSelected]}>{opt.label}</Text>
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
  const { units } = usePreferences();
  const { currentWeek, refresh: refreshPlan } = usePlan();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [fuelHistoryActivities, setFuelHistoryActivities] = useState<Activity[]>([]);
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fuelSliderActive, setFuelSliderActive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [planRefreshError, setPlanRefreshError] = useState<string | null>(null);
  const [showMatchPicker, setShowMatchPicker] = useState(false);
  const [showShoePicker, setShowShoePicker] = useState(false);
  const [showNigglePicker, setShowNigglePicker] = useState(false);
  const [draftSeedActivityId, setDraftSeedActivityId] = useState<string | null>(null);
  const today = todayIsoLocal();
  const displayWeek = useMemo(
    () => (currentWeek ? buildCurrentDisplayWeek(currentWeek, today) : null),
    [currentWeek, today],
  );
  const todaySession = findSessionForDateOrWeekday(displayWeek?.sessions ?? [], today);
  const sessionOptions = useMemo(
    () => listMatchableSessions(displayWeek?.sessions ?? [], today),
    [displayWeek?.sessions, today],
  );
  const requestedSession = useMemo(
    () => sessionOptions.find((session) => session.id === requestedSessionId) ?? null,
    [requestedSessionId, sessionOptions],
  );

  const [legs, setLegs] = useState<SubjectiveLegs | null>(null);
  const [breathing, setBreathing] = useState<SubjectiveBreathing | null>(null);
  const [overall, setOverall] = useState<SubjectiveOverall | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedShoeId, setSelectedShoeId] = useState<string | null>(null);
  const [niggles, setNiggles] = useState<EditableNiggle[]>([]);
  const [fuelEvents, setFuelEvents] = useState<RunFuelEvent[]>([]);
  const recommendedSessionId = useMemo(
    () => resolveDefaultMatchSessionId({
      activity,
      preferredSession: requestedSession,
      today,
      todaySession: isRunnableSession(todaySession) ? todaySession : null,
      sessionOptions,
    }),
    [activity, requestedSession, sessionOptions, today, todaySession],
  );
  const selectedSession = sessionOptions.find((session) => session.id === selectedSessionId) ?? null;
  const selectedShoe = shoes.find((shoe) => shoe.id === selectedShoeId) ?? null;
  const selectedShoeLifetimeKm = selectedShoe ? shoeLifetimeKm(selectedShoe) : 0;
  const matchedSession = activity?.matchedSessionId
    ? sessionOptions.find((session) => session.id === activity.matchedSessionId) ?? null
    : null;
  const hasStaleMatchedSession = Boolean(
    activity?.matchedSessionId
      && (
        !matchedSession
        || !isSessionSelectable(matchedSession, activity.id)
        || !isActivityDateCompatibleWithSession(activity, matchedSession)
      ),
  );
  const splitPaces = activity?.splits.map((split) => split.pace) ?? [];
  const fastestPace = splitPaces.length ? Math.min(...splitPaces) : 0;
  const slowestPace = splitPaces.length ? Math.max(...splitPaces) : 0;
  const feelComplete = legs !== null && breathing !== null && overall !== null;
  const subjectiveInput: SubjectiveInput | undefined = feelComplete
    ? { legs: legs!, breathing: breathing!, overall: overall! }
    : undefined;
  const canSave = feelComplete && !saving;
  const fuelHistory = useMemo(
    () => activity
      ? [
          { ...activity, fuelEvents },
          ...fuelHistoryActivities.filter((historyActivity) => historyActivity.id !== activity.id),
        ]
      : fuelHistoryActivities,
    [activity, fuelEvents, fuelHistoryActivities],
  );
  const recentFuelGels = useMemo(
    () => uniqueRecentFuelGels(fuelHistory),
    [fuelHistory],
  );
  const suggestedFuelBrands = useMemo(
    () => buildSuggestedFuelBrands(recentFuelGels, GEL_BRANDS),
    [recentFuelGels],
  );

  useEffect(() => {
    setDraftSeedActivityId(null);
  }, [activityId]);

  useEffect(() => {
    if (!activityId) {
      setActivity(null);
      setShoes([]);
      setLoadError('We could not find that run. Go back and open it again.');
      setLoading(false);
      return;
    }

    const resolvedActivityId = activityId;
    let cancelled = false;

    async function loadDetail() {
      try {
        setLoading(true);
        setLoadError(null);
        setShoes([]);
        setFuelHistoryActivities([]);
        const nextActivity = await withTimeout(
          trpc.activity.get.query({ activityId: resolvedActivityId }),
          RUN_DETAIL_LOAD_TIMEOUT_MS,
          'sync-run detail activity fetch',
        );
        if (cancelled) {
          return;
        }
        setActivity(nextActivity);
        void withTimeout(
          trpc.shoe.list.query(),
          RUN_DETAIL_LOAD_TIMEOUT_MS,
          'sync-run detail shoe fetch',
        )
          .then((nextShoes) => {
            if (!cancelled) {
              setShoes(nextShoes);
            }
          })
          .catch((error) => {
            console.warn('Failed to load shoes for sync-run detail:', error);
            if (!cancelled) {
              setShoes([]);
            }
          });
        void withTimeout(
          trpc.activity.list.query(),
          RUN_DETAIL_LOAD_TIMEOUT_MS,
          'sync-run detail activity history fetch',
        )
          .then((activities) => {
            if (!cancelled) {
              setFuelHistoryActivities(activities);
            }
          })
          .catch((error) => {
            console.warn('Failed to load activity history for run fuelling:', error);
            if (!cancelled) {
              setFuelHistoryActivities(nextActivity ? [nextActivity] : []);
            }
          });
      } catch (error) {
        console.warn('Failed to load sync-run detail activity:', error);
        if (!cancelled) {
          setActivity(null);
          setFuelHistoryActivities([]);
          setLoadError('We could not refresh this run. Try again or go back to the picker.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetail().catch((error) => {
      console.warn('Failed to initialize sync-run detail:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [activityId]);

  useEffect(() => {
    if (!activity || draftSeedActivityId === activity.id) {
      return;
    }

    setSelectedSessionId(recommendedSessionId);
    setSelectedShoeId(activity.shoeId ?? null);
    setNiggles(toEditableNiggles(activity.niggles));
    setFuelEvents(activity.fuelEvents ?? []);
    setNotes(activity.notes ?? '');
    setLegs(activity.subjectiveInput?.legs ?? null);
    setBreathing(activity.subjectiveInput?.breathing ?? null);
    setOverall(activity.subjectiveInput?.overall ?? null);
    setDraftSeedActivityId(activity.id);
  }, [activity, draftSeedActivityId, recommendedSessionId]);

  async function reloadDetail() {
    if (!activityId) {
      setActivity(null);
      setShoes([]);
      setLoadError('We could not find that run. Go back and open it again.');
      setLoading(false);
      return;
    }

    const resolvedActivityId = activityId;
    try {
      setLoading(true);
      setLoadError(null);
      const nextActivity = await withTimeout(
        trpc.activity.get.query({ activityId: resolvedActivityId }),
        RUN_DETAIL_LOAD_TIMEOUT_MS,
        'sync-run detail activity fetch',
      );
      setActivity(nextActivity);
      void withTimeout(
        trpc.shoe.list.query(),
        RUN_DETAIL_LOAD_TIMEOUT_MS,
        'sync-run detail shoe fetch',
      )
        .then((nextShoes) => {
          setShoes(nextShoes);
        })
        .catch((error) => {
          console.warn('Failed to reload shoes for sync-run detail:', error);
          setShoes([]);
        });
      void withTimeout(
        trpc.activity.list.query(),
        RUN_DETAIL_LOAD_TIMEOUT_MS,
        'sync-run detail activity history fetch',
      )
        .then((activities) => {
          setFuelHistoryActivities(activities);
        })
        .catch((error) => {
          console.warn('Failed to reload activity history for run fuelling:', error);
          setFuelHistoryActivities(nextActivity ? [nextActivity] : []);
        });
    } catch (error) {
      console.warn('Failed to load sync-run detail activity:', error);
      setActivity(null);
      setFuelHistoryActivities([]);
      setLoadError('We could not refresh this run. Try again or go back to the picker.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!activity || !subjectiveInput) return;

    setSaveError(null);
    setPlanRefreshError(null);

    if (selectedSession && !isSessionSelectable(selectedSession, activity.id)) {
      setSaveError('That session is already linked to another run. Pick a different session or save this as a bonus run.');
      Alert.alert('Choose a different session', 'That planned session is already linked to another run.');
      return;
    }

    try {
      setSaving(true);
      const result = await trpc.activity.saveRunDetail.mutate({
        activityId: activity.id,
        subjectiveInput,
        niggles,
        fuelEvents,
        notes: notes.trim() || undefined,
        shoeId: selectedShoeId,
        matchedSessionId: selectedSessionId,
      });

      setActivity({ ...result.activity, niggles: result.niggles });
    } catch (error) {
      console.warn('Failed to save synced run:', error);
      const failureCopy = saveRunFailureCopy(error);
      setSaveError(failureCopy.inline);
      Alert.alert(failureCopy.alertTitle, failureCopy.alertBody);
      setSaving(false);
      return;
    }

    try {
      await refreshPlan();
    } catch (error) {
      console.warn('Saved run but failed to refresh the plan:', error);
      setPlanRefreshError('Run saved. We will refresh the plan when you return home.');
      Alert.alert('Run saved', 'We could not refresh the plan yet, but your run was saved.');
    } finally {
      setSaving(false);
    }

    router.replace('/(tabs)/home');
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.forest} />
      </View>
    );
  }

  if (!activity) {
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

  const matchedChipText = selectedSession
    ? `Matched to ${formatSessionTitle(selectedSession, units)}`
    : 'Bonus run';
  const matchedChipStyle = selectedSession ? styles.matchChipActive : styles.matchChipNeutral;
  const matchedChipTextStyle = selectedSession ? styles.matchChipTextActive : styles.matchChipTextNeutral;
  const splitLabelMode = inferSplitLabelMode(selectedSession, activity.splits);
  const splitSummaryLabel = splitLabelMode === 'segment' ? 'segments' : 'per km';
  const selectedTargetDisplay = selectedSession
    ? formatIntensityTargetDisplay(selectedSession, units, {
        withUnit: true,
        fallbackToLegacyPace: true,
      }) ?? '—'
    : '—';

  return (
    <View style={styles.container}>
      <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.navSide} onPress={() => router.back()}>
          <Text style={styles.navAction}>Close</Text>
        </Pressable>
        <Text style={styles.navTitle}>Run detail</Text>
        <Pressable
          style={[styles.saveActionButton, !canSave && styles.saveActionButtonDisabled]}
          onPress={() => { void handleSave(); }}
          disabled={!canSave}
        >
          <Text style={[styles.saveAction, !canSave && styles.saveActionDisabled]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView scrollEnabled={!fuelSliderActive} contentContainerStyle={styles.scrollContent}>
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
            <Text style={[styles.matchChipAction, matchedChipTextStyle]}>Change</Text>
          </Pressable>
          <Text style={styles.runTitle}>
            {selectedSession ? formatSessionTitle(selectedSession, units) : activity.name ?? 'Bonus run'}
          </Text>
          <Text style={styles.runMeta}>{formatRunMeta(activity.startTime)}</Text>
        </View>

        <View style={styles.metricGrid}>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{formatDistance(activity.distance, units, { spaced: true })}</Text>
            <Text style={styles.metricLabel}>Distance</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{formatDuration(activity.duration)}</Text>
            <Text style={styles.metricLabel}>Duration</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{formatPace(activity.avgPace, units, { withUnit: true })}</Text>
            <Text style={styles.metricLabel}>Avg pace</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{activity.avgHR?.toFixed(0) ?? '—'}</Text>
            <Text style={styles.metricLabel}>Avg heart rate</Text>
          </View>
        </View>
        <View style={styles.subMetrics}>
          <Text style={styles.subMetricsText}>Max HR <Text style={styles.subMetricsBold}>{activity.maxHR ?? '—'}</Text></Text>
          <Text style={styles.subMetricsText}>Elevation <Text style={styles.subMetricsBold}>{activity.elevationGain ?? 0} m</Text></Text>
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
              <Text style={styles.pvaValue}>{formatDistance(expectedDistance(selectedSession), units, { spaced: true })}</Text>
              <Text style={styles.pvaValue}>{selectedTargetDisplay}</Text>
            </View>
            <View style={styles.pvaRow}>
              <Text style={styles.pvaLabel}>Actual</Text>
              <Text style={styles.pvaValue}>{formatDistance(activity.distance, units, { spaced: true })}</Text>
              <Text style={styles.pvaValue}>{formatPace(activity.avgPace, units, { withUnit: true })}</Text>
            </View>
          </View>
        ) : null}

        {activity.splits.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Splits</Text>
              <Text style={styles.sectionAction}>{splitSummaryLabel}</Text>
            </View>
            {activity.splits.map((split) => (
              <View key={split.km} style={styles.splitRow}>
                <Text style={styles.splitKm}>{formatSplitLabel(split, units, { mode: splitLabelMode })}</Text>
                <Text style={styles.splitPace}>{formatPace(split.pace, units)}</Text>
                <View style={styles.splitBar}>
                  <View style={[styles.splitFill, { width: paceBarWidth(split.pace, fastestPace, slowestPace) }]} />
                </View>
                <Text style={styles.splitHr}>{split.hr ? `${Math.round(split.hr)} bpm` : '—'}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How did it feel?</Text>
          <FeelRow label="Legs" options={LEGS_OPTIONS} value={legs} onChange={setLegs} />
          <FeelRow label="Breathing" options={BREATHING_OPTIONS} value={breathing} onChange={setBreathing} />
          <FeelRow label="Overall" options={OVERALL_OPTIONS} value={overall} onChange={setOverall} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionTitleBlock}>
              <Text style={styles.sectionTitle}>Shoes</Text>
              <Text style={styles.sectionSubtitle}>Pair used for this run</Text>
            </View>
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
            <Text style={styles.shoeChange}>Change ›</Text>
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
              <Text style={styles.sectionActionPrimary}>Flag a niggle</Text>
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
            style={styles.notesInput}
            placeholder="Anything worth remembering about this run?"
            placeholderTextColor={C.muted}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <Pressable
          onPress={() => { void handleSave(); }}
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
    paddingBottom: 36,
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
  matchChipActive: {
    backgroundColor: C.forestBg,
    borderColor: C.forest,
  },
  matchChipNeutral: {
    backgroundColor: '#F2F2F4',
    borderColor: C.slate,
    borderStyle: 'dashed',
  },
  matchChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    flexShrink: 1,
  },
  matchChipTextActive: {
    color: C.forest,
  },
  matchChipTextNeutral: {
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
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  metricValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 22,
    color: C.ink,
    marginBottom: 5,
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
  sectionActionPrimary: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.forest,
  },
  shoeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    borderColor: 'rgba(42,92,69,0.28)',
    backgroundColor: C.forestBg,
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
    color: C.forest,
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
    backgroundColor: C.forest,
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
    fontSize: 12,
    color: C.forest,
    paddingLeft: 8,
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
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  splitKm: {
    width: 58,
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.muted,
  },
  splitPace: {
    width: 56,
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.ink,
  },
  splitBar: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: C.card,
    overflow: 'hidden',
  },
  splitFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: C.forest,
  },
  splitHr: {
    width: 56,
    textAlign: 'right',
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.ink2,
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
  feelChipSelected: {
    borderColor: C.forest,
    backgroundColor: C.forestBg,
  },
  feelChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: C.ink2,
  },
  feelChipTextSelected: {
    color: C.forest,
    fontFamily: FONTS.sansSemiBold,
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
