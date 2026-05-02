import React, { useEffect, useMemo, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Easing, View, Text, Pressable, StyleSheet } from 'react-native';
import {
  buildStructuredQualitySummary,
  normalizeSessionDuration,
  summariseRunStructure,
  summariseVsPlan,
  type Activity,
  type PlannedSession,
  type PvaHeadline,
  type StructuredQualitySummary,
  type SubjectiveInput,
  type TrainingPaceProfile,
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
import {
  buildStructuredRunDisplayLines,
  type StructuredRunDisplayLine,
} from '../../lib/structured-run-display';
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
  trainingPaceProfile?: TrainingPaceProfile | null;
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
const SESSION_CARD_WASH_ALPHA = 0x0E / 0xFF;
const SESSION_CARD_GRADIENT_LOCATIONS = [0, 0.65, 1] as const;
const SESSION_CARD_GRADIENT_START = { x: 0, y: 0 } as const;
const SESSION_CARD_GRADIENT_END = { x: 0, y: 1 } as const;

type MetricKind = 'distance' | 'pace' | 'time' | 'effort' | 'neutral';
type CompletedNoteTone = 'varied' | 'loading' | 'neutral';

interface PlannedTargetDisplay {
  label: string;
  primary: string | null;
  primaryKind: MetricKind;
  secondary: string | null;
  secondaryKind: MetricKind;
  structureLines?: StructuredRunDisplayLine[];
}

interface DetailLinePart {
  text: string;
  kind: MetricKind;
}

interface CompletedHeroDisplay {
  primary: string;
  secondary: string;
  label: string;
  loading?: boolean;
}

interface CompletedNoteDisplay {
  tone: CompletedNoteTone;
  headline: string;
  supporting?: string;
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

function StructureSummaryText({ lines }: { lines: StructuredRunDisplayLine[] }) {
  return (
    <View style={styles.structureSummaryLines}>
      {lines.map((line, index) => (
        <Text
          key={`${line.map((part) => part.text).join('')}-${index}`}
          style={styles.structureSummaryLine}
        >
          {line.map((part, tokenIndex) => (
            <Text
              key={`${part.text}-${tokenIndex}`}
              style={part.kind === 'neutral'
                ? undefined
                : [styles.structureMetricToken, metricValueStyle(part.kind)]}
            >
              {part.text}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

function parseHexColor(color: string): { r: number; g: number; b: number } {
  const normalized = color.replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function blendHexColor(foreground: string, background: string, alpha: number): string {
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);
  const toHex = (value: number) => value.toString(16).padStart(2, '0').toUpperCase();
  const blend = (channel: keyof typeof fg) => Math.round(
    fg[channel] * alpha + bg[channel] * (1 - alpha),
  );

  return `#${toHex(blend('r'))}${toHex(blend('g'))}${toHex(blend('b'))}`;
}

function sessionCardGradientColors(sessionType: PlannedSession['type']) {
  const meta = SESSION_TYPE[sessionType];

  return [
    blendHexColor(meta.color, C.cream, SESSION_CARD_WASH_ALPHA),
    C.surface,
    C.surface,
  ] as const;
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

function statusDotColor(tone: CompletedNoteTone): string {
  switch (tone) {
    case 'varied':
      return C.amber;
    case 'loading':
      return C.muted;
    case 'neutral':
    default:
      return C.forest;
  }
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

function formatFeel(input: SubjectiveInput | undefined): { value: string; muted: boolean } {
  if (!input) {
    return { value: 'Add feel', muted: true };
  }

  return {
    value: input.overall
      .split('-')
      .map((part, index) => (index === 0 ? titleCase(part) : part))
      .join(' '),
    muted: false,
  };
}

function plannedFallbackPrimary(
  session: PlannedSession,
  units: ReturnType<typeof usePreferences>['units'],
): string {
  if (session.type === 'INTERVAL') {
    return `${session.reps ?? 6}×${formatIntervalRepLength(session)}`;
  }

  if (session.distance != null) {
    return formatDistance(session.distance, units);
  }

  return formatSessionTitle(session, units);
}

function buildCompletedHero({
  session,
  activity,
  qualitySummary,
  units,
}: {
  session: PlannedSession;
  activity: ActivitySummary | undefined;
  qualitySummary: StructuredQualitySummary | null;
  units: ReturnType<typeof usePreferences>['units'];
}): CompletedHeroDisplay {
  const label = `${formatSessionTitle(session, units)} · ${formatSessionDate(session.date)}`;

  if (!activity) {
    const target = formatIntensityTargetDisplay(session, units, {
      fallbackToLegacyPace: true,
      withUnit: true,
    });

    return {
      primary: plannedFallbackPrimary(session, units),
      secondary: target ?? formatSessionLabel(session, units),
      label,
      loading: true,
    };
  }

  if (qualitySummary?.status === 'available') {
    const qualityPace = formatPace(qualitySummary.averagePaceSecondsPerKm, units, {
      withUnit: true,
      compactUnit: true,
    });

    return {
      primary: qualityPace,
      secondary: qualitySummary.sessionType === 'TEMPO'
        ? formatDuration(Math.round(
            qualitySummary.averagePaceSecondsPerKm * qualitySummary.qualityDistanceKm,
          ))
        : 'avg rep',
      label,
    };
  }

  return {
    primary: formatDistance(activity.distance, units),
    secondary: formatPace(activity.avgPace, units, { withUnit: true, compactUnit: true }),
    label,
  };
}

function buildCompletedNote({
  session,
  activity,
  completedSummary,
  qualitySummary,
  needsReview,
  units,
}: {
  session: PlannedSession;
  activity: ActivitySummary | undefined;
  completedSummary: ReturnType<typeof buildCompletedSummary>;
  qualitySummary: StructuredQualitySummary | null;
  needsReview: boolean;
  units: ReturnType<typeof usePreferences>['units'];
}): CompletedNoteDisplay | null {
  if (!activity) {
    return {
      tone: 'loading',
      headline: 'Pulling splits from Strava...',
    };
  }

  if (qualitySummary?.status === 'available') {
    if (!needsReview) {
      return null;
    }

    if (qualitySummary.sessionType === 'INTERVAL') {
      const reps = qualitySummary.intervalReps;
      return {
        tone: 'varied',
        headline: reps?.inTargetRange != null
          ? `${reps.inTargetRange} of ${reps.planned} reps on target.`
          : `${reps?.found ?? 0} of ${reps?.planned ?? 0} reps found.`,
        supporting: `Rep average ${formatPace(qualitySummary.averagePaceSecondsPerKm, units, {
          withUnit: true,
          compactUnit: true,
        })}.`,
      };
    }

    return {
      tone: 'varied',
      headline: 'Tempo pace outside target.',
      supporting: qualityEvidenceSentence(qualitySummary, units, needsReview) ?? undefined,
    };
  }

  if (completedSummary.headline === 'On target') {
    if (session.runStructure) {
      return {
        tone: 'neutral',
        headline: 'Structured run logged.',
        supporting: 'Open run detail for segment splits.',
      };
    }

    return null;
  }

  return {
    tone: 'varied',
    headline: `${completedSummary.headline}.`,
    supporting: completedSummaryFact(completedSummary.subcopy),
  };
}

function buildPlannedTargetDisplay(
  session: PlannedSession,
  units: ReturnType<typeof usePreferences>['units'],
  trainingPaceProfile: TrainingPaceProfile | null | undefined,
): PlannedTargetDisplay {
  const structureLines = buildStructuredRunDisplayLines(session, units, trainingPaceProfile);
  if (structureLines) {
    return {
      label: 'Structure',
      primary: null,
      primaryKind: 'neutral',
      secondary: null,
      secondaryKind: 'neutral',
      structureLines,
    };
  }

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

function formatShortDurationParts(
  duration: ReturnType<typeof normalizeSessionDuration>,
  units: ReturnType<typeof usePreferences>['units'],
  label: 'warm' | 'cool',
): DetailLinePart[] | null {
  if (!duration) {
    return null;
  }

  if (duration.unit === 'min') {
    return [
      { text: `${duration.value} min`, kind: 'time' },
      { text: ` ${label}`, kind: 'neutral' },
    ];
  }

  return [
    { text: formatDistance(duration.value, units), kind: 'distance' },
    { text: ` ${label}`, kind: 'neutral' },
  ];
}

function formatRecoveryDetailParts(
  recovery: PlannedSession['recovery'],
  units: ReturnType<typeof usePreferences>['units'],
): DetailLinePart[] | null {
  if (!recovery) {
    return null;
  }

  if (typeof recovery === 'string') {
    return [
      { text: recovery, kind: 'time' },
      { text: ' recoveries', kind: 'neutral' },
    ];
  }

  const normalized = normalizeSessionDuration(recovery);
  if (!normalized) {
    return null;
  }

  if (normalized.unit === 'min') {
    return [
      { text: `${normalized.value} min`, kind: 'time' },
      { text: ' recoveries', kind: 'neutral' },
    ];
  }

  return [
    { text: formatDistance(normalized.value, units), kind: 'distance' },
    { text: ' recoveries', kind: 'neutral' },
  ];
}

function joinDetailSegments(segments: Array<DetailLinePart[] | null>): DetailLinePart[] | null {
  const present = segments.filter((segment): segment is DetailLinePart[] => Boolean(segment));
  if (!present.length) {
    return null;
  }

  return present.flatMap((segment, index) => (
    index === 0
      ? segment
      : [{ text: ' · ', kind: 'neutral' as const }, ...segment]
  ));
}

function buildPlannedDetailLine(
  session: PlannedSession,
  units: ReturnType<typeof usePreferences>['units'],
): DetailLinePart[] | null {
  const structureSummary = summariseRunStructure(session);
  if (structureSummary) {
    return null;
  }

  const warmup = normalizeSessionDuration(session.warmup);
  const cooldown = normalizeSessionDuration(session.cooldown);

  if (session.type === 'TEMPO') {
    return joinDetailSegments([
      formatShortDurationParts(warmup, units, 'warm'),
      formatShortDurationParts(cooldown, units, 'cool'),
    ]);
  }

  if (session.type === 'INTERVAL') {
    return joinDetailSegments([
      formatRecoveryDetailParts(session.recovery, units),
      formatShortDurationParts(warmup, units, 'warm'),
      formatShortDurationParts(cooldown, units, 'cool'),
    ]);
  }

  return null;
}

function TypeTag({
  type,
  today = false,
  status,
}: {
  type: PlannedSession['type'];
  today?: boolean;
  status?: 'logged' | 'needs-review' | 'matching';
}) {
  const meta = SESSION_TYPE[type];
  return (
    <View style={styles.typeTagRow}>
      <Text
        style={[
          styles.typeTag,
          { color: meta.color, backgroundColor: meta.bg },
        ]}
        testID={status ? 'hero-completed-session-chip' : 'hero-type-chip'}
      >
        {type}
      </Text>
      {today ? <Text style={styles.todayBadge}>TODAY</Text> : null}
      {status === 'logged' ? (
        <View style={styles.statusTag} testID="hero-completed-status-chip">
          <View style={styles.loggedMark}>
            <Text style={styles.loggedMarkText}>✓</Text>
          </View>
          <Text style={[styles.statusTagText, styles.loggedStatusText]}>LOGGED</Text>
        </View>
      ) : null}
      {status === 'needs-review' ? (
        <View style={styles.statusTag} testID="hero-completed-status-chip">
          <View style={styles.reviewMark}>
            <Text style={styles.reviewMarkText}>!</Text>
          </View>
          <Text style={[styles.statusTagText, styles.reviewStatusText]}>NEEDS REVIEW</Text>
        </View>
      ) : null}
      {status === 'matching' ? (
        <View style={styles.statusTag} testID="hero-completed-status-chip">
          <View style={styles.matchingDot} />
          <Text style={[styles.statusTagText, styles.matchingStatusText]}>MATCHING...</Text>
        </View>
      ) : null}
    </View>
  );
}

function PlannedTarget({ target }: { target: PlannedTargetDisplay }) {
  if (target.structureLines) {
    return (
      <View style={styles.plannedStructure} testID="hero-structure-summary">
        <Text style={styles.plannedTargetLabel}>{target.label}</Text>
        <StructureSummaryText lines={target.structureLines} />
      </View>
    );
  }

  return (
    <View style={styles.plannedTargetLine}>
      <Text style={styles.plannedTargetLabel}>{target.label}</Text>
      {target.primary ? (
        <Text style={[styles.plannedTargetValue, metricValueStyle(target.primaryKind)]}>
          {target.primary}
        </Text>
      ) : null}
      {target.secondary ? (
        <>
          <Text style={styles.plannedTargetSeparator}>·</Text>
          <Text style={[styles.plannedTargetValue, metricValueStyle(target.secondaryKind)]}>
            {target.secondary}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function DetailLine({ parts }: { parts: DetailLinePart[] }) {
  return (
    <Text style={styles.detailLine}>
      {parts.map((part, index) => (
        <Text
          key={`${part.text}-${index}`}
          style={part.kind === 'neutral'
            ? undefined
            : [styles.detailMetricToken, metricValueStyle(part.kind)]}
        >
          {part.text}
        </Text>
      ))}
    </Text>
  );
}

function CompletedHero({ hero }: { hero: CompletedHeroDisplay }) {
  return (
    <>
      <View style={[styles.completedHeroRow, hero.loading && styles.completedHeroLoading]}>
        <Text style={styles.completedHeroPrimary}>
          {hero.primary}
        </Text>
        <Text style={styles.completedHeroJoiner}>at</Text>
        <Text style={styles.completedHeroSecondary}>
          {hero.secondary}
        </Text>
      </View>
      <Text style={styles.completedHeroLabel}>{hero.label}</Text>
    </>
  );
}

function CompletedNote({ note }: { note: CompletedNoteDisplay }) {
  return (
    <View style={styles.completedNote} testID="hero-completed-note">
      <View
        style={[
          styles.completedNoteDot,
          { backgroundColor: statusDotColor(note.tone) },
          note.tone === 'loading' && styles.completedNoteDotLoading,
        ]}
      />
      <Text style={styles.completedNoteText}>
        <Text style={styles.completedNoteHeadline}>{note.headline}</Text>
        {note.supporting ? <Text style={styles.completedNoteSupporting}> {note.supporting}</Text> : null}
      </Text>
    </View>
  );
}

function CompletedFooter({
  feel,
  onReviewRun,
  accent,
}: {
  feel: { value: string; muted: boolean };
  onReviewRun?: () => void;
  accent?: string;
}) {
  const content = (
    <>
      <View style={styles.footerFeelGroup}>
        <Text style={styles.footerFeelLabel}>FEEL</Text>
        <Text style={styles.footerSeparator}>·</Text>
        <Text style={[styles.footerFeelValue, feel.muted && styles.footerFeelValueMuted]}>
          {feel.value}
        </Text>
      </View>
      <View style={styles.footerReviewGroup}>
        <Text style={[styles.footerReviewText, accent ? { color: accent } : null]}>Review run</Text>
        <Text style={[styles.footerReviewArrow, accent ? { color: accent } : null]}>→</Text>
      </View>
    </>
  );

  if (!onReviewRun) {
    return <View style={styles.completedFooter}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={(event) => {
        event.stopPropagation?.();
        onReviewRun();
      }}
      style={styles.completedFooter}
      testID="hero-review-run"
    >
      {content}
    </Pressable>
  );
}

export function TodayHeroCard({
  session,
  activity,
  onPress,
  onLogRun,
  onReviewRun,
  trainingPaceProfile,
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
    return (
      <View
        style={[styles.card, styles.restCard]}
        testID="hero-card"
      >
        <TypeTag type="REST" today />
        <Text style={styles.restTitle}>Rest day</Text>
        <Text style={styles.restSubtitle}>No planned run today. Keep it light - walk, stretch, eat well.</Text>
      </View>
    );
  }

  const meta = SESSION_TYPE[session.type];
  const completedSummary = buildCompletedSummary(session, activity);
  const qualitySummary = buildQualitySummary(session, activity);
  const needsReview = qualitySummaryNeedsReview(qualitySummary);
  const plannedTarget = buildPlannedTargetDisplay(session, units, trainingPaceProfile);
  const plannedDetailLine = buildPlannedDetailLine(session, units);
  const completedHero = buildCompletedHero({ session, activity, qualitySummary, units });
  const completedNote = buildCompletedNote({
    session,
    activity,
    completedSummary,
    qualitySummary,
    needsReview,
    units,
  });
  const completedStatus = !activity ? 'matching' : needsReview ? 'needs-review' : 'logged';
  const completedHasNestedActions = Boolean(onReviewRun);
  const completedFooterAccent = completedNote?.tone === 'varied' ? C.amber : undefined;

  if (completed) {
    const content = (
      <>
        <TypeTag type={session.type} status={completedStatus} />
        <CompletedHero hero={completedHero} />
        {completedNote ? <CompletedNote note={completedNote} /> : null}
        <CompletedFooter
          feel={formatFeel(activity?.subjectiveInput)}
          onReviewRun={onReviewRun}
          accent={completedFooterAccent}
        />
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
      <View style={[styles.card, styles.completedCard]} testID="hero-completed">
        <Animated.View style={completedRevealStyle}>
          {content}
        </Animated.View>
      </View>
    );
  }

  const plannedContent = (
    <>
      <TypeTag type={session.type} today />

      <Text style={styles.mainTitle}>{formatSessionTitle(session, units)}</Text>
      <Text style={styles.dateText}>{formatSessionDate(session.date)}</Text>

      <PlannedTarget target={plannedTarget} />

      {plannedDetailLine ? <DetailLine parts={plannedDetailLine} /> : null}
      {onLogRun ? (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation?.();
              onLogRun();
            }}
            style={[styles.finishedRunButton, { backgroundColor: meta.color }]}
          >
            <Text style={styles.finishedRunButtonText}>I finished this run</Text>
          </Pressable>
        </>
      ) : null}
    </>
  );

  const plannedHasNestedActions = Boolean(onLogRun);

  if (onPress) {
    return (
      <Pressable
        accessibilityRole={plannedHasNestedActions ? undefined : 'button'}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          styles.plannedCard,
          { borderColor: `${meta.color}38`, shadowColor: meta.color },
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
        { borderColor: `${meta.color}38`, shadowColor: meta.color },
      ]}
      testID="hero-card"
    >
      <SessionCardAtmosphere sessionType={session.type} />
      {plannedContent}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  plannedCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 1,
  },
  completedCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  restCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 116,
    overflow: 'hidden',
  },
  sessionAtmosphere: {
    ...StyleSheet.absoluteFillObject,
  },
  cardPressed: {
    opacity: 0.84,
  },
  typeTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeTag: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  todayBadge: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  loggedMark: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loggedMarkText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    lineHeight: 11,
    color: C.surface,
  },
  reviewMark: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: C.amber,
    backgroundColor: C.amberBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewMarkText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    lineHeight: 11,
    color: C.amber,
  },
  matchingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.muted,
    opacity: 0.6,
  },
  statusTagText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  loggedStatusText: {
    color: C.forest,
  },
  reviewStatusText: {
    color: C.amber,
  },
  matchingStatusText: {
    color: C.muted,
  },
  mainTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 26,
    lineHeight: 30,
    color: C.ink,
    marginTop: 10,
    marginBottom: 2,
  },
  dateText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
    marginBottom: 14,
  },
  plannedTargetLine: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 10,
  },
  plannedStructure: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
  },
  plannedTargetLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.muted,
  },
  plannedTargetValue: {
    fontSize: 13,
  },
  plannedTargetSeparator: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.border,
    marginHorizontal: -3,
  },
  structureSummaryLines: {
    gap: 0,
    marginTop: 8,
  },
  structureSummaryLine: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    lineHeight: 20,
    color: C.ink,
    paddingVertical: 8,
  },
  structureMetricToken: {
    fontSize: 13,
    lineHeight: 20,
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
    fontFamily: FONTS.monoBold,
    color: C.ink,
  },
  detailLine: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderStyle: 'dashed',
    marginTop: 8,
    paddingTop: 8,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.ink2,
  },
  detailMetricToken: {
    fontSize: 12,
    lineHeight: 18,
  },
  finishedRunButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    marginTop: 14,
    borderRadius: 999,
    paddingHorizontal: 18,
  },
  finishedRunButtonText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    color: C.surface,
  },
  completedHeroRow: {
    marginTop: 10,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
  },
  completedHeroLoading: {
    opacity: 0.55,
  },
  completedHeroPrimary: {
    fontSize: 28,
    letterSpacing: 0,
    color: C.ink,
  },
  completedHeroJoiner: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
  },
  completedHeroSecondary: {
    fontSize: 17,
    color: C.ink2,
  },
  completedHeroLabel: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
  },
  completedNote: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedNoteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  completedNoteDotLoading: {
    opacity: 0.6,
  },
  completedNoteText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 18,
    color: C.ink,
  },
  completedNoteHeadline: {
    fontFamily: FONTS.sansSemiBold,
    color: C.ink,
  },
  completedNoteSupporting: {
    fontFamily: FONTS.sans,
    color: C.ink2,
  },
  completedFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  footerFeelGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  footerFeelLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: C.muted,
    textTransform: 'uppercase',
  },
  footerSeparator: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
  },
  footerFeelValue: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.metricEffort,
  },
  footerFeelValueMuted: {
    color: C.muted,
    fontStyle: 'italic',
  },
  footerReviewGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerReviewText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  footerReviewArrow: {
    fontFamily: FONTS.sans,
    fontSize: 16,
    color: C.muted,
  },
  restTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 26,
    lineHeight: 30,
    color: C.ink,
    marginTop: 10,
    marginBottom: 4,
  },
  restSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink2,
    lineHeight: 20,
  },
});
