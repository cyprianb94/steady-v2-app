import React from 'react';
import { Pressable, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

type BtnVariant = 'primary' | 'secondary' | 'destructive';

interface BtnProps {
  title: string;
  onPress: () => void;
  variant?: BtnVariant;
  fullWidth?: boolean;
  disabled?: boolean;
}

const VARIANT_STYLES: Record<BtnVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: C.clay, borderColor: C.clay },
    text: { color: '#FFFFFF' },
  },
  secondary: {
    container: { backgroundColor: C.surface, borderColor: C.border },
    text: { color: C.ink },
  },
  destructive: {
    container: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
    text: { color: '#991B1B' },
  },
};

export function Btn({ title, onPress, variant = 'primary', fullWidth = false, disabled = false }: BtnProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        v.container,
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.text, v.text]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
