import React from 'react';
import type { SessionDurationUnit } from '@steady/types';
import { EditableChipStrip } from './EditableChipStrip';

interface ChipStripEditorProps {
  presets: number[];
  unit: SessionDurationUnit;
  value: number | null;
  onSelect: (value: number) => void;
  customEditing?: boolean;
  customValue?: string;
  onCustomPress: () => void;
  onCustomChangeText: (value: string) => void;
  onCustomBlur?: () => void;
  onCustomFocus?: () => void;
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
  customEditing = false,
  customValue = '',
  onCustomPress,
  onCustomChangeText,
  onCustomBlur,
  onCustomFocus,
}: ChipStripEditorProps) {
  const isCustomValue = value != null && !presets.includes(value);

  return (
    <EditableChipStrip
      options={presets.map((preset) => ({
        key: String(preset),
        label: formatValueLabel(preset, unit),
      }))}
      selectedKey={value != null ? String(value) : null}
      customActive={isCustomValue}
      customEditing={customEditing}
      customLabel={isCustomValue && value != null ? formatValueLabel(value, unit) : 'Custom...'}
      customValue={customValue}
      customUnit={unit}
      customKeyboardType={unit === 'km' ? 'decimal-pad' : 'number-pad'}
      onSelect={(key) => onSelect(Number(key))}
      onCustomPress={onCustomPress}
      onCustomChangeText={onCustomChangeText}
      onCustomBlur={onCustomBlur}
      onCustomFocus={onCustomFocus}
    />
  );
}
