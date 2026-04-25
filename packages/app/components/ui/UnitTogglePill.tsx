import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import type { SessionDurationUnit } from '@steady/types';
import { triggerSelectionHaptic } from '../../lib/haptics';

interface UnitTogglePillProps {
  value: SessionDurationUnit;
  onChange: (value: SessionDurationUnit) => void;
  disabled?: boolean;
}

const OPTIONS: SessionDurationUnit[] = ['km', 'min'];

export function UnitTogglePill({ value, onChange, disabled = false }: UnitTogglePillProps) {
  return (
    <View style={[styles.shell, disabled && styles.disabled]}>
      {OPTIONS.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            disabled={disabled}
            onPress={(event) => {
              event?.stopPropagation?.();
              triggerSelectionHaptic();
              onChange(option);
            }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.45,
  },
  segment: {
    minWidth: 34,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: C.clay,
  },
  label: {
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    letterSpacing: 1,
    color: C.muted,
  },
  labelActive: {
    color: C.surface,
  },
});
