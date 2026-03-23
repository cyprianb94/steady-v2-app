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
}

const PHASE_ORDER: PhaseName[] = ['BASE', 'BUILD', 'RECOVERY', 'PEAK', 'TAPER'];

export function PhaseEditor({ phases, totalWeeks, onChange }: PhaseEditorProps) {
  const adjust = (phase: PhaseName, delta: number) => {
    const current = phases[phase];
    const next = Math.max(phase === 'RECOVERY' ? 0 : 1, current + delta);
    const diff = next - current;
    if (diff === 0) return;

    // Take from / give to BUILD to keep total constant
    const buildNext = phases.BUILD - diff;
    if (buildNext < 1) return;

    onChange({ ...phases, [phase]: next, BUILD: buildNext });
  };

  return (
    <View style={styles.container}>
      {/* Phase bar visualization */}
      <View style={styles.bar}>
        {PHASE_ORDER.map((phase) => {
          const w = phases[phase];
          if (w === 0) return null;
          return (
            <View
              key={phase}
              style={[styles.barSegment, { flex: w, backgroundColor: PHASE_COLOR[phase] }]}
            />
          );
        })}
      </View>

      {/* Phase controls */}
      {PHASE_ORDER.map((phase) => (
        <View key={phase} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: PHASE_COLOR[phase] }]} />
          <Text style={styles.phaseName}>{phase}</Text>
          <View style={styles.stepper}>
            <Pressable onPress={() => adjust(phase, -1)} style={styles.stepBtn}>
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <Text style={styles.weekCount}>{phases[phase]}</Text>
            <Pressable onPress={() => adjust(phase, 1)} style={styles.stepBtn}>
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.weekLabel}>
            {phases[phase] === 1 ? 'week' : 'weeks'}
          </Text>
        </View>
      ))}

      <Text style={styles.total}>
        Total: {Object.values(phases).reduce((a, b) => a + b, 0)} / {totalWeeks} weeks
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  bar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    gap: 2,
    marginBottom: 4,
  },
  barSegment: {
    height: 6,
    borderRadius: 3,
  },
  row: {
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
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: C.ink,
    width: 72,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cream,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 16,
    color: C.ink,
  },
  weekCount: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.ink,
    minWidth: 20,
    textAlign: 'center',
  },
  weekLabel: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  total: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.muted,
    marginTop: 4,
  },
});
