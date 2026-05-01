import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import type { RunStructureVolumeUnit, SessionDurationUnit } from '@steady/types';
import { triggerSelectionChangeHaptic } from '../../lib/haptics';

type UnitToggleValue = SessionDurationUnit | RunStructureVolumeUnit;

interface UnitTogglePillProps<T extends UnitToggleValue = SessionDurationUnit> {
  value: T;
  onChange: (value: T) => void;
  options?: readonly T[];
  disabled?: boolean;
}

const OPTIONS: SessionDurationUnit[] = ['km', 'min'];

function activeColorFor(option: UnitToggleValue): string {
  return option === 'km' ? C.metricDistance : C.metricTime;
}

export function UnitTogglePill<T extends UnitToggleValue = SessionDurationUnit>({
  value,
  onChange,
  options,
  disabled = false,
}: UnitTogglePillProps<T>) {
  const resolvedOptions = (options ?? OPTIONS) as unknown as readonly T[];

  return (
    <View style={[styles.shell, disabled && styles.disabled]}>
      {resolvedOptions.map((option) => {
        const active = option === value;
        const activeColor = activeColorFor(option);
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
