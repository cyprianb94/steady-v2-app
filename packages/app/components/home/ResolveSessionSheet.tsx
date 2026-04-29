import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  expectedDistance,
  normalizeSessionDuration,
  sessionSupportsWarmupCooldown,
  type Activity,
  type PlannedSession,
  type SkippedSessionReason,
} from '@steady/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../constants/colours';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { usePreferences } from '../../providers/preferences-context';
import type { ActivityDayStatus } from '../../features/run/activity-resolution';
import {
  formatDistance,
  formatIntensityTargetParts,
  formatIntervalRepLength,
  formatStoredPace,
  type DistanceUnits,
} from '../../lib/units';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MAX_SHEET_HEIGHT = Math.floor(Dimensions.get('window').height * 0.82);

interface ResolveSessionSheetProps {
  open: boolean;
  session: PlannedSession | null;
  status: ActivityDayStatus;
  possibleMatches: Activity[];
  busy?: boolean;
  onDismiss: () => void;
  onLogSession: (session: PlannedSession) => void;
  onMarkSkipped: (session: PlannedSession) => void;
  onEditSkipped: (session: PlannedSession) => void;
  onAttachMatch: (session: PlannedSession, activityId: string) => void | Promise<void>;
}

type LoadedResolveSessionSheetProps = Omit<ResolveSessionSheetProps, 'session'> & {
  session: PlannedSession;
};

interface PlannedSessionRow {
  label: string;
  parts: PlannedSessionValuePart[];
  accentColor: string;
  subparts?: PlannedSessionValuePart[];
}

interface PlannedSessionValuePart {
  text: string;
  color?: string;
  mono?: boolean;
  muted?: boolean;
}

const SKIPPED_REASON_LABELS: Record<SkippedSessionReason, string> = {
  tired: 'Tired',
  ill: 'Ill',
  busy: 'Busy',
  sore: 'Sore',
  other: 'Other',
};

function formatSessionDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[value.getUTCDay()]} ${value.getUTCDate()} ${MONTHS[value.getUTCMonth()]}`;
}

function formatActivityStartedAt(startTime: string): string {
  const value = new Date(startTime);
  const weekday = WEEKDAYS[value.getDay()];
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${weekday} ${hours}:${minutes}`;
}

function formatClockDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatSourceLabel(source: Activity['source']): string {
  switch (source) {
    case 'apple_health':
      return 'Apple Health run';
    case 'garmin':
      return 'Garmin run';
    case 'manual':
      return 'Manual run';
    case 'strava':
    default:
      return 'Strava run';
  }
}

function formatPaceValue(pace: string | undefined, units: DistanceUnits): string {
  return formatStoredPace(pace, units, { withUnit: true, compactUnit: true });
}

function formatDurationValue(
  duration: PlannedSession['warmup'] | PlannedSession['cooldown'],
  units: DistanceUnits,
): string | null {
  const normalized = normalizeSessionDuration(duration);
  if (!normalized) {
    return null;
  }

  if (normalized.unit === 'min') {
    return `${normalized.value}min`;
  }

  return formatDistance(normalized.value, units);
}

function formatRecoveryValue(recovery: PlannedSession['recovery'], units: DistanceUnits): string | null {
  if (!recovery) {
    return null;
  }

  if (typeof recovery === 'string') {
    return recovery;
  }

  if (recovery.unit === 'min') {
    return `${recovery.value}min`;
  }

  return formatDistance(recovery.value, units);
}

function metricPart(text: string, color: string): PlannedSessionValuePart {
  return { text, color, mono: true };
}

function copyPart(text: string, color: string = C.ink): PlannedSessionValuePart {
  return { text, color };
}

function mutedPart(text: string): PlannedSessionValuePart {
  return { text, color: C.muted, muted: true };
}

function durationMetricColor(duration: PlannedSession['warmup'] | PlannedSession['cooldown'] | PlannedSession['repDuration']): string {
  const normalized = normalizeSessionDuration(duration);
  return normalized?.unit === 'min' ? C.metricTime : C.metricDistance;
}

function recoveryMetricColor(recovery: PlannedSession['recovery']): string {
  if (typeof recovery === 'string') {
    return C.metricTime;
  }

  const normalized = normalizeSessionDuration(recovery);
  return normalized?.unit === 'km' ? C.metricDistance : C.metricTime;
}

function targetDisplayParts(
  session: PlannedSession,
  units: DistanceUnits,
): Pick<PlannedSessionRow, 'parts' | 'subparts'> {
  const target = formatIntensityTargetParts(session, units, {
    withUnit: true,
    hideCompatibilityPace: true,
  });
  const parts: PlannedSessionValuePart[] = [];
  const subparts: PlannedSessionValuePart[] = [];

  if (target.pace) {
    parts.push(metricPart(target.pace, C.metricPace));
  }
  if (target.pace && target.effort) {
    subparts.push(copyPart(target.effort, C.metricEffort));
  } else if (target.effort) {
    parts.push(copyPart(target.effort, C.metricEffort));
  }
  if (parts.length === 0) {
    parts.push(metricPart(formatPaceValue(session.pace, units), C.metricPace));
  }

  return subparts.length > 0 ? { parts, subparts } : { parts };
}

function durationRow(
  label: string,
  duration: PlannedSession['warmup'] | PlannedSession['cooldown'],
  units: DistanceUnits,
  fallback: string,
): PlannedSessionRow {
  const formatted = formatDurationValue(duration, units);

  return {
    label,
    parts: formatted
      ? [metricPart(formatted, durationMetricColor(duration))]
      : [mutedPart(fallback)],
    accentColor: formatted ? durationMetricColor(duration) : C.border,
  };
}

function buildBookendRow(session: PlannedSession, units: DistanceUnits): PlannedSessionRow | null {
  const warmup = formatDurationValue(session.warmup, units);
  const cooldown = formatDurationValue(session.cooldown, units);

  if (warmup && cooldown) {
    return {
      label: 'WARM-UP + COOL-DOWN',
      parts: [
        metricPart(warmup, durationMetricColor(session.warmup)),
        mutedPart(' / '),
        metricPart(cooldown, durationMetricColor(session.cooldown)),
      ],
      accentColor: durationMetricColor(session.warmup),
    };
  }

  if (warmup) {
    return durationRow('WARM-UP', session.warmup, units, 'No warm-up');
  }

  if (cooldown) {
    return durationRow('COOL-DOWN', session.cooldown, units, 'No cool-down');
  }

  return null;
}

function buildPlannedRows(session: PlannedSession, units: DistanceUnits): PlannedSessionRow[] {
  if (session.type === 'INTERVAL') {
    const recovery = formatRecoveryValue(session.recovery, units);
    const bookendRow = buildBookendRow(session, units);

    const rows: PlannedSessionRow[] = [
      {
        label: 'REPETITIONS',
        parts: [metricPart(`${session.reps ?? 6}×${formatIntervalRepLength(session)}`, durationMetricColor(session.repDuration))],
        accentColor: durationMetricColor(session.repDuration),
        subparts: [mutedPart('Main set')],
      },
      {
        label: 'REP TARGET PACE',
        accentColor: C.metricPace,
        ...targetDisplayParts(session, units),
      },
      {
        label: 'RECOVERY BETWEEN REPS',
        parts: recovery ? [metricPart(recovery, recoveryMetricColor(session.recovery))] : [mutedPart('No recovery')],
        accentColor: recovery ? recoveryMetricColor(session.recovery) : C.border,
      },
    ];

    return bookendRow ? [...rows, bookendRow] : rows;
  }

  const rows: PlannedSessionRow[] = [
    {
      label: 'DISTANCE',
      parts: [metricPart(formatDistance(session.distance ?? expectedDistance(session), units), C.metricDistance)],
      accentColor: C.metricDistance,
    },
    {
      label: 'TARGET PACE',
      accentColor: C.metricPace,
      ...targetDisplayParts(session, units),
    },
  ];

  if (!sessionSupportsWarmupCooldown(session.type)) {
    return rows;
  }

  const bookendRow = buildBookendRow(session, units);

  if (bookendRow) {
    rows.push(bookendRow);
  }

  return rows;
}

function PlannedRowMarker({ color }: { color: string }) {
  return <View style={[styles.rowAccent, { backgroundColor: color }]} />;
}

function PlannedRowValue({ row }: { row: PlannedSessionRow }) {
  return (
    <View style={styles.plannedValueWrap}>
      <Text style={styles.plannedValueText}>
        {row.parts.map((part, index) => (
          <Text
            key={`${part.text}-${index}`}
            style={[
              part.mono ? styles.plannedValueMetric : styles.plannedValueCopy,
              part.muted && styles.plannedValueMuted,
              part.color ? { color: part.color } : null,
            ]}
          >
            {part.text}
          </Text>
        ))}
      </Text>
      {row.subparts ? (
        <Text style={styles.plannedSubText}>
          {row.subparts.map((part, index) => (
            <Text
              key={`${part.text}-${index}`}
              style={[
                part.mono ? styles.plannedSubMetric : styles.plannedSubCopy,
                part.muted && styles.plannedValueMuted,
                part.color ? { color: part.color } : null,
              ]}
            >
              {part.text}
            </Text>
          ))}
        </Text>
      ) : null}
    </View>
  );
}

function SelectionCircle({ selected }: { selected: boolean }) {
  return (
    <View style={[styles.selectionCircle, selected && styles.selectionCircleSelected]}>
      {selected ? <Text style={styles.selectionCheck}>✓</Text> : null}
    </View>
  );
}

export function ResolveSessionSheet({
  open,
  session,
  status,
  possibleMatches,
  busy = false,
  onDismiss,
  onLogSession,
  onMarkSkipped,
  onEditSkipped,
  onAttachMatch,
}: ResolveSessionSheetProps) {
  if (!open || !session) {
    return null;
  }

  return (
    <ResolveSessionSheetLoader
      open={open}
      session={session}
      status={status}
      possibleMatches={possibleMatches}
      busy={busy}
      onDismiss={onDismiss}
      onLogSession={onLogSession}
      onMarkSkipped={onMarkSkipped}
      onEditSkipped={onEditSkipped}
      onAttachMatch={onAttachMatch}
    />
  );
}

function ResolveSessionSheetLoader(props: LoadedResolveSessionSheetProps) {
  const [bottomSheet, setBottomSheet] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;

    import('@gorhom/bottom-sheet')
      .then((module) => {
        if (mounted) {
          setBottomSheet(module);
        }
      })
      .catch((error) => {
        console.error('Failed to load resolve session bottom sheet:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!bottomSheet) {
    return null;
  }

  return <ResolveSessionSheetMounted {...props} bottomSheet={bottomSheet} />;
}

function ResolveSessionSheetMounted({
  open,
  session,
  status,
  possibleMatches,
  busy = false,
  onDismiss,
  onLogSession,
  onMarkSkipped,
  onEditSkipped,
  onAttachMatch,
  bottomSheet,
}: LoadedResolveSessionSheetProps & { bottomSheet: any }) {
  const {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetScrollView,
  } = bottomSheet;
  const sheetRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const { units } = usePreferences();
  const matchIds = possibleMatches.map((match) => match.id).join('|');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(possibleMatches[0]?.id ?? null);
  const canLogSession = status === 'missed' || status === 'today' || status === 'skipped';
  const canMarkSkipped = status === 'missed' || status === 'today';
  const canEditSkipped = status === 'skipped';
  const hasMatches = canLogSession && possibleMatches.length > 0;

  useEffect(() => {
    setSelectedMatchId(possibleMatches[0]?.id ?? null);
  }, [matchIds]);

  useEffect(() => {
    if (open && session) {
      sheetRef.current?.present();
      return;
    }

    sheetRef.current?.dismiss();
  }, [open, session]);

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.62}
      pressBehavior="close"
      style={[props.style, styles.backdrop]}
    />
  ), []);

  const plannedRows = useMemo(
    () => (session ? buildPlannedRows(session, units) : []),
    [session, units],
  );

  const handlePrimaryPress = useCallback(() => {
    if (!session || busy || !canLogSession) {
      return;
    }

    if (hasMatches) {
      if (!selectedMatchId) {
        return;
      }

      void onAttachMatch(session, selectedMatchId);
      return;
    }

    onLogSession(session);
  }, [busy, canLogSession, hasMatches, onAttachMatch, onLogSession, selectedMatchId, session]);

  const handleSkippedPress = useCallback(() => {
    if (!session || busy) {
      return;
    }

    if (canEditSkipped) {
      onEditSkipped(session);
      return;
    }

    if (canMarkSkipped) {
      onMarkSkipped(session);
    }
  }, [busy, canEditSkipped, canMarkSkipped, onEditSkipped, onMarkSkipped, session]);

  const primaryDisabled = !canLogSession || busy || (hasMatches && !selectedMatchId);
  const statusLabel = status === 'today'
    ? 'TODAY'
    : status === 'upcoming'
    ? 'PLANNED'
    : status === 'skipped'
      ? 'SKIPPED'
      : 'UNLOGGED';
  const statusChipStyle = status === 'upcoming'
    ? {
        borderColor: C.border,
      }
    : status === 'skipped'
      ? {
          borderColor: 'rgba(196,82,42,0.48)',
          backgroundColor: 'rgba(196,82,42,0.08)',
        }
    : null;
  const statusChipTextStyle = status === 'upcoming'
    ? {
        color: C.muted,
      }
    : status === 'skipped'
      ? {
          color: C.clay,
        }
    : null;
  const skippedReasonLabel = session.skipped ? SKIPPED_REASON_LABELS[session.skipped.reason] : null;
  const helperText = status === 'upcoming'
    ? 'Planned for later this week'
    : status === 'skipped'
      ? skippedReasonLabel
        ? `Marked skipped: ${skippedReasonLabel}`
        : 'Marked skipped'
    : hasMatches
      ? 'Choose the run that matches this session'
      : status === 'today'
        ? 'No synced activity yet'
        : 'No matching activity found';
  const primaryButtonLabel = busy
    ? 'Logging…'
    : hasMatches
      ? 'Log this run'
      : status === 'skipped'
        ? 'Log session instead'
        : 'Log session';

  return (
    <BottomSheetModal
      ref={sheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      enableDynamicSizing
      enablePanDownToClose
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handle}
      maxDynamicContentSize={MAX_SHEET_HEIGHT}
      onDismiss={onDismiss}
    >
      <BottomSheetScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        testID="resolve-session-sheet"
      >
        {session ? (
          <>
            <View style={styles.header}>
              <View style={[styles.statusChip, statusChipStyle]}>
                <Text style={[styles.statusChipText, statusChipTextStyle]}>{statusLabel}</Text>
              </View>
              <Text style={styles.dateText}>{formatSessionDate(session.date)}</Text>
              <Text style={styles.title}>{SESSION_TYPE[session.type].label}</Text>
              <Text style={styles.helper}>{helperText}</Text>
            </View>

            <View
              style={styles.plannedCard}
              testID="planned-session-card"
            >
              <View style={styles.plannedRows}>
                {plannedRows.map((row, index) => (
                  <View
                    key={row.label}
                    style={[
                      styles.plannedRow,
                      index > 0 && styles.plannedRowWithBorder,
                    ]}
                  >
                    <PlannedRowMarker color={row.accentColor} />
                    <Text style={styles.plannedLabel}>{row.label}</Text>
                    <PlannedRowValue row={row} />
                  </View>
                ))}
              </View>
            </View>

            {hasMatches ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Possible matches</Text>
                {possibleMatches.map((activity) => {
                  const selected = activity.id === selectedMatchId;
                  return (
                    <Pressable
                      key={activity.id}
                      accessibilityRole="button"
                      onPress={() => setSelectedMatchId(activity.id)}
                      style={({ pressed }) => [
                        styles.matchCard,
                        selected && styles.matchCardSelected,
                        pressed && styles.pressed,
                      ]}
                      testID={`activity-match-card-${activity.id}`}
                    >
                      <View style={styles.matchCopy}>
                        <Text style={styles.matchSource}>{formatSourceLabel(activity.source)}</Text>
                        <Text style={styles.matchMetric}>
                          {formatDistance(activity.distance, units)} · {formatClockDuration(activity.duration)}
                        </Text>
                        <Text style={styles.matchMeta}>{formatActivityStartedAt(activity.startTime)}</Text>
                      </View>
                      <SelectionCircle selected={selected} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {canLogSession || canMarkSkipped || canEditSkipped ? (
              <View style={styles.actions}>
                {canLogSession ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={primaryDisabled}
                    onPress={handlePrimaryPress}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && !primaryDisabled && styles.pressed,
                      primaryDisabled && styles.buttonDisabled,
                    ]}
                    testID="resolve-session-primary"
                  >
                    <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
                  </Pressable>
                ) : null}
                {canMarkSkipped || canEditSkipped ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={handleSkippedPress}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && !busy && styles.pressed,
                      busy && styles.buttonDisabled,
                    ]}
                    testID={canEditSkipped ? 'resolve-session-edit-skipped' : 'resolve-session-skip'}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {canEditSkipped ? 'Edit skipped status' : 'Mark skipped'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: C.ink,
  },
  sheetBackground: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  handle: {
    paddingTop: 14,
    paddingBottom: 8,
  },
  handleIndicator: {
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: C.border,
  },
  content: {
    paddingHorizontal: 22,
  },
  header: {
    alignItems: 'center',
    paddingTop: 4,
    marginBottom: 22,
  },
  statusChip: {
    borderWidth: 1,
    borderColor: 'rgba(196,82,42,0.38)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 14,
    backgroundColor: C.surface,
  },
  statusChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: C.clay,
  },
  dateText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: C.ink2,
    marginBottom: 5,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 30,
    lineHeight: 36,
    color: C.ink,
    marginBottom: 8,
  },
  helper: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 18,
    color: C.muted,
    textAlign: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: C.muted,
    marginBottom: 10,
    paddingLeft: 4,
  },
  matchCard: {
    minHeight: 92,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  matchCardSelected: {
    borderColor: 'rgba(42,92,69,0.42)',
    backgroundColor: C.statusConnectedBg,
  },
  matchCopy: {
    flex: 1,
  },
  matchSource: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
    marginBottom: 9,
  },
  matchMetric: {
    fontFamily: FONTS.monoBold,
    fontSize: 19,
    color: C.ink,
    marginBottom: 8,
  },
  matchMeta: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
  },
  selectionCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: C.muted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  selectionCircleSelected: {
    borderColor: C.forest,
    backgroundColor: C.forest,
  },
  selectionCheck: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 22,
    lineHeight: 24,
    color: C.surface,
  },
  plannedCard: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.cream,
    padding: 16,
    marginBottom: 24,
  },
  plannedRows: {
    marginTop: -2,
  },
  plannedRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  plannedRowWithBorder: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  rowAccent: {
    width: 4,
    minHeight: 28,
    borderRadius: 999,
    marginTop: 1,
  },
  plannedLabel: {
    width: 96,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    lineHeight: 13,
    color: C.muted,
    letterSpacing: 1.35,
  },
  plannedValueWrap: {
    flex: 1,
    gap: 2,
  },
  plannedValueText: {
    fontSize: 14,
    lineHeight: 20,
  },
  plannedValueMetric: {
    fontFamily: FONTS.monoBold,
    fontSize: 14,
  },
  plannedValueCopy: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  plannedValueMuted: {
    color: C.muted,
  },
  plannedSubText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
    color: C.muted,
  },
  plannedSubMetric: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
  },
  plannedSubCopy: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    lineHeight: 17,
    color: C.muted,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.clay,
    borderWidth: 1.5,
    borderColor: C.clay,
  },
  primaryButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: C.surface,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.clay,
  },
  secondaryButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: C.clay,
  },
  pressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
