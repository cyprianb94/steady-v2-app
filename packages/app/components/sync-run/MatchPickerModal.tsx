import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Activity, PlannedSession } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { isSessionSelectable } from '../../features/sync/sync-run-detail';
import { usePreferences } from '../../providers/preferences-context';
import {
  formatDistance,
  type DistanceUnits,
  formatIntensityTargetDisplay,
  formatPace,
  formatSessionTitle,
} from '../../lib/units';
import { SyncRunModalShell } from './SyncRunModalShell';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function formatRunSummaryDate(startTime: string): string {
  const value = new Date(startTime);
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function formatSessionDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[value.getUTCDay()]} ${MONTHS[value.getUTCMonth()]} ${value.getUTCDate()}`;
}

function formatSessionOptionTitle(
  session: PlannedSession,
  units: DistanceUnits,
  todaySessionId?: string | null,
): string {
  const dayLabel = session.id === todaySessionId
    ? 'Today'
    : WEEKDAYS[new Date(`${session.date}T00:00:00Z`).getUTCDay()];
  return `${dayLabel} · ${formatSessionTitle(session, units)}`;
}

interface MatchPickerModalProps {
  visible: boolean;
  activity: Activity;
  sessionOptions: PlannedSession[];
  selectedSessionId: string | null;
  recommendedSessionId: string | null;
  todaySessionId?: string | null;
  onSelect: (sessionId: string | null) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function MatchPickerModal({
  visible,
  activity,
  sessionOptions,
  selectedSessionId,
  recommendedSessionId,
  todaySessionId,
  onSelect,
  onClose,
  onConfirm,
}: MatchPickerModalProps) {
  const { units } = usePreferences();
  const currentMatchedSessionId = activity.matchedSessionId ?? null;
  const currentMatchedSession = currentMatchedSessionId
    ? sessionOptions.find((session) => session.id === currentMatchedSessionId) ?? null
    : null;
  const hasCurrentMatch = Boolean(currentMatchedSessionId);
  const title = hasCurrentMatch
    ? "Change this run's match"
    : 'Match this run to the plan';
  const description = hasCurrentMatch
    ? 'Move it to a different session, or unmatch it and keep the run as bonus mileage.'
    : 'Choose the planned session this run belongs to, or keep it as a bonus run.';
  const unmatchSelected = hasCurrentMatch && selectedSessionId == null;

  return (
    <SyncRunModalShell
      visible={visible}
      title="Change match"
      onClose={onClose}
      rightActionLabel="Done"
      onRightAction={onConfirm}
    >
      <Text style={styles.screenTitle}>{title}</Text>
      <Text style={styles.screenSub}>{description}</Text>

      <View style={styles.runSummary}>
        <View style={styles.summaryIcon}>
          <Text style={styles.summaryIconText}>›</Text>
        </View>
        <View style={styles.summaryBody}>
          <Text style={styles.summaryTitle}>
            {activity.name ?? 'Run'} · {formatDistance(activity.distance, units, { compactMetric: false })}
          </Text>
          <Text style={styles.summaryMeta}>
            {formatRunSummaryDate(activity.startTime)} · {formatPace(activity.avgPace, units, { withUnit: true })}
            {activity.avgHR ? ` · ${activity.avgHR} bpm` : ''}
          </Text>
        </View>
      </View>

      {hasCurrentMatch ? (
        <>
          <Text style={styles.groupLabel}>Current match</Text>
          <View style={styles.currentMatchCard}>
            <View style={styles.currentMatchBody}>
              <Text style={styles.currentMatchTitle}>
                {currentMatchedSession
                  ? formatSessionOptionTitle(currentMatchedSession, units, todaySessionId)
                  : 'Session no longer available'}
              </Text>
              <Text style={styles.currentMatchSub}>
                {currentMatchedSession
                  ? `${formatSessionDate(currentMatchedSession.date)} · currently linked`
                  : 'Unmatch this run before saving or choose another session below.'}
              </Text>
            </View>
            <Text style={[styles.optionTag, styles.optionTagCurrent]}>CURRENT</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => onSelect(null)}
            style={[styles.option, styles.unmatchOption, unmatchSelected && styles.unmatchOptionSelected]}
          >
            <View style={[styles.radio, unmatchSelected && styles.radioSelected]}>
              <View style={[styles.radioDot, unmatchSelected && styles.radioDotSelected]} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Unmatch this run</Text>
              <Text style={styles.optionSub}>
                {unmatchSelected
                  ? 'Will become bonus mileage after you save.'
                  : 'Remove the planned-session link and keep the run as bonus mileage.'}
              </Text>
            </View>
            <Text style={[styles.optionTag, unmatchSelected ? styles.optionTagSuggested : styles.optionTagUnmatch]}>
              {unmatchSelected ? 'PENDING' : 'UNMATCH'}
            </Text>
          </Pressable>

          <View style={styles.divider} />
        </>
      ) : null}

      <Text style={styles.groupLabel}>{hasCurrentMatch ? 'Change to another session' : 'Planned sessions'}</Text>
      {sessionOptions.map((session) => {
        const selected = selectedSessionId === session.id;
        const selectable = isSessionSelectable(session, activity.id);
        const tag = !selectable
          ? 'TAKEN'
          : session.id === currentMatchedSessionId
            ? 'CURRENT'
          : session.id === recommendedSessionId
            ? 'SUGGESTED'
            : session.id === todaySessionId
              ? 'TODAY'
              : 'PAST';
        const target = formatIntensityTargetDisplay(session, units, {
          withUnit: true,
          fallbackToLegacyPace: true,
        });

        return (
          <Pressable
            key={session.id}
            onPress={() => {
              if (!selectable) {
                return;
              }
              onSelect(session.id);
            }}
            disabled={!selectable}
            style={[styles.option, selected && styles.optionSelected, !selectable && styles.optionDisabled]}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              <View style={[styles.radioDot, selected && styles.radioDotSelected]} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>
                {formatSessionOptionTitle(session, units, todaySessionId)}
              </Text>
              <Text style={styles.optionSub}>
                {formatSessionDate(session.date)}{target ? ` · target ${target}` : ''}
              </Text>
            </View>
            <Text
              style={[
                styles.optionTag,
                tag === 'TAKEN' && styles.optionTagTaken,
                tag === 'CURRENT' && styles.optionTagCurrent,
                tag === 'SUGGESTED' && styles.optionTagSuggested,
                tag === 'TODAY' && styles.optionTagToday,
                tag === 'PAST' && styles.optionTagPast,
              ]}
            >
              {tag}
            </Text>
          </Pressable>
        );
      })}

      {!hasCurrentMatch ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.groupLabel}>Keep unmatched</Text>
          <Pressable
            onPress={() => onSelect(null)}
            style={[styles.option, selectedSessionId == null && styles.optionSelected]}
          >
            <View style={[styles.radio, selectedSessionId == null && styles.radioSelected]}>
              <View style={[styles.radioDot, selectedSessionId == null && styles.radioDotSelected]} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Bonus run</Text>
              <Text style={styles.optionSub}>Keep this run as extra mileage with no planned session attached</Text>
            </View>
            <Text style={[styles.optionTag, styles.optionTagNeutral]}>BONUS</Text>
          </Pressable>
        </>
      ) : null}
    </SyncRunModalShell>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 28,
    color: C.ink,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  screenSub: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.muted,
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  runSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    marginBottom: 22,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  summaryIconText: {
    fontFamily: FONTS.serifBold,
    fontSize: 16,
    color: C.ink,
  },
  summaryBody: {
    flex: 1,
  },
  summaryTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 14,
    color: C.ink,
    marginBottom: 2,
  },
  summaryMeta: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.muted,
  },
  currentMatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    marginBottom: 10,
  },
  currentMatchBody: {
    flex: 1,
  },
  currentMatchTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 15,
    color: C.ink,
    marginBottom: 3,
  },
  currentMatchSub: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
  },
  groupLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    marginBottom: 10,
  },
  optionSelected: {
    borderWidth: 1.5,
    borderColor: C.forest,
    backgroundColor: C.forestBg,
  },
  optionDisabled: {
    opacity: 0.45,
  },
  unmatchOption: {
    borderColor: 'rgba(196,82,42,0.36)',
    backgroundColor: C.clayBg,
  },
  unmatchOptionSelected: {
    borderWidth: 1.5,
    borderColor: C.forest,
    backgroundColor: C.forestBg,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  radioSelected: {
    borderColor: C.forest,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
  },
  radioDotSelected: {
    backgroundColor: C.forest,
  },
  optionBody: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 15,
    color: C.ink,
    marginBottom: 3,
  },
  optionSub: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.ink2,
  },
  optionTag: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1,
    overflow: 'hidden',
  },
  optionTagSuggested: {
    color: C.surface,
    backgroundColor: C.forest,
  },
  optionTagTaken: {
    color: C.surface,
    backgroundColor: C.clay,
  },
  optionTagCurrent: {
    color: C.surface,
    backgroundColor: C.forest,
  },
  optionTagToday: {
    color: C.surface,
    backgroundColor: C.navy,
  },
  optionTagPast: {
    color: C.surface,
    backgroundColor: C.clay,
  },
  optionTagUnmatch: {
    color: C.surface,
    backgroundColor: C.clay,
  },
  optionTagNeutral: {
    color: C.slate,
    backgroundColor: '#F2F2F4',
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 4,
    marginVertical: 14,
  },
});
