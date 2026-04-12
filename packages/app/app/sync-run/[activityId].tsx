import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type DimensionValue } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { expectedDistance, type Activity, type PlannedSession, type SubjectiveBreathing, type SubjectiveInput, type SubjectiveLegs, type SubjectiveOverall } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { trpc } from '../../lib/trpc';
import { usePlan } from '../../hooks/usePlan';
import { findSessionForDateOrWeekday, todayIsoLocal } from '../../lib/plan-helpers';

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatPace(secPerKm: number): string {
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.floor(secPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

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
  const day = value.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const time = value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} · ${time}`;
}

function formatSessionLabel(session: PlannedSession): string {
  if (session.type === 'INTERVAL') {
    return `${session.reps}×${session.repDist}m Intervals`;
  }
  return `${expectedDistance(session).toFixed(1).replace(/\.0$/, '')} km ${session.type.toLowerCase()}`;
}

function paceBarWidth(splitPace: number, fastestPace: number, slowestPace: number): DimensionValue {
  if (slowestPace === fastestPace) return '70%';
  const ratio = (slowestPace - splitPace) / (slowestPace - fastestPace);
  return `${35 + ratio * 55}%`;
}

function isRunnableSession(session: PlannedSession | null): session is PlannedSession {
  return session != null && session.type !== 'REST';
}

// ─── Feel chip helpers ────────────────────────────────────────────────────────

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
              <Text style={[styles.feelChipText, selected && styles.feelChipTextSelected]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SyncRunDetailScreen() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const { currentWeek, refresh: refreshPlan } = usePlan();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const today = todayIsoLocal();
  const todaySession = findSessionForDateOrWeekday(currentWeek?.sessions ?? [], today);

  // Feel inputs
  const [legs, setLegs] = useState<SubjectiveLegs | null>(null);
  const [breathing, setBreathing] = useState<SubjectiveBreathing | null>(null);
  const [overall, setOverall] = useState<SubjectiveOverall | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadActivity() {
      try {
        setLoading(true);
        const next = await trpc.activity.list.query();
        if (!cancelled) setActivities(next);
      } catch (error) {
        console.error('Failed to load sync-run detail activity:', error);
        if (!cancelled) setActivities([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadActivity().catch((error) => {
      console.error('Failed to initialize sync-run detail:', error);
    });

    return () => { cancelled = true; };
  }, [activityId]);

  const activity = useMemo(
    () => activities.find((item) => item.id === activityId) ?? null,
    [activities, activityId],
  );

  const sessionOptions = useMemo(
    () => (currentWeek?.sessions ?? []).filter(isRunnableSession),
    [currentWeek?.sessions],
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!activity) return;
    // Prefer today's session when the run happened today — this matches what home shows
    if (todaySession && activity.startTime.slice(0, 10) === today) {
      setSelectedSessionId(todaySession.id);
      return;
    }
    // Fall back to whatever the auto-matcher assigned
    if (activity.matchedSessionId) {
      setSelectedSessionId(activity.matchedSessionId);
      return;
    }
    setSelectedSessionId(null);
  }, [activity, today, todaySession?.id, todaySession?.date]);

  // Pre-fill feel if activity already has subjective data
  useEffect(() => {
    if (!activity?.subjectiveInput) return;
    setLegs(activity.subjectiveInput.legs);
    setBreathing(activity.subjectiveInput.breathing);
    setOverall(activity.subjectiveInput.overall);
  }, [activity?.id]);

  const selectedSession = sessionOptions.find((s) => s.id === selectedSessionId) ?? null;
  const splitPaces = activity?.splits.map((s) => s.pace) ?? [];
  const fastestPace = splitPaces.length ? Math.min(...splitPaces) : 0;
  const slowestPace = splitPaces.length ? Math.max(...splitPaces) : 0;

  const feelComplete = legs !== null && breathing !== null && overall !== null;
  const subjectiveInput: SubjectiveInput | undefined = feelComplete
    ? { legs: legs!, breathing: breathing!, overall: overall! }
    : undefined;

  async function handleSave() {
    if (!activity) return;

    try {
      setSaving(true);
      await trpc.activity.matchSession.mutate({
        activityId: activity.id,
        sessionId: selectedSessionId,
      });

      if (subjectiveInput && selectedSessionId) {
        await trpc.plan.saveSubjectiveInput.mutate({
          sessionId: selectedSessionId,
          input: subjectiveInput,
        });
      }

      await refreshPlan();
      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('Failed to save synced run:', error);
      Alert.alert('Could not save run', 'Please try again in a moment.');
    } finally {
      setSaving(false);
    }
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
        <Text style={styles.emptyTitle}>Run not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.emptyAction}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const matchedToToday = selectedSession && todaySession && selectedSession.id === todaySession.id;

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.navAction}>Close</Text>
        </Pressable>
        <Text style={styles.navTitle}>Run detail</Text>
        <Pressable onPress={() => { void handleSave(); }} disabled={saving}>
          <Text style={[styles.saveAction, saving && styles.saveActionDisabled]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (todaySession) setSelectedSessionId(todaySession.id);
            }}
            style={[styles.matchChip, matchedToToday ? styles.matchChipActive : styles.matchChipNeutral]}
          >
            <Text style={[styles.matchChipText, matchedToToday ? styles.matchChipTextActive : styles.matchChipTextNeutral]}>
              {matchedToToday ? `${selectedSession?.type} · MATCHED TO TODAY` : 'BONUS RUN'}
            </Text>
          </Pressable>
          <Text style={styles.runTitle}>
            {selectedSession ? formatSessionLabel(selectedSession) : 'Bonus run'}
          </Text>
          <Text style={styles.runMeta}>{formatRunMeta(activity.startTime)}</Text>
        </View>

        {/* Metric grid */}
        <View style={styles.metricGrid}>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{activity.distance.toFixed(1)} km</Text>
            <Text style={styles.metricLabel}>Distance</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{formatDuration(activity.duration)}</Text>
            <Text style={styles.metricLabel}>Duration</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{formatPace(activity.avgPace)} /km</Text>
            <Text style={styles.metricLabel}>Avg pace</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricValue}>{activity.avgHR?.toFixed(0) ?? '—'}</Text>
            <Text style={styles.metricLabel}>Avg HR</Text>
          </View>
        </View>
        <Text style={styles.subMetrics}>
          Max HR <Text style={styles.subMetricsBold}>{activity.maxHR ?? '—'}</Text>
          {' · '}Elevation <Text style={styles.subMetricsBold}>{activity.elevationGain ?? 0} m</Text>
        </Text>

        {/* Planned vs actual */}
        {selectedSession ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Planned vs actual</Text>
            <View style={styles.pvaRow}>
              <Text style={styles.pvaLabel}>Planned</Text>
              <Text style={styles.pvaValue}>{expectedDistance(selectedSession).toFixed(1)} km</Text>
              <Text style={styles.pvaValue}>{selectedSession.pace}</Text>
            </View>
            <View style={styles.pvaRow}>
              <Text style={styles.pvaLabel}>Actual</Text>
              <Text style={styles.pvaValue}>{activity.distance.toFixed(1)} km</Text>
              <Text style={styles.pvaValue}>{formatPace(activity.avgPace)} /km</Text>
            </View>
          </View>
        ) : null}

        {/* Splits */}
        {activity.splits.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Splits</Text>
            {activity.splits.map((split) => (
              <View key={split.km} style={styles.splitRow}>
                <Text style={styles.splitKm}>KM {split.km}</Text>
                <Text style={styles.splitPace}>{formatPace(split.pace)}</Text>
                <View style={styles.splitBar}>
                  <View style={[styles.splitFill, { width: paceBarWidth(split.pace, fastestPace, slowestPace) }]} />
                </View>
                <Text style={styles.splitHr}>{split.hr ? `${Math.round(split.hr)} bpm` : '—'}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* How did it feel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How did it feel?</Text>
          <FeelRow label="LEGS" options={LEGS_OPTIONS} value={legs} onChange={setLegs} />
          <FeelRow label="BREATHING" options={BREATHING_OPTIONS} value={breathing} onChange={setBreathing} />
          <FeelRow label="OVERALL" options={OVERALL_OPTIONS} value={overall} onChange={setOverall} />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add a note about this run…"
            placeholderTextColor={C.muted}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Match to session */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Match to session</Text>
          {sessionOptions.map((s, index) => {
            const selected = s.id === selectedSessionId;
            return (
              <Pressable
                key={`${s.id}-${s.date}-${index}`}
                onPress={() => setSelectedSessionId(s.id)}
                style={[styles.sessionOption, selected && styles.sessionOptionSelected]}
              >
                <View style={styles.sessionOptionBody}>
                  <Text style={styles.sessionOptionTitle}>{formatSessionLabel(s)}</Text>
                  <Text style={styles.sessionOptionSub}>{s.date}</Text>
                </View>
                <Text style={[styles.sessionOptionTick, selected && styles.sessionOptionTickSelected]}>
                  {selected ? 'Selected' : 'Choose'}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => setSelectedSessionId(null)}
            style={[styles.sessionOption, selectedSessionId == null && styles.sessionOptionSelected]}
          >
            <View style={styles.sessionOptionBody}>
              <Text style={styles.sessionOptionTitle}>Bonus run</Text>
              <Text style={styles.sessionOptionSub}>Keep this off-plan and save without matching</Text>
            </View>
            <Text style={[styles.sessionOptionTick, selectedSessionId == null && styles.sessionOptionTickSelected]}>
              {selectedSessionId == null ? 'Selected' : 'Choose'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => { void handleSave(); }}
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save run'}</Text>
        </Pressable>
      </ScrollView>
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
  emptyAction: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.forest,
  },
  navBar: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 14,
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
  navTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 15,
    color: C.ink,
  },
  saveAction: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.forest,
  },
  saveActionDisabled: {
    opacity: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 4,
    marginBottom: 18,
  },
  matchChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
    borderWidth: 1,
  },
  matchChipActive: {
    backgroundColor: C.forestBg,
    borderColor: C.forest,
  },
  matchChipNeutral: {
    backgroundColor: C.surface,
    borderColor: C.border,
  },
  matchChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  matchChipTextActive: {
    color: C.forest,
  },
  matchChipTextNeutral: {
    color: C.muted,
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
    paddingHorizontal: 14,
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
    marginBottom: 20,
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.muted,
  },
  subMetricsBold: {
    color: C.ink,
    fontFamily: FONTS.monoBold,
  },
  section: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 18,
    color: C.ink,
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
    width: 36,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1,
  },
  splitPace: {
    width: 54,
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
    width: 58,
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
  sessionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    backgroundColor: C.surface,
  },
  sessionOptionSelected: {
    borderColor: C.forest,
    backgroundColor: C.forestBg,
  },
  sessionOptionBody: {
    flex: 1,
    paddingRight: 12,
  },
  sessionOptionTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
    marginBottom: 2,
  },
  sessionOptionSub: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
  },
  sessionOptionTick: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.clay,
  },
  sessionOptionTickSelected: {
    color: C.forest,
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
