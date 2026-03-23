import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

interface SectionLabelProps {
  children: string;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 12,
  },
});
