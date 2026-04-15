import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { PHASE_COLOR } from '../../constants/phase-meta';
import { FONTS } from '../../constants/typography';
import type { PlanWeek } from '@steady/types';
import { usePreferences } from '../../providers/preferences-context';
import { formatDistance } from '../../lib/units';

interface LoadBarProps {
  week: PlanWeek;
  maxKm: number;
}

export function LoadBar({ week, maxKm }: LoadBarProps) {
  const { units } = usePreferences();
  const pct = maxKm > 0 ? Math.round((week.plannedKm / maxKm) * 100) : 0;
  const color = PHASE_COLOR[week.phase] || C.clay;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.kmValue}>{formatDistance(week.plannedKm, units)}</Text>
        <View style={[styles.phaseBadge, { backgroundColor: `${color}18` }]}>
          <Text style={[styles.phaseText, { color }]}>{week.phase}</Text>
        </View>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFg, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  kmValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 15,
    color: C.ink,
  },
  phaseBadge: {
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  phaseText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  barBg: {
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFg: {
    height: '100%',
    borderRadius: 2,
  },
});
