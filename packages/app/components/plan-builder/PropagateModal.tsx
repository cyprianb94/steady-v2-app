import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import type { PhaseName } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { Btn } from '../ui/Btn';

interface PropagateModalProps {
  changeDesc: string;
  weekIndex: number;
  totalWeeks: number;
  phaseName: PhaseName;
  onApply: (scope: 'this' | 'remaining' | 'build') => void;
  onClose: () => void;
}

const OPTIONS = [
  { key: 'this' as const, label: 'This week only' },
  { key: 'remaining' as const, label: 'All remaining weeks' },
  { key: 'build' as const, label: '' },
];

function phaseLabel(phaseName: PhaseName): string {
  return `${phaseName.slice(0, 1)}${phaseName.slice(1).toLowerCase()}`;
}

export function PropagateModal({
  changeDesc,
  weekIndex,
  totalWeeks,
  phaseName,
  onApply,
  onClose,
}: PropagateModalProps) {
  const [scope, setScope] = useState<'this' | 'remaining' | 'build'>('remaining');
  const phaseDisplay = phaseLabel(phaseName);

  const subs: Record<string, string> = {
    this: `Week ${weekIndex + 1} only`,
    remaining: `Weeks ${weekIndex + 1}–${totalWeeks}`,
    build: `Every ${phaseDisplay.toLowerCase()} week in the plan`,
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Apply change where?</Text>
            <Text style={styles.changeDesc}>{changeDesc}</Text>
          </View>

          {/* Options */}
          <View style={styles.options}>
            {OPTIONS.map((o) => {
              const active = scope === o.key;
              const optionLabel = o.key === 'build' ? `${phaseDisplay} phase only` : o.label;
              return (
                <Pressable
                  key={o.key}
                  onPress={() => setScope(o.key)}
                  style={[
                    styles.option,
                    {
                      borderColor: active ? C.clay : C.border,
                      backgroundColor: active ? C.clayBg : C.cream,
                    },
                  ]}
                >
                  <View style={styles.optionText}>
                    <Text
                      style={[
                        styles.optionLabel,
                        { fontWeight: active ? '600' : '400' },
                      ]}
                    >
                      {optionLabel}
                    </Text>
                    <Text style={styles.optionSub}>{subs[o.key]}</Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      {
                        borderColor: active ? C.clay : C.border,
                        backgroundColor: active ? C.clay : 'transparent',
                      },
                    ]}
                  >
                    {active && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Apply button */}
          <View style={styles.footer}>
            <Btn title="Apply change" onPress={() => onApply(scope)} fullWidth />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28,21,16,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 19,
    color: C.ink,
    marginBottom: 5,
  },
  changeDesc: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: C.clay,
  },
  options: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.ink,
  },
  optionSub: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'white',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
});
