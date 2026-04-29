import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

interface NotebookRowValueProps {
  value: string;
  unit?: string;
  muted?: boolean;
  color?: string;
  unitColor?: string;
}

export function NotebookRowValue({
  value,
  unit,
  muted = false,
  color,
  unitColor,
}: NotebookRowValueProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.value, muted && styles.valueMuted, color ? { color } : null]}>
        {value}
      </Text>
      {unit ? (
        <Text style={[
          styles.unit,
          muted && styles.unitMuted,
          unitColor ? { color: unitColor } : null,
        ]}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    flexWrap: 'wrap',
  },
  value: {
    fontFamily: FONTS.serifBold,
    fontSize: 30,
    lineHeight: 34,
    color: C.ink,
  },
  valueMuted: {
    color: C.muted,
  },
  unit: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    color: C.muted,
    marginBottom: 4,
  },
  unitMuted: {
    color: C.muted,
  },
});
