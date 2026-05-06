import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { triggerSegmentTickHaptic } from '../../lib/haptics';

export type SessionEditorManualPaceMode = 'single' | 'range';

export interface SessionEditorTargetPaceOption {
  key: string;
  label: string;
  caption?: string;
}

interface SessionEditorTargetPaceSectionProps {
  profilePaceOptions: SessionEditorTargetPaceOption[];
  visiblePacePresets: string[];
  selectedTargetKey: string | null;
  paceAccentColor: string;
  customFieldIsPace: boolean;
  manualPaceMode: SessionEditorManualPaceMode;
  customPace: string;
  customSingleActive: boolean;
  customRangeActive: boolean;
  customPaceRangeFaster: string;
  customPaceRangeSlower: string;
  customPaceRangeError: string | null;
  onSelectTargetPaceOption: (value: string) => void;
  onOpenCustomPaceField: () => void;
  onCustomPaceChange: (text: string) => void;
  onCustomPaceBlur: () => void;
  onCustomPaceFocus: () => void;
  onOpenManualPaceRange: () => void;
  onChangeManualPaceRangeBoundary: (boundary: 'faster' | 'slower', text: string) => void;
  onPaceRangeInputFocus: () => void;
  onPaceRangeInputBlur: () => void;
}

export function SessionEditorTargetPaceSection({
  profilePaceOptions,
  visiblePacePresets,
  selectedTargetKey,
  paceAccentColor,
  customFieldIsPace,
  manualPaceMode,
  customPace,
  customSingleActive,
  customRangeActive,
  customPaceRangeFaster,
  customPaceRangeSlower,
  customPaceRangeError,
  onSelectTargetPaceOption,
  onOpenCustomPaceField,
  onCustomPaceChange,
  onCustomPaceBlur,
  onCustomPaceFocus,
  onOpenManualPaceRange,
  onChangeManualPaceRangeBoundary,
  onPaceRangeInputFocus,
  onPaceRangeInputBlur,
}: SessionEditorTargetPaceSectionProps) {
  function selectWithHaptic(value: string) {
    if (selectedTargetKey !== value) {
      triggerSegmentTickHaptic();
    }
    onSelectTargetPaceOption(value);
  }

  return (
    <View style={styles.targetPaceCard}>
      {profilePaceOptions.length > 0 ? (
        <View style={styles.targetPaceGroup}>
          <Text style={styles.targetPaceGroupLabel}>Training paces</Text>
          <View style={styles.targetPaceTrainingList}>
            {profilePaceOptions.map((option) => {
              const active = selectedTargetKey === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => selectWithHaptic(option.key)}
                  style={({ pressed }) => [
                    styles.targetPaceTrainingOption,
                    active && {
                      borderColor: paceAccentColor,
                      backgroundColor: C.metricPaceBg,
                    },
                    pressed && styles.targetPaceOptionPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.targetPaceTrainingLabel,
                      active && { color: paceAccentColor },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.caption ? (
                    <Text
                      style={[
                        styles.targetPaceTrainingCaption,
                        active && { color: C.ink2 },
                      ]}
                    >
                      {option.caption}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={[styles.targetPaceGroup, profilePaceOptions.length > 0 && styles.targetPaceGroupWithDivider]}>
        <Text style={styles.targetPaceGroupLabel}>Custom</Text>
        <View style={styles.targetPaceChipRow}>
          {visiblePacePresets.map((preset) => {
            const active = selectedTargetKey === preset;
            return (
              <Pressable
                key={preset}
                onPress={() => selectWithHaptic(preset)}
                style={({ pressed }) => [
                  styles.targetPaceChip,
                  active && {
                    borderColor: paceAccentColor,
                    backgroundColor: C.metricPaceBg,
                  },
                  pressed && styles.targetPaceOptionPressed,
                ]}
              >
                <Text
                  style={[
                    styles.targetPaceChipText,
                    active && styles.targetPaceChipTextActive,
                    active && { color: paceAccentColor },
                  ]}
                >
                  {preset} /km
                </Text>
              </Pressable>
            );
          })}

          {customFieldIsPace && manualPaceMode === 'single' ? (
            <View
              style={[
                styles.targetPaceChip,
                styles.targetPaceInputChip,
                {
                  borderColor: paceAccentColor,
                  backgroundColor: C.metricPaceBg,
                },
              ]}
            >
              <TextInput
                testID="editable-chip-custom-input"
                autoFocus
                selectTextOnFocus
                value={customPace}
                onChangeText={onCustomPaceChange}
                onBlur={onCustomPaceBlur}
                onFocus={onCustomPaceFocus}
                keyboardType="numbers-and-punctuation"
                selectionColor={paceAccentColor}
                style={[styles.targetPaceCustomInput, { color: paceAccentColor }]}
              />
              <Text style={[styles.targetPaceInputUnit, { color: paceAccentColor }]}>/km</Text>
            </View>
          ) : (
            <Pressable
              onPress={onOpenCustomPaceField}
              style={({ pressed }) => [
                styles.targetPaceChip,
                styles.targetPaceCustomAction,
                customSingleActive && {
                  borderColor: paceAccentColor,
                  backgroundColor: C.metricPaceBg,
                  borderStyle: 'solid',
                },
                pressed && styles.targetPaceOptionPressed,
              ]}
            >
              <Text
                style={[
                  styles.targetPaceCustomText,
                  customSingleActive && {
                    color: paceAccentColor,
                    fontFamily: FONTS.sansSemiBold,
                  },
                ]}
              >
                Custom pace...
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={onOpenManualPaceRange}
            style={({ pressed }) => [
              styles.targetPaceChip,
              styles.targetPaceCustomAction,
              customRangeActive && {
                borderColor: paceAccentColor,
                backgroundColor: C.metricPaceBg,
                borderStyle: 'solid',
              },
              pressed && styles.targetPaceOptionPressed,
            ]}
          >
            <Text
              style={[
                styles.targetPaceCustomText,
                customRangeActive && {
                  color: paceAccentColor,
                  fontFamily: FONTS.sansSemiBold,
                },
              ]}
            >
              Custom range...
            </Text>
          </Pressable>
        </View>
      </View>

      {manualPaceMode === 'range' ? (
        <View style={styles.paceRangeEditor} testID="session-editor-pace-range-editor">
          <View style={styles.paceRangeInputs}>
            <View style={styles.paceRangeInputWrap}>
              <Text style={styles.paceRangeInputLabel}>Faster end</Text>
              <TextInput
                testID="session-editor-pace-range-faster"
                selectTextOnFocus
                value={customPaceRangeFaster}
                onChangeText={(text) => onChangeManualPaceRangeBoundary('faster', text)}
                onFocus={onPaceRangeInputFocus}
                onBlur={onPaceRangeInputBlur}
                keyboardType="numbers-and-punctuation"
                selectionColor={paceAccentColor}
                style={[styles.paceRangeInput, { borderColor: paceAccentColor }]}
              />
            </View>
            <View style={styles.paceRangeInputWrap}>
              <Text style={styles.paceRangeInputLabel}>Slower end</Text>
              <TextInput
                testID="session-editor-pace-range-slower"
                selectTextOnFocus
                value={customPaceRangeSlower}
                onChangeText={(text) => onChangeManualPaceRangeBoundary('slower', text)}
                onFocus={onPaceRangeInputFocus}
                onBlur={onPaceRangeInputBlur}
                keyboardType="numbers-and-punctuation"
                selectionColor={paceAccentColor}
                style={[styles.paceRangeInput, { borderColor: paceAccentColor }]}
              />
            </View>
          </View>
          {customPaceRangeError ? (
            <Text style={styles.paceRangeError}>{customPaceRangeError}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  targetPaceCard: {
    gap: 12,
  },
  targetPaceGroup: {
    gap: 8,
  },
  targetPaceGroupWithDivider: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  targetPaceGroupLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.muted,
  },
  targetPaceTrainingList: {
    gap: 7,
  },
  targetPaceTrainingOption: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 11,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  targetPaceTrainingLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
  },
  targetPaceTrainingCaption: {
    marginTop: 2,
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    color: C.muted,
  },
  targetPaceChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  targetPaceChip: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  targetPaceOptionPressed: {
    opacity: 0.78,
  },
  targetPaceChipText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: C.metricPace,
  },
  targetPaceChipTextActive: {
    fontFamily: FONTS.monoBold,
  },
  targetPaceCustomAction: {
    borderStyle: 'dashed',
  },
  targetPaceCustomText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: C.metricPace,
  },
  targetPaceInputChip: {
    paddingLeft: 10,
    paddingRight: 9,
  },
  targetPaceCustomInput: {
    minWidth: 46,
    paddingVertical: 0,
    fontFamily: FONTS.monoBold,
    fontSize: 12,
  },
  targetPaceInputUnit: {
    marginLeft: 2,
    fontFamily: FONTS.monoBold,
    fontSize: 12,
  },
  paceRangeEditor: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    padding: 10,
    gap: 8,
  },
  paceRangeInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  paceRangeInputWrap: {
    flex: 1,
    gap: 5,
  },
  paceRangeInputLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    color: C.muted,
  },
  paceRangeInput: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: C.cream,
    paddingHorizontal: 10,
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.ink,
  },
  paceRangeError: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11.5,
    lineHeight: 16,
    color: C.clay,
  },
});
