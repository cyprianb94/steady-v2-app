import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PlannedSession } from '@steady/types';
import { SESSION_TYPE } from '../../constants/session-types';
import { sessionLabel } from '../../lib/plan-helpers';
import { FONTS } from '../../constants/typography';
import { C } from '../../constants/colours';

interface CompactDayRowProps {
  dayName: string;
  dateLabel?: string;
  session: PlannedSession | null;
  status?: 'completed' | 'off-target' | 'missed' | 'today' | 'upcoming' | 'rest';
  metricLabel?: string | null;
}

export function CompactDayRow({ dayName, dateLabel, session, status, metricLabel }: CompactDayRowProps) {
  const isRest = !session || session.type === 'REST';
  const meta = session && !isRest ? SESSION_TYPE[session.type] : null;
  const rowStatus = status ?? (session?.actualActivityId ? 'completed' : isRest ? 'rest' : 'upcoming');

  return (
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
        {sessionLabel(session)}
      </Text>

      <View style={styles.statusBlock}>
        {metricLabel ? <Text style={styles.metricLabel}>{metricLabel}</Text> : null}
        {rowStatus === 'completed' && (
          <Text style={styles.check} testID="day-row-check">
            ✓
          </Text>
        )}
        {rowStatus === 'off-target' && (
          <Text style={styles.warning} testID="day-row-warning">
            ⚠
          </Text>
        )}
        {rowStatus === 'missed' && (
          <Text style={styles.missed} testID="day-row-missed">
            Missed
          </Text>
        )}
        {rowStatus === 'today' && (
          <Text style={styles.todayBadge} testID="day-row-today">
            Today
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 10,
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
    fontSize: 13,
    color: C.ink,
  },
  date: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink2,
  },
  statusBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: C.muted,
  },
  muted: {
    color: C.muted,
  },
  check: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.forest,
  },
  missed: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.clay,
  },
  warning: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.amber,
  },
  todayBadge: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.amber,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
