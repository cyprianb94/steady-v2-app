import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

interface RepStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export function RepStepper({ value, min = 1, max = 20, onChange }: RepStepperProps) {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        style={styles.button}
        disabled={value <= min}
      >
        <Text style={[styles.buttonText, value <= min && styles.disabled]}>−</Text>
      </Pressable>
      <View style={styles.valueContainer}>
        <Text style={styles.value}>{value}</Text>
      </View>
      <Pressable
        onPress={() => onChange(Math.min(max, value + 1))}
        style={styles.button}
        disabled={value >= max}
      >
        <Text style={[styles.buttonText, value >= max && styles.disabled]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cream,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 22,
    color: C.ink,
  },
  valueContainer: {
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: FONTS.monoBold,
    fontSize: 18,
    color: C.ink,
  },
  disabled: {
    opacity: 0.3,
  },
});
