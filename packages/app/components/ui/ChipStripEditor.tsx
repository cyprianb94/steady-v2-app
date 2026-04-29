import React from 'react';
import type { SessionDurationUnit } from '@steady/types';
import { C } from '../../constants/colours';
import { EditableChipStrip } from './EditableChipStrip';

interface ChipStripEditorProps {
  presets: number[];
  unit: SessionDurationUnit;
  value: number | null;
  onSelect: (value: number) => void;
  customEditing?: boolean;
  customValue?: string;
  activeColor?: string;
  activeBackgroundColor?: string;
  activeTextColor?: string;
  activeCaptionColor?: string;
  inactiveTextColor?: string;
  onCustomPress: () => void;
  onCustomChangeText: (value: string) => void;
  onCustomBlur?: () => void;
  onCustomFocus?: () => void;
}

function formatValueLabel(value: number, unit: SessionDurationUnit): string {
  if (value === 0) {
    return 'Off';
  }

  if (unit === 'km' && value > 0 && value < 1) {
    return `${Math.round(value * 1000)}m`;
  }

  return `${value} ${unit}`;
}

function metricColorForUnit(unit: SessionDurationUnit): string {
  return unit === 'km' ? C.metricDistance : C.metricTime;
}

export function ChipStripEditor({
  presets,
  unit,
  value,
  onSelect,
  customEditing = false,
  customValue = '',
  activeColor,
  activeBackgroundColor,
  activeTextColor,
  activeCaptionColor,
  inactiveTextColor,
  onCustomPress,
  onCustomChangeText,
  onCustomBlur,
  onCustomFocus,
}: ChipStripEditorProps) {
  const isCustomValue = value != null && !presets.includes(value);
  const resolvedActiveColor = activeColor ?? metricColorForUnit(unit);
  const resolvedActiveBackgroundColor = activeBackgroundColor ?? `${resolvedActiveColor}14`;
  const resolvedActiveTextColor = activeTextColor ?? resolvedActiveColor;
  const resolvedActiveCaptionColor = activeCaptionColor ?? C.ink2;
  const resolvedInactiveTextColor = inactiveTextColor ?? resolvedActiveColor;

  return (
    <EditableChipStrip
      options={presets.map((preset) => ({
        key: String(preset),
        label: formatValueLabel(preset, unit),
      }))}
      selectedKey={value != null ? String(value) : null}
      activeColor={resolvedActiveColor}
      activeBackgroundColor={resolvedActiveBackgroundColor}
      activeTextColor={resolvedActiveTextColor}
      activeCaptionColor={resolvedActiveCaptionColor}
      inactiveTextColor={resolvedInactiveTextColor}
      customActive={isCustomValue}
      customEditing={customEditing}
      customLabel={isCustomValue && value != null ? formatValueLabel(value, unit) : 'Custom...'}
      customValue={customValue}
      customUnit={unit}
      customKeyboardType="decimal-pad"
      onSelect={(key) => onSelect(Number(key))}
      onCustomPress={onCustomPress}
      onCustomChangeText={onCustomChangeText}
      onCustomBlur={onCustomBlur}
      onCustomFocus={onCustomFocus}
    />
  );
}
