import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

interface CoachAnnotationCardProps {
  annotation?: string | null;
}

export function CoachAnnotationCard({ annotation }: CoachAnnotationCardProps) {
  if (!annotation) return null;

  return (
    <View style={styles.card} testID="coach-annotation">
      <Text style={styles.label}>Coach note</Text>
      <Text style={styles.annotation}>{annotation}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: C.clay,
    marginBottom: 6,
  },
  annotation: {
    fontFamily: FONTS.serif,
    fontSize: 17,
    lineHeight: 24,
    color: C.ink,
  },
});
