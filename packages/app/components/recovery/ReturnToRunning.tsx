import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getRtrProgression, type Injury } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { SectionLabel } from '../ui/SectionLabel';

interface ReturnToRunningProps {
  injury: Injury;
  currentWeekNumber: number;
  isUpdating?: boolean;
  onMarkComplete: () => Promise<void> | void;
}

function stepTitle(label: string, suggestedSession: string, currentWeekNumber: number) {
  if (label === 'Resume plan') {
    return `Resume plan - Week ${currentWeekNumber}`;
  }
  return `${label} ${suggestedSession}`;
}

export function ReturnToRunning({
  injury,
  currentWeekNumber,
  isUpdating = false,
  onMarkComplete,
}: ReturnToRunningProps) {
  const progression = getRtrProgression(injury);
  const currentStep = progression.steps.find((step) => step.isCurrent);

  return (
    <View style={styles.section}>
      <SectionLabel>Return To Running</SectionLabel>
      <View style={styles.card}>
        <View style={styles.line} />
        {progression.steps.map((step) => {
          const isDone = step.isComplete;
          const isCurrent = step.isCurrent;
          const circleStyle = isDone
            ? styles.circleDone
            : isCurrent
              ? styles.circleCurrent
              : styles.circleFuture;

          return (
            <View key={step.index} style={[styles.stepRow, isCurrent && styles.stepRowCurrent]}>
              <View style={[styles.circle, circleStyle]}>
                <Text style={[styles.circleText, isDone || isCurrent ? styles.circleTextActive : styles.circleTextFuture]}>
                  {isDone ? '✓' : step.index + 1}
                </Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, !isDone && !isCurrent && styles.stepTitleFuture]}>
                  {stepTitle(step.label, step.suggestedSession, currentWeekNumber)}
                </Text>
                <Text style={styles.stepMeta}>
                  {step.completedDate
                    ? `Completed ${step.completedDate}`
                    : isCurrent
                      ? 'Current step'
                      : 'Upcoming'}
                </Text>
              </View>
            </View>
          );
        })}

        {currentStep ? (
          <Pressable onPress={() => onMarkComplete()} disabled={isUpdating} style={styles.completeButton}>
            <Text style={styles.completeButtonText}>
              {isUpdating ? 'Saving...' : `Mark Step ${currentStep.index + 1} Complete`}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.completeNote}>All recovery steps complete.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 14,
    marginBottom: 8,
  },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 14,
    position: 'relative',
  },
  line: {
    position: 'absolute',
    left: 27,
    top: 34,
    bottom: 58,
    width: 2,
    backgroundColor: C.border,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  stepRowCurrent: {
    backgroundColor: 'rgba(196, 82, 42, 0.06)',
    borderRadius: 8,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  circleCurrent: {
    backgroundColor: C.clay,
  },
  circleDone: {
    backgroundColor: C.forest,
  },
  circleFuture: {
    backgroundColor: C.border,
  },
  circleText: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
  },
  circleTextActive: {
    color: '#FFFFFF',
  },
  circleTextFuture: {
    color: C.muted,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
  },
  stepTitleFuture: {
    color: C.muted,
    fontFamily: FONTS.sans,
  },
  stepMeta: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
  },
  completeButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: C.clay,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  completeButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  completeNote: {
    marginTop: 10,
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
  },
});
