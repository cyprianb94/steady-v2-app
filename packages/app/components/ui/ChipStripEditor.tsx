import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import type { SessionDurationUnit } from '@steady/types';

interface ChipStripEditorProps {
  presets: number[];
  unit: SessionDurationUnit;
  value: number | null;
  onSelect: (value: number) => void;
  onCustom: () => void;
}

function formatValueLabel(value: number, unit: SessionDurationUnit): string {
  if (value === 0) {
    return 'Off';
  }

  return `${value} ${unit}`;
}

export function ChipStripEditor({
  presets,
  unit,
  value,
  onSelect,
  onCustom,
}: ChipStripEditorProps) {
  const isCustomValue = value != null && !presets.includes(value);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {presets.map((preset) => {
          const active = value === preset;
          return (
            <Pressable
              key={`${unit}-${preset}`}
              onPress={() => onSelect(preset)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {formatValueLabel(preset, unit)}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={onCustom}
          style={[styles.chip, styles.customChip, isCustomValue && styles.customChipActive]}
        >
          <Text style={[styles.customText, isCustomValue && styles.chipTextActive]}>Custom…</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipActive: {
    borderColor: C.clay,
    backgroundColor: C.clay,
  },
  chipText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.ink,
  },
  chipTextActive: {
    color: C.surface,
    fontFamily: FONTS.monoBold,
  },
  customChip: {
    borderStyle: 'dashed',
  },
  customChipActive: {
    borderColor: C.clay,
    backgroundColor: C.clay,
    borderStyle: 'solid',
  },
  customText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: C.muted,
  },
});
