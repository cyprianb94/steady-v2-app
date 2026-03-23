import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import type { TrainingPlan } from '@steady/types';

interface WeekHeaderProps {
  plan: TrainingPlan;
  weekNumber: number;
  totalWeeks: number;
  onPrev: () => void;
  onNext: () => void;
}

export function WeekHeader({ plan, weekNumber, totalWeeks, onPrev, onNext }: WeekHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.raceName}>{plan.raceName}</Text>
        <Text style={styles.target}>{plan.targetTime}</Text>
      </View>
      <View style={styles.weekNav}>
        <Pressable onPress={onPrev} disabled={weekNumber <= 1} style={styles.navBtn}>
          <Text style={[styles.navArrow, weekNumber <= 1 && styles.navDisabled]}>‹</Text>
        </Pressable>
        <Text style={styles.weekLabel}>Week {weekNumber} of {totalWeeks}</Text>
        <Pressable onPress={onNext} disabled={weekNumber >= totalWeeks} style={styles.navBtn}>
          <Text style={[styles.navArrow, weekNumber >= totalWeeks && styles.navDisabled]}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  raceName: {
    fontFamily: FONTS.serifBold,
    fontSize: 24,
    color: C.ink,
  },
  target: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.clay,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  navBtn: {
    padding: 8,
  },
  navArrow: {
    fontFamily: FONTS.sans,
    fontSize: 22,
    color: C.ink,
  },
  navDisabled: {
    color: C.border,
  },
  weekLabel: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.ink2,
  },
});
