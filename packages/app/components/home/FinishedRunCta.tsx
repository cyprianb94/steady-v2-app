import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

interface FinishedRunCtaProps {
  onPress: () => void;
}

export function FinishedRunCta({ onPress }: FinishedRunCtaProps) {
  return (
    <View style={styles.wrap}>
      <Pressable onPress={onPress} style={styles.button}>
        <Text style={styles.buttonText}>✓  I just finished this run</Text>
      </Pressable>
      <Text style={styles.subcopy}>Syncs from Strava · takes a few seconds</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    marginBottom: 4,
  },
  button: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.forest,
    backgroundColor: C.forest,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  buttonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.surface,
  },
  subcopy: {
    marginTop: 6,
    textAlign: 'center',
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
});
