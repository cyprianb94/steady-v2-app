import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import type { SessionDurationUnit } from '@steady/types';
import { triggerSelectionChangeHaptic } from '../../lib/haptics';

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
        const activeColor = option === 'km' ? C.metricDistance : C.metricTime;
        const activeBackgroundColor = `${activeColor}14`;
        return (
          <Pressable
            key={option}
            disabled={disabled}
            onPress={(event) => {
              event?.stopPropagation?.();
              if (active) {
                return;
              }
              triggerSelectionChangeHaptic();
              onChange(option);
            }}
            style={[
              styles.segment,
              active && {
                backgroundColor: activeBackgroundColor,
              },
            ]}
          >
            <Text style={[styles.label, active && { color: activeColor }]}>
              {option.toUpperCase()}
            </Text>
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
    minWidth: 27,
    paddingVertical: 4,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONTS.monoBold,
    fontSize: 8.5,
    letterSpacing: 1,
    color: C.muted,
  },
});
