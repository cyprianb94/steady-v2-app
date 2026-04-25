import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { usePreferences } from '../../providers/preferences-context';
import { formatDistance } from '../../lib/units';
import { AnimatedProgressFill } from '../ui/AnimatedProgressFill';

const WEEKLY_LOAD_ACCENT = C.forest;
const WEEKLY_LOAD_BORDER = C.border;
const WEEKLY_LOAD_SURFACE = C.surface;

interface WeeklyLoadCardProps {
  actualKm: number;
  plannedKm: number;
}

export function WeeklyLoadCard({ actualKm, plannedKm }: WeeklyLoadCardProps) {
  const { units } = usePreferences();
  const pct = plannedKm > 0 ? Math.max(0, Math.min(1, actualKm / plannedKm)) : 0;

  return (
    <View style={styles.card} testID="weekly-load-card">
      <View style={styles.labelRow}>
        <Text style={styles.label}>WEEKLY LOAD</Text>
        <View style={styles.valueRow}>
          <Text style={styles.actual}>{formatDistance(actualKm, units)}</Text>
          <Text style={styles.planned}>/ {formatDistance(plannedKm, units)}</Text>
        </View>
      </View>
      <View style={styles.track}>
        <AnimatedProgressFill progress={pct} fillStyle={styles.fill} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 4,
    marginBottom: 16,
    backgroundColor: WEEKLY_LOAD_SURFACE,
    borderColor: WEEKLY_LOAD_BORDER,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.muted,
    flexShrink: 0,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    flexShrink: 1,
    minWidth: 0,
  },
  actual: {
    fontFamily: FONTS.monoBold,
    fontSize: 15,
    color: WEEKLY_LOAD_ACCENT,
    flexShrink: 1,
  },
  planned: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    color: C.muted,
    marginLeft: 2,
    flexShrink: 1,
  },
  track: {
    height: 5,
    backgroundColor: C.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: WEEKLY_LOAD_ACCENT,
  },
});
