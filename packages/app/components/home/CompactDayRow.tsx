import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PlannedSession } from '@steady/types';
import { SESSION_TYPE } from '../../constants/session-types';
import { sessionLabel } from '../../lib/plan-helpers';
import { FONTS } from '../../constants/typography';
import { C } from '../../constants/colours';

interface CompactDayRowProps {
  dayName: string;
  session: PlannedSession | null;
}

export function CompactDayRow({ dayName, session }: CompactDayRowProps) {
  const isRest = !session || session.type === 'REST';
  const meta = session && !isRest ? SESSION_TYPE[session.type] : null;
  const completed = !!session?.actualActivityId;

  return (
    <View style={styles.row} testID="compact-day-row">
      <Text style={[styles.day, isRest && styles.muted]}>{dayName}</Text>

      {meta ? (
        <View style={[styles.dot, { backgroundColor: meta.color }]} />
      ) : (
        <View style={[styles.dot, { backgroundColor: C.border }]} />
      )}

      <Text style={[styles.label, isRest && styles.muted]} numberOfLines={1}>
        {sessionLabel(session)}
      </Text>

      {completed && (
        <Text style={styles.check} testID="day-row-check">
          ✓
        </Text>
      )}
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
  day: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
    width: 32,
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
  muted: {
    color: C.muted,
  },
  check: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.forest,
  },
});
