import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { PHASE_COLOR } from '../../constants/phase-meta';
import { FONTS } from '../../constants/typography';
import type { PhaseConfig, PhaseName } from '@steady/types';

interface PhaseEditorProps {
  phases: PhaseConfig;
  totalWeeks: number;
  onChange: (phases: PhaseConfig) => void;
  onDone?: () => void;
}

const PHASE_ORDER: PhaseName[] = ['BASE', 'BUILD', 'RECOVERY', 'PEAK', 'TAPER'];

const PHASE_LABEL: Record<PhaseName, string> = {
  BASE: 'Base',
  BUILD: 'Build',
  RECOVERY: 'Recovery',
  PEAK: 'Peak',
  TAPER: 'Taper',
};

const PHASE_DESC: Record<PhaseName, string> = {
  BASE: 'Settle routine and aerobic rhythm.',
  BUILD: 'Main progression. Auto-adjusts.',
  RECOVERY: 'Optional deload weeks inside build.',
  PEAK: 'Final high-load block before taper.',
  TAPER: 'Reduce volume into race week.',
};

function phaseMinimum(phase: PhaseName): number {
  return phase === 'RECOVERY' ? 0 : 1;
}

export function PhaseEditor({ phases, totalWeeks, onChange, onDone }: PhaseEditorProps) {
  const assignedWeeks = PHASE_ORDER.reduce((sum, phase) => sum + phases[phase], 0);
  const isBalanced = assignedWeeks === totalWeeks;

  const adjust = (phase: PhaseName, delta: number) => {
    if (phase === 'BUILD') return;

    const current = phases[phase];
    const next = Math.max(phaseMinimum(phase), current + delta);
    const diff = next - current;
    if (diff === 0) return;

    const buildNext = phases.BUILD - diff;
    if (buildNext < 1) return;

    onChange({ ...phases, [phase]: next, BUILD: buildNext });
  };

  return (
    <View style={styles.container} testID="phase-editor">
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Phase structure</Text>
          <Text style={styles.subtitle}>
            Base, recovery, peak, and taper move. Build absorbs the difference.
          </Text>
        </View>
        {onDone ? (
          <Pressable onPress={onDone} testID="phase-editor-done">
            <Text style={styles.done}>Done</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.bar}>
        {PHASE_ORDER.map((phase) => {
          const weekCount = phases[phase];
          if (weekCount <= 0) return null;
          const showLabel = weekCount / Math.max(totalWeeks, 1) >= 0.12;

          return (
            <View
              key={phase}
              style={[styles.barSegment, { flex: weekCount, backgroundColor: PHASE_COLOR[phase] }]}
            >
              {showLabel ? (
                <Text style={styles.barLabel} numberOfLines={1}>{PHASE_LABEL[phase]}</Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.rows}>
        {PHASE_ORDER.map((phase, index) => {
          const isBuild = phase === 'BUILD';
          const weekCount = phases[phase];
          const canDecrement = !isBuild && weekCount > phaseMinimum(phase);
          const canIncrement = !isBuild && phases.BUILD > 1;

          return (
            <View key={phase} style={[styles.row, index === 0 && styles.firstRow]}>
              <View style={styles.rowCopy}>
                <View style={styles.phaseNameLine}>
                  <View style={[styles.dot, { backgroundColor: PHASE_COLOR[phase] }]} />
                  <Text style={styles.phaseName}>{PHASE_LABEL[phase]}</Text>
                </View>
                <Text style={styles.phaseDesc}>{PHASE_DESC[phase]}</Text>
              </View>

              {isBuild ? (
                <View style={styles.auto} testID="phase-editor-build-auto">
                  <Text style={styles.autoCount} testID="phase-editor-build-count">{weekCount}w</Text>
                  <Text style={styles.autoLabel}>auto-adjusts</Text>
                </View>
              ) : (
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => adjust(phase, -1)}
                    disabled={!canDecrement}
                    style={[styles.stepButton, !canDecrement && styles.stepButtonDisabled]}
                    testID={`phase-editor-${phase.toLowerCase()}-decrement`}
                  >
                    <Text style={[styles.stepText, !canDecrement && styles.stepTextDisabled]}>−</Text>
                  </Pressable>
                  <Text style={styles.stepCount} testID={`phase-editor-${phase.toLowerCase()}-count`}>
                    {weekCount}w
                  </Text>
                  <Pressable
                    onPress={() => adjust(phase, 1)}
                    disabled={!canIncrement}
                    style={[styles.stepButton, !canIncrement && styles.stepButtonDisabled]}
                    testID={`phase-editor-${phase.toLowerCase()}-increment`}
                  >
                    <Text style={[styles.stepText, !canIncrement && styles.stepTextDisabled]}>+</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <Text style={[styles.total, !isBalanced && styles.totalUnbalanced]}>
        {assignedWeeks} / {totalWeeks} weeks {isBalanced ? '✓' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
  },
  header: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: C.ink,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    lineHeight: 15,
    marginTop: 3,
  },
  done: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.clay,
  },
  bar: {
    height: 29,
    flexDirection: 'row',
    gap: 2,
    overflow: 'hidden',
    borderRadius: 8,
    marginBottom: 14,
  },
  barSegment: {
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barLabel: {
    paddingHorizontal: 3,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 8,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: C.surface,
  },
  rows: {
    borderTopWidth: 0,
  },
  row: {
    minHeight: 48,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  firstRow: {
    borderTopWidth: 0,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  phaseNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: C.ink,
  },
  phaseDesc: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
  },
  stepper: {
    height: 31,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 9,
    backgroundColor: C.cream,
  },
  stepButton: {
    width: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: {
    opacity: 0.42,
  },
  stepText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: C.ink,
  },
  stepTextDisabled: {
    color: C.muted,
  },
  stepCount: {
    width: 38,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: C.border,
    textAlign: 'center',
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    lineHeight: 31,
    color: C.ink,
  },
  auto: {
    minWidth: 96,
    alignItems: 'flex-end',
  },
  autoCount: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: C.ink,
  },
  autoLabel: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
    marginTop: 2,
  },
  total: {
    marginTop: 9,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: C.forest,
  },
  totalUnbalanced: {
    color: C.clay,
  },
});
