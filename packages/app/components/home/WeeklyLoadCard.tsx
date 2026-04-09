import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

interface WeeklyLoadCardProps {
  actualKm: number;
  plannedKm: number;
}

function formatKm(value: number): string {
  return `${Number(value.toFixed(1)).toString()}km`;
}

export function WeeklyLoadCard({ actualKm, plannedKm }: WeeklyLoadCardProps) {
  const pct = plannedKm > 0 ? Math.max(0, Math.min(1, actualKm / plannedKm)) : 0;

  return (
    <View style={styles.card} testID="weekly-load-card">
      <View style={styles.labelRow}>
        <Text style={styles.label}>WEEKLY LOAD</Text>
        <View style={styles.valueRow}>
          <Text style={styles.actual}>{formatKm(actualKm)}</Text>
          <Text style={styles.planned}>/ {plannedKm}km</Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 6,
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.muted,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  actual: {
    fontFamily: FONTS.monoBold,
    fontSize: 15,
    color: C.forest,
  },
  planned: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    color: C.muted,
    marginLeft: 2,
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
    backgroundColor: C.forest,
  },
});
