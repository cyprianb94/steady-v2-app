import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Activity, PlannedSession } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { usePreferences } from '../../providers/preferences-context';
import { formatDistance, formatPace, formatSessionTitle, formatStoredPace } from '../../lib/units';
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

  return (
    <SyncRunModalShell
      visible={visible}
      title="Match run"
      onClose={onClose}
      rightActionLabel="Confirm"
      onRightAction={onConfirm}
    >
      <Text style={styles.screenTitle}>Which session was this?</Text>
      <Text style={styles.screenSub}>
        Pick the planned session this run belonged to, or mark it as a bonus run.
      </Text>

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

      <Text style={styles.groupLabel}>This week</Text>
      {sessionOptions.map((session) => {
        const selected = selectedSessionId === session.id;
        const tag = session.id === recommendedSessionId
          ? 'AUTO'
          : session.id === todaySessionId
            ? 'TODAY'
            : 'MISSED';

        return (
          <Pressable
            key={session.id}
            onPress={() => onSelect(session.id)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              <View style={[styles.radioDot, selected && styles.radioDotSelected]} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>
                {session.id === todaySessionId ? 'Today' : WEEKDAYS[new Date(`${session.date}T00:00:00Z`).getUTCDay()]} · {formatSessionTitle(session, units)}
              </Text>
              <Text style={styles.optionSub}>
                {formatSessionDate(session.date)} · target {formatStoredPace(session.pace, units, { withUnit: true })}
              </Text>
            </View>
            <Text
              style={[
                styles.optionTag,
                tag === 'AUTO' && styles.optionTagAuto,
                tag === 'TODAY' && styles.optionTagToday,
                tag === 'MISSED' && styles.optionTagMissed,
              ]}
            >
              {tag}
            </Text>
          </Pressable>
        );
      })}

      <View style={styles.divider} />
      <Text style={styles.groupLabel}>No session</Text>
      <Pressable
        onPress={() => onSelect(null)}
        style={[styles.option, selectedSessionId == null && styles.optionSelected]}
      >
        <View style={[styles.radio, selectedSessionId == null && styles.radioSelected]}>
          <View style={[styles.radioDot, selectedSessionId == null && styles.radioDotSelected]} />
        </View>
        <View style={styles.optionBody}>
          <Text style={styles.optionTitle}>Bonus run</Text>
          <Text style={styles.optionSub}>Log as extra mileage with no plan attached</Text>
        </View>
        <Text style={[styles.optionTag, styles.optionTagNeutral]}>NEUTRAL</Text>
      </Pressable>
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
  optionTagAuto: {
    color: C.surface,
    backgroundColor: C.forest,
  },
  optionTagToday: {
    color: C.surface,
    backgroundColor: C.navy,
  },
  optionTagMissed: {
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
