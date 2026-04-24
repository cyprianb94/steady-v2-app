import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

export interface EditableChipOption {
  key: string;
  label: string;
}

interface EditableChipStripProps {
  options: EditableChipOption[];
  selectedKey: string | null;
  activeColor?: string;
  customActive?: boolean;
  customEditing?: boolean;
  customLabel?: string;
  customValue?: string;
  customUnit?: string;
  customPlaceholder?: string;
  customKeyboardType?: KeyboardTypeOptions;
  onSelect: (key: string) => void;
  onCustomPress: () => void;
  onCustomChangeText: (value: string) => void;
  onCustomBlur?: () => void;
  onCustomFocus?: () => void;
}

export function EditableChipStrip({
  options,
  selectedKey,
  activeColor = C.clay,
  customActive = false,
  customEditing = false,
  customLabel = 'Custom...',
  customValue = '',
  customUnit,
  customPlaceholder = 'Custom',
  customKeyboardType = 'default',
  onSelect,
  onCustomPress,
  onCustomChangeText,
  onCustomBlur,
  onCustomFocus,
}: EditableChipStripProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {options.map((option) => {
          const active = !customEditing && selectedKey === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => onSelect(option.key)}
              style={[
                styles.chip,
                active && { borderColor: activeColor, backgroundColor: activeColor },
              ]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}

        {customEditing ? (
          <View
            style={[
              styles.chip,
              styles.customInputChip,
              { borderColor: activeColor, backgroundColor: activeColor },
            ]}
          >
            <TextInput
              autoFocus
              selectTextOnFocus
              value={customValue}
              onChangeText={onCustomChangeText}
              onBlur={onCustomBlur}
              onFocus={onCustomFocus}
              keyboardType={customKeyboardType}
              placeholder={customPlaceholder}
              placeholderTextColor={C.surface}
              selectionColor={C.surface}
              style={styles.customInput}
            />
            {customUnit ? <Text style={styles.customInputUnit}>{customUnit}</Text> : null}
          </View>
        ) : (
          <Pressable
            onPress={onCustomPress}
            style={[
              styles.chip,
              styles.customChip,
              customActive && {
                borderColor: activeColor,
                backgroundColor: activeColor,
                borderStyle: 'solid',
              },
            ]}
          >
            <Text style={[styles.customText, customActive && styles.chipTextActive]}>
              {customLabel}
            </Text>
          </Pressable>
        )}
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
    minHeight: 42,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
  customInputChip: {
    minWidth: 104,
    flexDirection: 'row',
    gap: 5,
  },
  customInput: {
    minWidth: 34,
    maxWidth: 58,
    padding: 0,
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.surface,
    textAlign: 'center',
  },
  customInputUnit: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.surface,
  },
  customText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: C.muted,
  },
});
