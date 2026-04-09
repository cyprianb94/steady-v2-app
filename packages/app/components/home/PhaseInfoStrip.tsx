import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PhaseName } from '@steady/types';
import { getPhaseColors } from '../../lib/phase-theme';
import { FONTS } from '../../constants/typography';
import { C } from '../../constants/colours';

interface PhaseInfoStripProps {
  phase: PhaseName;
  weekNumber: number;
  totalWeeks: number;
  raceDate?: string;
  today?: string;
}

function weeksUntil(fromDate: string, toDate: string): number {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const diffMs = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
}

function countdownLabel(countdown: number | null): string | null {
  if (countdown === null) {
    return null;
  }

  if (countdown === 0) {
    return 'Race week';
  }

  if (countdown === 1) {
    return '1 week to go';
  }

  return `${countdown} weeks to go`;
}

export function PhaseInfoStrip({ phase, weekNumber, totalWeeks, raceDate, today }: PhaseInfoStripProps) {
  const colors = getPhaseColors(phase);
  const countdown = raceDate && today ? weeksUntil(today, raceDate) : null;
  const countdownCopy = countdownLabel(countdown);

  return (
    <View style={styles.container} testID="phase-info-strip">
      <View style={[styles.badge, { backgroundColor: colors.badge }]}>
        <Text style={[styles.badgeText, { color: colors.badgeText }]}>{phase}</Text>
      </View>
      <Text style={styles.weekText}>Week {weekNumber} of {totalWeeks}</Text>
      {countdownCopy && (
        <Text style={styles.countdown}>{countdownCopy}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  weekText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink2,
  },
  countdown: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
  },
});
