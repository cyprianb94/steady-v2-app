import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { triggerSelectionChangeHaptic } from '../../lib/haptics';

interface Chip {
  key: string;
  label: string;
  color: string;
}

interface ChipRowProps {
  chips: Chip[];
  selected: string;
  onSelect: (key: string) => void;
}

export function ChipRow({ chips, selected, onSelect }: ChipRowProps) {
  return (
    <View style={styles.row}>
      {chips.map((chip) => {
        const active = chip.key === selected;
        return (
          <Pressable
            key={chip.key}
            onPress={() => {
              if (!active) {
                triggerSelectionChangeHaptic();
              }
              onSelect(chip.key);
            }}
            style={[
              styles.chip,
              {
                borderColor: active ? chip.color : C.border,
                backgroundColor: active ? `${chip.color}18` : C.cream,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: active ? chip.color : C.muted },
              ]}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
