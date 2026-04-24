import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  normalizeSessionDuration,
  summariseVsPlan,
  type Activity,
  type PlannedSession,
  type PvaHeadline,
  type SubjectiveInput,
  type SubjectiveBreathing,
  type SubjectiveLegs,
  type SubjectiveOverall,
} from '@steady/types';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { C } from '../../constants/colours';
import { usePreferences } from '../../providers/preferences-context';
import {
  formatDistance,
  formatIntervalRepLength,
  formatPace,
  formatSessionLabel,
  formatSessionTitle,
  formatStoredPace,
  formatWarmupCooldown,
} from '../../lib/units';

interface ActivitySummary {
  id: string;
  distance: number;
  avgPace: number; // seconds per km
  duration: number; // seconds
  avgHR?: number;
  elevationGain?: number;
  subjectiveInput?: SubjectiveInput;
}

interface TodayHeroCardProps {
  session: PlannedSession | null;
  activity?: ActivitySummary;
  steadyNote?: string | null;
  onPress?: () => void;
  onReviewRun?: () => void;
  onSaveSubjectiveInput?: (input: SubjectiveInput) => void | Promise<void>;
  onDismissSubjectiveInput?: () => void | Promise<void>;
}

const PLANNED_CARD_BG: Record<Exclude<PlannedSession['type'], 'REST'>, string> = {
  EASY: '#E6F0EA',
  INTERVAL: '#F9E3DA',
  TEMPO: '#F1E8DA',
  LONG: '#E5ECF7',
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const COMPLETED_HEADLINES: Record<PvaHeadline, string> = {
  'on-target': 'On target',
  'crushed-it': 'Crushed it',
  'eased-in': 'Eased in',
  'cut-short': 'Cut short',
  'bonus-effort': 'Longer than planned',
  'under-distance': 'Under distance',
  'over-pace': 'Went out hot',
  'hr-high': 'Heart rate high',
};

function formatSessionDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[value.getUTCDay()]}, ${MONTHS[value.getUTCMonth()]} ${value.getUTCDate()}`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function plannedHeartRateZone(session: PlannedSession): string {
  switch (session.type) {
    case 'INTERVAL':
      return 'Zone 5';
    case 'TEMPO':
      return 'Zone 4';
    case 'LONG':
      return 'Zone 2';
    case 'EASY':
    default:
      return 'Zone 2';
  }
}

function titleCase(value: string): string {
  return value
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function sentenceCaseFact(fact: string): string {
  return `${fact.slice(0, 1).toUpperCase()}${fact.slice(1)}`;
}

function toSummaryActivity(activity: ActivitySummary): Activity {
  return {
    id: activity.id,
    userId: 'summary',
    source: 'manual',
    externalId: activity.id,
    startTime: '1970-01-01T00:00:00.000Z',
    distance: activity.distance,
    duration: activity.duration,
    elevationGain: activity.elevationGain,
    avgPace: activity.avgPace,
    avgHR: activity.avgHR,
    splits: [],
    subjectiveInput: activity.subjectiveInput,
  };
}

function buildCompletedSummary(session: PlannedSession, activity?: ActivitySummary) {
  if (!activity) {
    return {
      headline: 'Run saved',
      subcopy: 'Saved to your week. Open run detail to review feel, notes, or niggles.',
    };
  }

  const summary = summariseVsPlan(session, toSummaryActivity(activity));
  const primaryFact = (
    summary.verdicts.find((verdict) => verdict.kind === 'hr')
    ?? summary.verdicts.find((verdict) => verdict.status !== 'ok')
    ?? summary.verdicts.find((verdict) => verdict.kind === 'pace')
    ?? summary.verdicts[0]
  );

  return {
    headline: COMPLETED_HEADLINES[summary.headline],
    subcopy: `${formatDistance(activity.distance, 'metric')} at ${formatPace(activity.avgPace, 'metric', { withUnit: true })} · ${sentenceCaseFact(primaryFact.fact)}`,
  };
}

function buildCompletedMetrics(session: PlannedSession, activity: ActivitySummary | undefined, units: ReturnType<typeof usePreferences>['units']) {
  if (!activity) {
    return [
      {
        value: formatDistance(session.distance ?? 0, units),
        label: 'planned km',
      },
      {
        value: formatStoredPace(session.pace, units),
        label: 'target pace',
      },
      {
        value: SESSION_TYPE[session.type].label,
        label: 'session',
      },
    ];
  }

  return [
    {
      value: formatDistance(activity.distance, units),
      label: 'distance',
    },
    {
      value: formatPace(activity.avgPace, units),
      label: 'avg pace',
    },
    activity.avgHR != null
      ? {
          value: `${activity.avgHR}`,
          label: 'avg bpm',
        }
      : {
          value: formatDuration(activity.duration),
          label: 'elapsed',
        },
  ];
}

function SavedSubjectiveInput({ input }: { input: SubjectiveInput }) {
  return (
    <View style={styles.savedFeelGroup}>
      <View style={styles.savedFeelChips}>
        <View style={styles.savedFeelChip}>
          <Text style={styles.savedFeelChipText}>Legs: {titleCase(input.legs)}</Text>
        </View>
        <View style={styles.savedFeelChip}>
          <Text style={styles.savedFeelChipText}>Breathing: {titleCase(input.breathing)}</Text>
        </View>
        <View style={styles.savedFeelChip}>
          <Text style={styles.savedFeelChipText}>Overall: {titleCase(input.overall)}</Text>
        </View>
      </View>
    </View>
  );
}

export function TodayHeroCard({
  session,
  activity,
  steadyNote,
  onPress,
  onReviewRun,
  onSaveSubjectiveInput,
  onDismissSubjectiveInput,
}: TodayHeroCardProps) {
  const { units } = usePreferences();
  if (!session || session.type === 'REST') {
    return (
      <View style={[styles.card, { backgroundColor: '#F7F5F1' }]} testID="hero-card">
        <Text style={styles.restTitle}>Rest day</Text>
        <Text style={styles.restSubtitle}>Recovery is part of the plan. You earned this.</Text>
      </View>
    );
  }

  const meta = SESSION_TYPE[session.type];
  const isInterval = session.type === 'INTERVAL';
  const warmup = normalizeSessionDuration(session.warmup);
  const cooldown = normalizeSessionDuration(session.cooldown);
  const completed = Boolean(session.actualActivityId || activity);
  const savedSubjectiveInput = activity?.subjectiveInput;
  const completedSummary = buildCompletedSummary(session, activity);
  const completedMetrics = buildCompletedMetrics(session, activity, units);
  const showSubjectivePrompt =
    !!session.actualActivityId &&
    !savedSubjectiveInput &&
    Boolean(onSaveSubjectiveInput || onDismissSubjectiveInput);

  if (completed) {
    const content = (
      <>
        <View style={styles.completedTopRow}>
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeTick}>✓</Text>
            <Text style={styles.completedBadgeText}>Completed</Text>
          </View>
          <View
            style={[
              styles.completedTypeChip,
              { borderColor: `${meta.color}35`, backgroundColor: meta.bg },
            ]}
          >
            <Text style={[styles.completedTypeChipText, { color: meta.color }]}>{session.type}</Text>
          </View>
        </View>

        <Text style={[styles.completedHeadline, { color: meta.color }]}>
          {completedSummary.headline}
        </Text>
        <Text style={styles.completedSubcopy}>
          {activity ? (
            <>
              <Text style={styles.completedSubcopyMetric}>{formatDistance(activity.distance, units)}</Text>
              <Text> at </Text>
              <Text style={styles.completedSubcopyMetric}>{formatPace(activity.avgPace, units, { withUnit: true })}</Text>
              <Text>{completedSummary.subcopy.split(' · ').length > 1 ? ` · ${completedSummary.subcopy.split(' · ').slice(1).join(' · ')}` : ''}</Text>
            </>
          ) : (
            <>
              <Text style={styles.completedSubcopyMetric}>{formatSessionLabel(session, units)}</Text>
              <Text>{` · ${completedSummary.subcopy}`}</Text>
            </>
          )}
        </Text>

        <View style={styles.completedMetricRow}>
          {completedMetrics.map((metric) => (
            <View key={metric.label} style={styles.completedMetricCard}>
              <Text style={styles.completedMetricValue}>{metric.value}</Text>
              <Text style={styles.completedMetricLabel}>{metric.label}</Text>
            </View>
          ))}
        </View>

        {savedSubjectiveInput ? (
          <SavedSubjectiveInput input={savedSubjectiveInput} />
        ) : null}
        {showSubjectivePrompt ? (
          <SubjectiveInputPrompt
            onSave={onSaveSubjectiveInput}
            onDismiss={onDismissSubjectiveInput}
          />
        ) : null}
        {onReviewRun ? (
          <Pressable
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation?.();
              onReviewRun();
            }}
            style={styles.reviewLink}
            testID="hero-review-run"
          >
            <View>
              <Text style={styles.reviewLinkText}>Review run</Text>
              <Text style={styles.reviewLinkHint}>Open run detail and edit notes or feel.</Text>
            </View>
            <Text style={styles.reviewLinkArrow}>›</Text>
          </Pressable>
        ) : null}
      </>
    );

    if (onPress) {
      return (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [
            styles.card,
            styles.completedCard,
            { backgroundColor: meta.bg },
            pressed && styles.cardPressed,
          ]}
          testID="hero-completed"
        >
          {content}
        </Pressable>
      );
    }

    return (
      <View style={[styles.card, styles.completedCard, { backgroundColor: meta.bg }]} testID="hero-completed">
        {content}
      </View>
    );
  }

  const plannedType = session.type as Exclude<PlannedSession['type'], 'REST'>;
  const steadyNoteContent = steadyNote ? (
    <>
      <View style={styles.steadyNoteMain}>
        <View style={[styles.steadyDot, { backgroundColor: meta.color }]} />
        <Text style={styles.steadyText}>
          <Text style={styles.steadyLabel}>Steady</Text>: {steadyNote}
        </Text>
      </View>
    </>
  ) : null;
  const plannedContent = (
    <>
      <View style={styles.topRow}>
        <Text
          style={[
            styles.typeLabel,
            styles.typeLabelChip,
            { color: C.surface, backgroundColor: meta.color, borderColor: meta.color },
          ]}
          testID="hero-type-chip"
        >
          {session.type}
        </Text>
        <Text style={styles.todayBadge}>TODAY</Text>
      </View>

      <Text style={[styles.mainTitle, { color: meta.color }]}>{formatSessionTitle(session, units)}</Text>
      <Text style={styles.dateText}>{formatSessionDate(session.date)}</Text>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>
            {isInterval ? `${session.reps}×${formatIntervalRepLength(session)}` : formatDistance(session.distance ?? 0, units)}
          </Text>
          <Text style={styles.metricLabel}>{isInterval ? 'session' : 'distance'}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{formatStoredPace(session.pace, units)}</Text>
          <Text style={styles.metricLabel}>target pace</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{plannedHeartRateZone(session)}</Text>
          <Text style={styles.metricLabel}>heart rate</Text>
        </View>
      </View>

      {(warmup || cooldown) && (
        <View style={styles.extras}>
          {warmup ? (
            <Text style={styles.extraText}>{formatWarmupCooldown(warmup, units, 'warmup')}</Text>
          ) : null}
          {cooldown ? (
            <Text style={styles.extraText}>{formatWarmupCooldown(cooldown, units, 'cooldown')}</Text>
          ) : null}
        </View>
      )}
      {steadyNote ? (
        <View style={styles.steadyNote} testID="hero-steady-note">
          {steadyNoteContent}
        </View>
      ) : null}
      {showSubjectivePrompt ? (
        <SubjectiveInputPrompt
          onSave={onSaveSubjectiveInput}
          onDismiss={onDismissSubjectiveInput}
        />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          styles.plannedCard,
          { backgroundColor: PLANNED_CARD_BG[plannedType], borderColor: meta.color },
          pressed && styles.cardPressed,
        ]}
        testID="hero-card"
      >
        {plannedContent}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.card,
        styles.plannedCard,
        { backgroundColor: PLANNED_CARD_BG[plannedType], borderColor: meta.color },
      ]}
      testID="hero-card"
    >
      {plannedContent}
    </View>
  );
}

interface Option<T extends string> {
  label: string;
  value: T;
}

const LEG_OPTIONS: Option<SubjectiveLegs>[] = [
  { label: 'Fresh', value: 'fresh' },
  { label: 'Normal', value: 'normal' },
  { label: 'Heavy', value: 'heavy' },
  { label: 'Dead', value: 'dead' },
];

const BREATHING_OPTIONS: Option<SubjectiveBreathing>[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Controlled', value: 'controlled' },
  { label: 'Labored', value: 'labored' },
];

const OVERALL_OPTIONS: Option<SubjectiveOverall>[] = [
  { label: 'Could go again', value: 'could-go-again' },
  { label: 'Done', value: 'done' },
  { label: 'Shattered', value: 'shattered' },
];

function OptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionRow}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.optionButtons}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.optionButton, selected && styles.optionButtonSelected]}
            >
              <Text style={[styles.optionButtonText, selected && styles.optionButtonTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SubjectiveInputPrompt({
  onSave,
  onDismiss,
}: {
  onSave?: (input: SubjectiveInput) => void | Promise<void>;
  onDismiss?: () => void | Promise<void>;
}) {
  const [legs, setLegs] = useState<SubjectiveLegs>('normal');
  const [breathing, setBreathing] = useState<SubjectiveBreathing>('controlled');
  const [overall, setOverall] = useState<SubjectiveOverall>('done');

  return (
    <View style={styles.subjectivePrompt} testID="subjective-input-prompt">
      <View style={styles.promptHeader}>
        <View>
          <Text style={styles.promptTitle}>How did that feel?</Text>
          <Text style={styles.promptSubtitle}>Three quick taps for your coach.</Text>
        </View>
        {onDismiss ? (
          <Pressable onPress={onDismiss} style={styles.dismissButton}>
            <Text style={styles.dismissText}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <OptionRow label="Legs" options={LEG_OPTIONS} value={legs} onChange={setLegs} />
      <OptionRow
        label="Breathing"
        options={BREATHING_OPTIONS}
        value={breathing}
        onChange={setBreathing}
      />
      <OptionRow label="Overall" options={OVERALL_OPTIONS} value={overall} onChange={setOverall} />

      <Pressable
        onPress={() => onSave?.({ legs, breathing, overall })}
        style={styles.saveFeelButton}
      >
        <Text style={styles.saveFeelText}>Save feel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    minHeight: 180,
    justifyContent: 'center',
  },
  completedCard: {
    justifyContent: 'flex-start',
    borderWidth: 1.5,
    borderColor: 'rgba(28,21,16,0.08)',
  },
  plannedCard: {
    borderWidth: 1.5,
  },
  cardPressed: {
    opacity: 0.84,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  typeLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  typeLabelChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  todayBadge: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.amber,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  completedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.forestBg,
    borderWidth: 1,
    borderColor: 'rgba(42,92,69,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  completedBadgeTick: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.forest,
  },
  completedBadgeText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.forest,
  },
  completedTypeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  completedTypeChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mainStat: {
    fontFamily: FONTS.serifBold,
    fontSize: 26,
    marginBottom: 12,
  },
  completedHeadline: {
    fontFamily: FONTS.serifBold,
    fontSize: 28,
    marginBottom: 8,
  },
  completedSubcopy: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
    color: C.ink2,
    marginBottom: 16,
  },
  completedSubcopyMetric: {
    fontFamily: FONTS.monoBold,
    color: C.ink,
  },
  completedMetricRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  completedMetricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(28,21,16,0.08)',
  },
  completedMetricValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 17,
    color: C.ink,
    marginBottom: 3,
  },
  completedMetricLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  mainTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 30,
    marginBottom: 8,
  },
  dateText: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
    marginBottom: 16,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricValue: {
    fontFamily: FONTS.serifBold,
    fontSize: 20,
    color: C.ink,
    marginBottom: 2,
  },
  metricLabel: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    textTransform: 'lowercase',
  },
  extras: {
    flexDirection: 'row',
    gap: 12,
  },
  steadyNote: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(28,21,16,0.08)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  steadyNoteMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  steadyDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginTop: 7,
  },
  steadyLabel: {
    fontFamily: FONTS.sansSemiBold,
    color: C.ink,
  },
  steadyText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.ink2,
  },
  extraText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink2,
  },
  savedFeelGroup: {
    marginTop: 2,
  },
  savedFeelChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  savedFeelChip: {
    borderWidth: 1,
    borderColor: 'rgba(28,21,16,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  savedFeelChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  reviewLink: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(42,92,69,0.18)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewLinkText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.forest,
  },
  reviewLinkHint: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.ink2,
    marginTop: 3,
  },
  reviewLinkArrow: {
    fontFamily: FONTS.serifBold,
    fontSize: 18,
    color: C.forest,
    marginTop: -1,
  },
  subjectivePrompt: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(28,21,16,0.14)',
    gap: 10,
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  promptTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  promptSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.ink2,
    marginTop: 2,
  },
  dismissButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dismissText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.muted,
  },
  optionRow: {
    gap: 5,
  },
  optionLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.ink2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: 'rgba(28,21,16,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  optionButtonSelected: {
    backgroundColor: C.ink,
    borderColor: C.ink,
  },
  optionButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  optionButtonTextSelected: {
    color: C.surface,
  },
  saveFeelButton: {
    alignSelf: 'flex-start',
    marginTop: 2,
    backgroundColor: C.clay,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveFeelText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.surface,
  },
  restTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 24,
    color: C.ink,
    marginBottom: 6,
  },
  restSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
    lineHeight: 20,
  },
});
