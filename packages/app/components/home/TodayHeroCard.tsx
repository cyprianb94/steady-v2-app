import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Easing, View, Text, Pressable, StyleSheet } from 'react-native';
import {
  buildStructuredQualitySummary,
  normalizeSessionDuration,
  summariseVsPlan,
  type Activity,
  type PlannedSession,
  type PvaHeadline,
  type StructuredQualitySummary,
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
  formatIntensityTargetDisplay,
  formatIntensityTargetParts,
  formatIntervalRepLength,
  formatPace,
  formatSessionLabel,
  formatSessionTitle,
  formatStoredPace,
} from '../../lib/units';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface ActivitySummary {
  id: string;
  distance: number;
  avgPace: number; // seconds per km
  duration: number; // seconds
  avgHR?: number;
  elevationGain?: number;
  splits?: Activity['splits'];
  subjectiveInput?: SubjectiveInput;
}

interface TodayHeroCardProps {
  session: PlannedSession | null;
  activity?: ActivitySummary;
  onPress?: () => void;
  onLogRun?: () => void;
  onReviewRun?: () => void;
  onSaveSubjectiveInput?: (input: SubjectiveInput) => void | Promise<void>;
  onDismissSubjectiveInput?: () => void | Promise<void>;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const COMPLETED_HEADLINES: Record<PvaHeadline, string> = {
  'on-target': 'On target',
  'crushed-it': 'Crushed it',
  'eased-in': 'Eased off',
  'cut-short': 'Cut short',
  'bonus-effort': 'Longer than planned',
  'under-distance': 'Under distance',
  'over-pace': 'Went out hot',
  'hr-high': 'Heart rate high',
};
const SESSION_CARD_GRADIENT_LOCATIONS = [0, 0.34, 0.68, 1] as const;
const SESSION_CARD_GRADIENT_START = { x: 0, y: 0.5 } as const;
const SESSION_CARD_GRADIENT_END = { x: 1, y: 0.5 } as const;

type MetricKind = 'distance' | 'pace' | 'time' | 'effort' | 'neutral';

interface PlannedTargetDisplay {
  label: string;
  primary: string | null;
  primaryKind: MetricKind;
  secondary: string | null;
  secondaryKind: MetricKind;
}

interface CompletedEvidenceRow {
  label: string;
  value: string | null;
  kind: MetricKind;
}

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

function titleCase(value: string): string {
  return value
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function metricValueStyle(kind: MetricKind) {
  switch (kind) {
    case 'distance':
      return styles.metricDistanceValue;
    case 'pace':
      return styles.metricPaceValue;
    case 'time':
      return styles.metricTimeValue;
    case 'effort':
      return styles.metricEffortValue;
    case 'neutral':
    default:
      return styles.metricNeutralValue;
  }
}

function sessionCardGradientColors(sessionType: PlannedSession['type']) {
  const meta = SESSION_TYPE[sessionType];

  return [`${meta.color}0C`, `${meta.color}07`, `${meta.color}02`, `${meta.color}00`] as const;
}

function SessionCardAtmosphere({ sessionType }: { sessionType: PlannedSession['type'] }) {
  return (
    <LinearGradient
      colors={sessionCardGradientColors(sessionType)}
      locations={SESSION_CARD_GRADIENT_LOCATIONS}
      start={SESSION_CARD_GRADIENT_START}
      end={SESSION_CARD_GRADIENT_END}
      pointerEvents="none"
      style={styles.sessionAtmosphere}
      testID="hero-card-atmosphere"
    />
  );
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
    splits: activity.splits ?? [],
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
    summary.verdicts.find((verdict) => verdict.status === 'warn')
    ?? summary.verdicts.find((verdict) => verdict.kind === 'pace')
    ?? summary.verdicts.find((verdict) => verdict.kind === 'hr')
    ?? summary.verdicts[0]
  );

  return {
    headline: COMPLETED_HEADLINES[summary.headline],
    subcopy: `${formatDistance(activity.distance, 'metric')} at ${formatPace(activity.avgPace, 'metric', { withUnit: true })} · ${sentenceCaseFact(primaryFact.fact)}`,
  };
}

function buildQualitySummary(
  session: PlannedSession,
  activity: ActivitySummary | undefined,
): StructuredQualitySummary | null {
  if (!activity || (session.type !== 'TEMPO' && session.type !== 'INTERVAL')) {
    return null;
  }

  return buildStructuredQualitySummary(session, toSummaryActivity(activity));
}

function qualitySummaryNeedsReview(summary: StructuredQualitySummary | null): boolean {
  if (!summary || summary.status !== 'available') {
    return false;
  }

  if (summary.sessionType === 'INTERVAL') {
    const reps = summary.intervalReps;
    return reps?.inTargetRange != null && reps.inTargetRange < reps.planned;
  }

  const target = summary.targetPaceRange;
  if (!target) {
    return false;
  }

  const fastest = Math.min(target.minSecondsPerKm, target.maxSecondsPerKm);
  const slowest = Math.max(target.minSecondsPerKm, target.maxSecondsPerKm);
  return summary.averagePaceSecondsPerKm < fastest || summary.averagePaceSecondsPerKm > slowest;
}

function completedHeadline(
  summary: ReturnType<typeof buildCompletedSummary>,
  qualitySummary: StructuredQualitySummary | null,
  needsReview: boolean,
): string {
  if (qualitySummary?.status === 'available') {
    if (qualitySummary.sessionType === 'TEMPO') {
      return needsReview ? 'Tempo needs review' : 'Tempo on target';
    }

    return needsReview ? 'Rep work needs review' : 'Rep work on target';
  }

  return summary.headline;
}

function qualityEvidenceSentence(
  summary: StructuredQualitySummary | null,
  units: ReturnType<typeof usePreferences>['units'],
  needsReview: boolean,
): string | null {
  if (!summary || summary.status !== 'available') {
    return null;
  }

  const pace = formatPace(summary.averagePaceSecondsPerKm, units, {
    withUnit: true,
    compactUnit: true,
  });

  if (summary.sessionType === 'TEMPO') {
    return `Tempo block averaged ${pace} · ${needsReview ? 'outside target.' : 'inside target.'}`;
  }

  const reps = summary.intervalReps;
  const repCopy = reps?.inTargetRange != null
    ? `${reps.inTargetRange} / ${reps.planned} reps inside target`
    : `${reps?.found ?? 0} / ${reps?.planned ?? 0} reps found`;
  return `${repCopy} · rep average ${pace}.`;
}

function completedSummaryFact(subcopy: string): string {
  const [, ...facts] = subcopy.split(' · ');
  return facts.length ? facts.join(' · ') : subcopy;
}

function buildCompletedEvidenceRows({
  session,
  activity,
  units,
  qualitySummary,
  canAddFeel,
}: {
  session: PlannedSession;
  activity: ActivitySummary | undefined;
  units: ReturnType<typeof usePreferences>['units'];
  qualitySummary: StructuredQualitySummary | null;
  canAddFeel: boolean;
}): CompletedEvidenceRow[] {
  if (qualitySummary?.status === 'available') {
    if (qualitySummary.sessionType === 'INTERVAL') {
      const reps = qualitySummary.intervalReps;
      return [
        {
          label: reps?.inTargetRange != null ? 'Reps in range' : 'Reps found',
          value: reps ? `${reps.inTargetRange ?? reps.found} / ${reps.planned}` : null,
          kind: 'neutral',
        },
        {
          label: 'Quality pace',
          value: formatPace(qualitySummary.averagePaceSecondsPerKm, units, {
            withUnit: true,
            compactUnit: true,
          }),
          kind: 'pace',
        },
      ];
    }

    return [
      {
        label: 'Quality pace',
        value: formatPace(qualitySummary.averagePaceSecondsPerKm, units, {
          withUnit: true,
          compactUnit: true,
        }),
        kind: 'pace',
      },
      {
        label: 'Tempo time',
        value: formatDuration(Math.round(
          qualitySummary.averagePaceSecondsPerKm * qualitySummary.qualityDistanceKm,
        )),
        kind: 'time',
      },
    ];
  }

  if (!activity) {
    const target = formatIntensityTargetDisplay(session, units, {
      fallbackToLegacyPace: true,
      withUnit: true,
    });
    return [
      {
        label: 'Planned',
        value: formatSessionLabel(session, units),
        kind: 'neutral',
      },
      {
        label: 'Target',
        value: target,
        kind: target?.includes(':') ? 'pace' : 'effort',
      },
    ];
  }

  const rows: CompletedEvidenceRow[] = [
    {
      label: 'Distance',
      value: `${formatDistance(activity.distance, units)} / ${formatDistance(session.distance ?? 0, units)}`,
      kind: 'distance',
    },
    {
      label: 'Pace',
      value: formatPace(activity.avgPace, units, { withUnit: true, compactUnit: true }),
      kind: 'pace',
    },
  ];

  if (activity.subjectiveInput) {
    rows.push({
      label: 'Feel',
      value: titleCase(activity.subjectiveInput.overall),
      kind: 'effort',
    });
  } else if (canAddFeel) {
    rows.push({
      label: 'Feel',
      value: 'add feel',
      kind: 'effort',
    });
  }

  return rows;
}

function buildPlannedTargetDisplay(
  session: PlannedSession,
  units: ReturnType<typeof usePreferences>['units'],
): PlannedTargetDisplay {
  const targetParts = formatIntensityTargetParts(session, units, {
    hideCompatibilityPace: true,
    withUnit: true,
  });
  const legacyPace = targetParts.pace || targetParts.effort
    ? null
    : formatStoredPace(session.pace, units, { withUnit: true, compactUnit: true });
  const pace = targetParts.pace ?? (legacyPace === '—' ? null : legacyPace);
  const effort = targetParts.effort;
  const prefersPacePrimary = session.type === 'TEMPO' || session.type === 'INTERVAL';
  const label = session.type === 'TEMPO'
    ? 'Tempo target'
    : session.type === 'INTERVAL'
      ? 'Rep target'
      : 'Target';

  if (prefersPacePrimary) {
    return {
      label,
      primary: pace ?? effort,
      primaryKind: pace ? 'pace' : effort ? 'effort' : 'neutral',
      secondary: pace ? effort : null,
      secondaryKind: 'effort',
    };
  }

  return {
    label,
    primary: effort ?? pace,
    primaryKind: effort ? 'effort' : pace ? 'pace' : 'neutral',
    secondary: effort ? pace : null,
    secondaryKind: 'pace',
  };
}

function formatShortDuration(
  duration: ReturnType<typeof normalizeSessionDuration>,
  units: ReturnType<typeof usePreferences>['units'],
  label: 'warm' | 'cool',
): string | null {
  if (!duration) {
    return null;
  }

  if (duration.unit === 'min') {
    return `${duration.value} min ${label}`;
  }

  return `${formatDistance(duration.value, units)} ${label}`;
}

function formatRecoveryDetail(
  recovery: PlannedSession['recovery'],
  units: ReturnType<typeof usePreferences>['units'],
): string | null {
  if (!recovery) {
    return null;
  }

  if (typeof recovery === 'string') {
    return `${recovery} recoveries`;
  }

  const normalized = normalizeSessionDuration(recovery);
  if (!normalized) {
    return null;
  }

  if (normalized.unit === 'min') {
    return `${normalized.value} min recoveries`;
  }

  return `${formatDistance(normalized.value, units)} recoveries`;
}

function buildPlannedDetailLine(
  session: PlannedSession,
  units: ReturnType<typeof usePreferences>['units'],
): string | null {
  const warmup = normalizeSessionDuration(session.warmup);
  const cooldown = normalizeSessionDuration(session.cooldown);

  if (session.type === 'TEMPO') {
    const parts = [
      typeof session.distance === 'number' ? `${formatDistance(session.distance, units)} total` : null,
      formatShortDuration(warmup, units, 'warm'),
      formatShortDuration(cooldown, units, 'cool'),
    ].filter((part): part is string => Boolean(part));
    return parts.length ? parts.join(' · ') : null;
  }

  if (session.type === 'INTERVAL') {
    const parts = [
      formatRecoveryDetail(session.recovery, units),
      formatShortDuration(warmup, units, 'warm'),
      formatShortDuration(cooldown, units, 'cool'),
    ].filter((part): part is string => Boolean(part));
    return parts.length ? parts.join(' · ') : null;
  }

  return null;
}

function CompletedEvidenceList({ rows }: { rows: CompletedEvidenceRow[] }) {
  return (
    <View style={styles.evidenceList}>
      {rows.map((row) => (
        <View key={row.label} style={styles.evidenceRow}>
          <Text style={styles.evidenceLabel}>{row.label}</Text>
          <Text style={[styles.evidenceValue, metricValueStyle(row.kind)]}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function TodayHeroCard({
  session,
  activity,
  onPress,
  onLogRun,
  onReviewRun,
  onSaveSubjectiveInput,
  onDismissSubjectiveInput,
}: TodayHeroCardProps) {
  const { units } = usePreferences();
  const completed = Boolean(session && session.type !== 'REST' && (session.actualActivityId || activity));
  const reducedMotion = useReducedMotion();
  const completedReveal = useRef(new Animated.Value(completed ? 1 : 0)).current;
  const wasCompleted = useRef(completed);

  useEffect(() => {
    if (!completed) {
      completedReveal.setValue(0);
      wasCompleted.current = false;
      return;
    }

    const shouldReveal = !wasCompleted.current;
    wasCompleted.current = true;

    if (reducedMotion) {
      completedReveal.setValue(1);
      return;
    }

    if (shouldReveal) {
      completedReveal.setValue(0);
    }

    Animated.timing(completedReveal, {
      toValue: 1,
      duration: shouldReveal ? 340 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [completed, completedReveal, reducedMotion]);

  const completedRevealStyle = useMemo(
    () => ({
      opacity: completedReveal,
      transform: [
        {
          translateY: completedReveal.interpolate({
            inputRange: [0, 1],
            outputRange: [6, 0],
            extrapolate: 'clamp',
          }),
        },
      ],
    }),
    [completedReveal],
  );

  if (!session || session.type === 'REST') {
    const restMeta = SESSION_TYPE.REST;
    return (
      <View
        style={[styles.card, styles.plannedCard, { backgroundColor: C.surface, borderColor: restMeta.color }]}
        testID="hero-card"
      >
        <SessionCardAtmosphere sessionType="REST" />
        <View style={styles.topRow}>
          <Text
            style={[
              styles.typeLabel,
              styles.typeLabelChip,
              { color: C.surface, backgroundColor: restMeta.color, borderColor: restMeta.color },
            ]}
          >
            REST
          </Text>
          <Text style={styles.todayBadge}>TODAY</Text>
        </View>
        <Text style={styles.restTitle}>Rest day</Text>
        <Text style={styles.restSubtitle}>No planned run today.</Text>
      </View>
    );
  }

  const meta = SESSION_TYPE[session.type];
  const savedSubjectiveInput = activity?.subjectiveInput;
  const completedSummary = buildCompletedSummary(session, activity);
  const qualitySummary = buildQualitySummary(session, activity);
  const needsReview = qualitySummaryNeedsReview(qualitySummary);
  const statusLabel = needsReview ? 'NEEDS REVIEW' : 'COMPLETED';
  const qualityEvidence = qualityEvidenceSentence(qualitySummary, units, needsReview);
  const plannedTarget = buildPlannedTargetDisplay(session, units);
  const plannedDetailLine = buildPlannedDetailLine(session, units);
  const showSubjectivePrompt =
    !!session.actualActivityId &&
    !savedSubjectiveInput &&
    Boolean(onSaveSubjectiveInput || onDismissSubjectiveInput);
  const completedRows = buildCompletedEvidenceRows({
    session,
    activity,
    units,
    qualitySummary,
    canAddFeel: showSubjectivePrompt,
  });
  const completedHasNestedActions = showSubjectivePrompt || Boolean(onReviewRun);

  if (completed) {
    const content = (
      <>
        <View style={styles.completedTopRow}>
          <View
            style={[
              styles.completedTypeChip,
              { borderColor: meta.color, backgroundColor: meta.color },
            ]}
            testID="hero-completed-session-chip"
          >
            <Text style={[styles.completedTypeChipText, { color: C.surface }]}>{session.type}</Text>
          </View>
          <View
            style={[styles.completedBadge, needsReview && styles.reviewBadge]}
            testID="hero-completed-status-chip"
          >
            <Text style={[styles.completedBadgeText, needsReview && styles.reviewBadgeText]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.completedHeadline}>
          {completedHeadline(completedSummary, qualitySummary, needsReview)}
        </Text>
        <Text style={styles.completedSubcopy}>
          {qualityEvidence ? (
            <Text>{qualityEvidence}</Text>
          ) : activity ? (
            <>
              <Text style={[styles.completedSubcopyMetric, styles.metricDistanceValue]}>{formatDistance(activity.distance, units)}</Text>
              <Text> at </Text>
              <Text style={[styles.completedSubcopyMetric, styles.metricPaceValue]}>{formatPace(activity.avgPace, units, { withUnit: true, compactUnit: true })}</Text>
              <Text>{` · ${completedSummaryFact(completedSummary.subcopy)}`}</Text>
            </>
          ) : (
            <>
              <Text style={styles.completedSubcopyMetric}>{formatSessionLabel(session, units)}</Text>
              <Text>{` · ${completedSummary.subcopy}`}</Text>
            </>
          )}
        </Text>

        <CompletedEvidenceList rows={completedRows} />

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
              <Text style={styles.reviewLinkText}>
                {qualitySummary ? 'Review quality work' : 'Review run'}
              </Text>
              <Text style={styles.reviewLinkHint}>
                {qualitySummary
                  ? 'Warm-up and cool-down stay context.'
                  : 'Open run detail and edit notes or feel.'}
              </Text>
            </View>
            <Text style={styles.reviewLinkArrow}>›</Text>
          </Pressable>
        ) : null}
      </>
    );

    if (onPress) {
      return (
        <Pressable
          accessibilityRole={completedHasNestedActions ? undefined : 'button'}
          onPress={onPress}
          style={({ pressed }) => [
            styles.card,
            styles.completedCard,
            { backgroundColor: C.surface, borderColor: meta.color },
            pressed && styles.cardPressed,
          ]}
          testID="hero-completed"
        >
          <Animated.View style={completedRevealStyle}>
            {content}
          </Animated.View>
        </Pressable>
      );
    }

    return (
      <View style={[styles.card, styles.completedCard, { backgroundColor: C.surface, borderColor: meta.color }]} testID="hero-completed">
        <Animated.View style={completedRevealStyle}>
          {content}
        </Animated.View>
      </View>
    );
  }

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

      <View style={styles.targetFrame}>
        <Text style={styles.targetLabel}>{plannedTarget.label}</Text>
        {plannedTarget.primary ? (
          <Text style={[styles.targetPrimary, metricValueStyle(plannedTarget.primaryKind)]} numberOfLines={1}>
            {plannedTarget.primary}
          </Text>
        ) : null}
        {plannedTarget.secondary ? (
          <Text style={[styles.targetSecondary, metricValueStyle(plannedTarget.secondaryKind)]} numberOfLines={1}>
            {plannedTarget.secondary}
          </Text>
        ) : null}
      </View>

      {plannedDetailLine ? <Text style={styles.detailLine}>{plannedDetailLine}</Text> : null}
      {onLogRun ? (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation?.();
              onLogRun();
            }}
            style={styles.finishedRunButton}
          >
            <Text style={styles.finishedRunButtonText}>✓ I finished this run</Text>
          </Pressable>
          <Text style={styles.finishedRunHint}>Looks for a recent Strava activity.</Text>
        </>
      ) : null}
      {showSubjectivePrompt ? (
        <SubjectiveInputPrompt
          onSave={onSaveSubjectiveInput}
          onDismiss={onDismissSubjectiveInput}
        />
      ) : null}
    </>
  );

  const plannedHasNestedActions = Boolean(onLogRun) || showSubjectivePrompt;

  if (onPress) {
    return (
      <Pressable
        accessibilityRole={plannedHasNestedActions ? undefined : 'button'}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          styles.plannedCard,
          { backgroundColor: C.surface, borderColor: meta.color },
          pressed && styles.cardPressed,
        ]}
        testID="hero-card"
      >
        <SessionCardAtmosphere sessionType={session.type} />
        {plannedContent}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.card,
        styles.plannedCard,
        { backgroundColor: C.surface, borderColor: meta.color },
      ]}
      testID="hero-card"
    >
      <SessionCardAtmosphere sessionType={session.type} />
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
    overflow: 'hidden',
  },
  sessionAtmosphere: {
    ...StyleSheet.absoluteFillObject,
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
  reviewBadge: {
    backgroundColor: C.amberBg,
    borderColor: `${C.amber}35`,
  },
  reviewBadgeText: {
    color: C.amber,
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
  evidenceList: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginBottom: 14,
  },
  evidenceRow: {
    minHeight: 34,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  evidenceLabel: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink2,
  },
  evidenceValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 13,
  },
  completedMetricRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  completedMetricCard: {
    flex: 1,
    minWidth: 0,
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
  targetFrame: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  targetLabel: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    marginBottom: 4,
  },
  targetPrimary: {
    fontSize: 22,
    marginBottom: 3,
  },
  targetSecondary: {
    fontSize: 14,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 20,
    color: C.ink,
    marginBottom: 2,
  },
  metricValueMono: {
    fontFamily: FONTS.monoBold,
  },
  metricValueText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
  },
  metricDistanceValue: {
    fontFamily: FONTS.monoBold,
    color: C.metricDistance,
  },
  metricPaceValue: {
    fontFamily: FONTS.monoBold,
    color: C.metricPace,
  },
  metricTimeValue: {
    fontFamily: FONTS.monoBold,
    color: C.metricTime,
  },
  metricEffortValue: {
    fontFamily: FONTS.sansSemiBold,
    color: C.metricEffort,
  },
  metricNeutralValue: {
    fontFamily: FONTS.sansSemiBold,
    color: C.ink,
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
  detailLine: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.muted,
  },
  finishedRunButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: C.clay,
  },
  finishedRunButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: C.surface,
  },
  finishedRunHint: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
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
