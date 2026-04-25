import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { PlannedSession } from '@steady/types';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { C } from '../../constants/colours';
import { usePreferences } from '../../providers/preferences-context';
import { formatCompactSessionLabel } from '../../lib/units';
import { RunStatusIcon, type RunStatusIconStatus } from '../run/RunStatusIcon';

interface CompactDayRowProps {
  dayName: string;
  dateLabel?: string;
  session: PlannedSession | null;
  status?: 'completed' | 'off-target' | 'missed' | 'skipped' | 'today' | 'upcoming' | 'rest';
  metricLabel?: string | null;
  onPress?: () => void;
}

function StatusIcon({ status }: { status: 'completed' | 'off-target' | 'missed' }) {
  const iconStatus: RunStatusIconStatus =
    status === 'off-target' ? 'varied' : status;
  const testID =
    status === 'off-target'
      ? 'day-row-off-target'
      : status === 'missed'
        ? 'day-row-warning'
        : 'day-row-check';

  return <RunStatusIcon status={iconStatus} size={18} testID={testID} />;
}

export function CompactDayRow({ dayName, dateLabel, session, status, metricLabel, onPress }: CompactDayRowProps) {
  const { units } = usePreferences();
  const isRest = !session || session.type === 'REST';
  const meta = session && !isRest ? SESSION_TYPE[session.type] : null;
  const rowStatus = status ?? (session?.actualActivityId ? 'completed' : isRest ? 'rest' : 'upcoming');
  const isPressable = typeof onPress === 'function';
  const rowContent = (
    <View
      style={[styles.row, rowStatus === 'today' && styles.todayRow]}
      testID="compact-day-row"
    >
      <View style={styles.dayBlock}>
        <Text style={[styles.day, isRest && styles.muted]}>{dayName}</Text>
        {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
      </View>

      {meta ? (
        <View style={[styles.dot, { backgroundColor: meta.color }]} />
      ) : (
        <View style={[styles.dot, { backgroundColor: C.border }]} />
      )}

      <Text style={[styles.label, isRest && styles.muted]} numberOfLines={1}>
        {formatCompactSessionLabel(session, units)}
      </Text>

      <View style={styles.statusBlock}>
        {metricLabel ? (
          <Text style={[styles.metricLabel, rowStatus === 'off-target' && styles.metricLabelOffTarget]}>
            {metricLabel}
          </Text>
        ) : null}
        {(rowStatus === 'completed' || rowStatus === 'off-target' || rowStatus === 'missed') && (
          <StatusIcon status={rowStatus} />
        )}
        {rowStatus === 'skipped' ? (
          <Text style={styles.skippedLabel}>Skipped</Text>
        ) : null}
      </View>
    </View>
  );

  if (isPressable) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.rowPressed]}
        testID="compact-day-row-pressable"
      >
        {rowContent}
      </Pressable>
    );
  }

  return rowContent;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 10,
  },
  rowPressed: {
    opacity: 0.82,
  },
  todayRow: {
    backgroundColor: 'rgba(212,136,42,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: -4,
  },
  dayBlock: {
    width: 40,
  },
  day: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  date: {
    fontFamily: FONTS.sansMedium,
    fontSize: 10,
    color: C.muted,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: C.ink2,
  },
  statusBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  metricLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: C.muted,
  },
  metricLabelOffTarget: {
    color: C.amber,
  },
  skippedLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.clay,
  },
  muted: {
    color: C.muted,
  },
});
