import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type DimensionValue } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { expectedDistance, BODY_PARTS, NIGGLE_SEVERITIES, NIGGLE_WHEN_OPTIONS, type Activity, type BodyPart, type Niggle, type NiggleSeverity, type NiggleSide, type NiggleWhen, type PlannedSession, type SubjectiveBreathing, type SubjectiveInput, type SubjectiveLegs, type SubjectiveOverall } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useAuth } from '../../lib/auth';
import { listActivities } from '../../lib/activity-api';
import { trpc } from '../../lib/trpc';
import { usePlan } from '../../hooks/usePlan';
import { findSessionForDateOrWeekday, todayIsoLocal } from '../../lib/plan-helpers';
import { usePreferences } from '../../providers/preferences-context';
import { formatDistance, formatPace, formatSessionTitle, formatSplitLabel, formatStoredPace } from '../../lib/units';

// ─── Formatting helpers ───────────────────────────────────────────────────────

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

// ─── Niggle helpers ───────────────────────────────────────────────────────────

type NiggleDraft = { bodyPart: BodyPart; severity: NiggleSeverity; when: NiggleWhen; side: NiggleSide };

const BODY_PART_LABELS: Record<BodyPart, string> = {
  calf: 'Calf', knee: 'Knee', hamstring: 'Hamstring', quad: 'Quad',
  hip: 'Hip', glute: 'Glute', foot: 'Foot', shin: 'Shin',
  ankle: 'Ankle', achilles: 'Achilles', back: 'Back', other: 'Other',
};

const SEVERITY_LABELS: Record<NiggleSeverity, string> = {
  niggle: 'Niggle', mild: 'Mild', moderate: 'Moderate', stop: 'Stop',
};

const WHEN_LABELS: Record<NiggleWhen, string> = {
  before: 'Before', during: 'During', after: 'After',
};

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
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { units } = usePreferences();
  const { currentWeek, refresh: refreshPlan } = usePlan();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingFromStrava, setRefreshingFromStrava] = useState(false);
  const today = todayIsoLocal();
  const todaySession = findSessionForDateOrWeekday(currentWeek?.sessions ?? [], today);

  // Feel inputs
  const [legs, setLegs] = useState<SubjectiveLegs | null>(null);
  const [breathing, setBreathing] = useState<SubjectiveBreathing | null>(null);
  const [overall, setOverall] = useState<SubjectiveOverall | null>(null);
  const [notes, setNotes] = useState('');

  // Niggle inputs
  const [niggles, setNiggles] = useState<NiggleDraft[]>([]);
  const [addingNiggle, setAddingNiggle] = useState(false);
  const [niggleDraft, setNiggleDraft] = useState<Partial<NiggleDraft>>({});

  useEffect(() => {
    if (!session) {
      setActivities([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const userId = session.user.id;

    async function loadActivity() {
      try {
        setLoading(true);
        const next = await listActivities(userId);
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
  }, [activityId, session]);

  const activity = useMemo(
    () => activities.find((item) => item.id === activityId) ?? null,
    [activities, activityId],
  );

  // Only offer today's session — "I just finished this run" maps to today only
  const sessionOptions = useMemo(
    () => (todaySession && isRunnableSession(todaySession) ? [todaySession] : []),
    [todaySession],
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
    if (!activity || !subjectiveInput) return;

    try {
      setSaving(true);
      await trpc.activity.saveRunDetail.mutate({
        activityId: activity.id,
        subjectiveInput,
        niggles,
        notes: notes.trim() || undefined,
        matchedSessionId: selectedSessionId,
      });

      await refreshPlan();
      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('Failed to save synced run:', error);
      Alert.alert('Could not save run', 'Please try again in a moment.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshFromStrava() {
    if (!activity || activity.source !== 'strava') return;

    try {
      setRefreshingFromStrava(true);
      const refreshed = await trpc.strava.refreshActivity.mutate({ activityId: activity.id });
      setActivities((current) => current.map((item) => item.id === refreshed.id ? refreshed : item));
    } catch (error) {
      console.error('Failed to refresh Strava activity:', error);
      Alert.alert('Could not re-sync run', 'Please try again in a moment.');
    } finally {
      setRefreshingFromStrava(false);
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
  const canSave = feelComplete && !saving;

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
          <Text style={styles.saveAction}>Save</Text>
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
            {selectedSession ? formatSessionTitle(selectedSession, units) : 'Bonus run'}
          </Text>
          <Text style={styles.runMeta}>{formatRunMeta(activity.startTime)}</Text>
        </View>

        {/* Metric grid */}
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
              <Text style={styles.pvaValue}>{formatDistance(expectedDistance(selectedSession), units, { spaced: true })}</Text>
              <Text style={styles.pvaValue}>{formatStoredPace(selectedSession.pace, units, { withUnit: true })}</Text>
            </View>
            <View style={styles.pvaRow}>
              <Text style={styles.pvaLabel}>Actual</Text>
              <Text style={styles.pvaValue}>{formatDistance(activity.distance, units, { spaced: true })}</Text>
              <Text style={styles.pvaValue}>{formatPace(activity.avgPace, units, { withUnit: true })}</Text>
            </View>
          </View>
        ) : null}

        {activity.source === 'strava' ? (
          <View style={styles.section}>
            <Pressable
              style={[styles.secondaryButton, refreshingFromStrava && styles.secondaryButtonDisabled]}
              onPress={() => { void handleRefreshFromStrava(); }}
              disabled={refreshingFromStrava}
            >
              <Text style={styles.secondaryButtonText}>
                {refreshingFromStrava ? 'Re-syncing…' : 'Re-sync from Strava'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Splits */}
        {activity.splits.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Splits</Text>
            {activity.splits.map((split) => (
              <View key={split.km} style={styles.splitRow}>
                <Text style={styles.splitKm}>{formatSplitLabel(split, units)}</Text>
                <Text style={styles.splitPace}>{formatPace(split.pace, units)}</Text>
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

        {/* Any niggles? */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Any niggles?</Text>
          {niggles.map((n, i) => (
            <View key={i} style={styles.niggleRow}>
              <Text style={styles.niggleText}>
                {BODY_PART_LABELS[n.bodyPart]}{n.side ? ` (${n.side})` : ''} · {SEVERITY_LABELS[n.severity]} · {WHEN_LABELS[n.when]}
              </Text>
              <Pressable onPress={() => setNiggles((prev) => prev.filter((_, j) => j !== i))}>
                <Text style={styles.niggleRemove}>✕</Text>
              </Pressable>
            </View>
          ))}

          {addingNiggle ? (
            <View style={styles.niggleForm}>
              <Text style={styles.niggleFormLabel}>Body part</Text>
              <View style={styles.feelChips}>
                {BODY_PARTS.map((bp) => (
                  <Pressable
                    key={bp}
                    onPress={() => setNiggleDraft((d) => ({ ...d, bodyPart: bp }))}
                    style={[styles.feelChip, niggleDraft.bodyPart === bp && styles.feelChipSelected]}
                  >
                    <Text style={[styles.feelChipText, niggleDraft.bodyPart === bp && styles.feelChipTextSelected]}>
                      {BODY_PART_LABELS[bp]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.niggleFormLabel}>Severity</Text>
              <View style={styles.feelChips}>
                {NIGGLE_SEVERITIES.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setNiggleDraft((d) => ({ ...d, severity: s }))}
                    style={[styles.feelChip, niggleDraft.severity === s && styles.feelChipSelected]}
                  >
                    <Text style={[styles.feelChipText, niggleDraft.severity === s && styles.feelChipTextSelected]}>
                      {SEVERITY_LABELS[s]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.niggleFormLabel}>When</Text>
              <View style={styles.feelChips}>
                {NIGGLE_WHEN_OPTIONS.map((w) => (
                  <Pressable
                    key={w}
                    onPress={() => setNiggleDraft((d) => ({ ...d, when: w }))}
                    style={[styles.feelChip, niggleDraft.when === w && styles.feelChipSelected]}
                  >
                    <Text style={[styles.feelChipText, niggleDraft.when === w && styles.feelChipTextSelected]}>
                      {WHEN_LABELS[w]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.niggleFormLabel}>Side</Text>
              <View style={styles.feelChips}>
                {(['left', 'right', null] as NiggleSide[]).map((side) => (
                  <Pressable
                    key={String(side)}
                    onPress={() => setNiggleDraft((d) => ({ ...d, side }))}
                    style={[styles.feelChip, niggleDraft.side === side && styles.feelChipSelected]}
                  >
                    <Text style={[styles.feelChipText, niggleDraft.side === side && styles.feelChipTextSelected]}>
                      {side ?? 'Both/N/A'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.niggleFormActions}>
                <Pressable
                  onPress={() => {
                    const { bodyPart, severity, when } = niggleDraft;
                    if (bodyPart && severity && when) {
                      setNiggles((prev) => [...prev, { bodyPart, severity, when, side: niggleDraft.side ?? null }]);
                      setNiggleDraft({});
                      setAddingNiggle(false);
                    }
                  }}
                  style={styles.niggleConfirm}
                >
                  <Text style={styles.niggleConfirmText}>Add niggle</Text>
                </Pressable>
                <Pressable onPress={() => { setAddingNiggle(false); setNiggleDraft({}); }}>
                  <Text style={styles.niggleCancel}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setAddingNiggle(true)} style={styles.niggleAdd}>
              <Text style={styles.niggleAddText}>+ Add niggle</Text>
            </Pressable>
          )}
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
                  <Text style={styles.sessionOptionTitle}>{formatSessionTitle(s, units)}</Text>
                  <Text style={styles.sessionOptionSub}>{s.date}</Text>
                </View>
                <Text style={[styles.sessionOptionTick, selected && styles.sessionOptionTickSelected]}>
                  {selected ? 'Matched to today' : 'Match to today'}
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
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          disabled={!canSave}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving…' : feelComplete ? 'Save run' : 'Fill in how it felt to save'}
          </Text>
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
  saveAction: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.forest,
  },
  saveActionButtonDisabled: {
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
    width: 52,
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
  secondaryButton: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  secondaryButtonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
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
  niggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  niggleText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink,
    flex: 1,
  },
  niggleRemove: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.clay,
    paddingLeft: 12,
  },
  niggleAdd: {
    paddingVertical: 8,
  },
  niggleAddText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.forest,
  },
  niggleForm: {
    marginTop: 8,
    gap: 8,
  },
  niggleFormLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  niggleFormActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  niggleConfirm: {
    backgroundColor: C.forest,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  niggleConfirmText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.surface,
  },
  niggleCancel: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
  },
});
