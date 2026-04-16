import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { PlannedSession } from '@steady/types';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { C } from '../../constants/colours';
import { usePreferences } from '../../providers/preferences-context';
import { formatCompactSessionLabel } from '../../lib/units';

interface CompactDayRowProps {
  dayName: string;
  dateLabel?: string;
  session: PlannedSession | null;
  status?: 'completed' | 'off-target' | 'missed' | 'today' | 'upcoming' | 'rest';
  metricLabel?: string | null;
  onPress?: () => void;
}

function StatusIcon({ status }: { status: 'completed' | 'off-target' | 'missed' }) {
  if (status === 'completed') {
    return (
      <View style={styles.checkBadge} testID="day-row-check">
        <Text style={styles.checkGlyph}>✓</Text>
      </View>
    );
  }

  return (
    <View style={styles.warningWrap} testID="day-row-warning">
      <View style={styles.warningTriangle} />
      <Text style={styles.warningGlyph}>!</Text>
    </View>
  );
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
        {metricLabel ? <Text style={styles.metricLabel}>{metricLabel}</Text> : null}
        {rowStatus === 'completed' && <StatusIcon status="completed" />}
        {(rowStatus === 'off-target' || rowStatus === 'missed') && <StatusIcon status={rowStatus} />}
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
  muted: {
    color: C.muted,
  },
  checkBadge: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(42,92,69,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(42,92,69,0.08)',
  },
  checkGlyph: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.forest,
    lineHeight: 10,
  },
  warningWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  warningTriangle: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(196,82,42,0.22)',
    top: 1,
  },
  warningGlyph: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.clay,
    lineHeight: 10,
    marginTop: 2,
  },
});
