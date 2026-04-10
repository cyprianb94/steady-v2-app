import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Injury, TrainingPlan } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { GoalReassessment } from './GoalReassessment';

interface InjuryBannerProps {
  injury: Injury;
  plan: TrainingPlan;
  weekNumber: number;
  totalWeeks: number;
  onSaveReassessedTarget: (value: string) => Promise<void> | void;
  isSavingGoal?: boolean;
}

function formatMarkedDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatStatus(status: Injury['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function InjuryBanner({
  injury,
  plan,
  weekNumber,
  totalWeeks,
  onSaveReassessedTarget,
  isSavingGoal = false,
}: InjuryBannerProps) {
  return (
    <View style={styles.banner}>
      <View style={styles.topRow}>
        <Text style={styles.injuryChip}>Injury</Text>
        <Text style={styles.statusPill}>{formatStatus(injury.status)}</Text>
      </View>

      <Text style={styles.title}>{injury.name}</Text>
      <Text style={styles.meta}>
        Marked {formatMarkedDate(injury.markedDate)} · Week {weekNumber} of {totalWeeks} ·{' '}
        {plan.raceDistance.toLowerCase()} plan
      </Text>

      <GoalReassessment
        originalTarget={plan.targetTime}
        reassessedTarget={injury.reassessedTarget}
        onSave={onSaveReassessedTarget}
        isSaving={isSavingGoal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: C.clayBg,
    borderWidth: 1.5,
    borderColor: `${C.clay}35`,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  injuryChip: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#FFFFFF',
    backgroundColor: C.clay,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPill: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    color: C.forest,
    backgroundColor: C.forestBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(42, 92, 69, 0.2)',
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    lineHeight: 28,
    color: C.ink,
  },
  meta: {
    marginTop: 4,
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
});
