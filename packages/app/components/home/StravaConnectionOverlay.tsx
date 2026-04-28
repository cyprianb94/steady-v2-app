import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

interface StravaConnectionOverlayProps {
  busy?: boolean;
  onConnect: () => void;
}

export function StravaConnectionOverlay({
  busy = false,
  onConnect,
}: StravaConnectionOverlayProps) {
  return (
    <View style={styles.card} testID="home-strava-overlay">
      <View style={styles.copyWrap}>
        <Text style={styles.title}>Connect Strava</Text>
        <Text style={styles.copy}>Steady needs your runs to show planned vs actual.</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onConnect}
        style={({ pressed }) => [
          styles.button,
          pressed && !busy ? styles.buttonPressed : null,
          busy ? styles.buttonDisabled : null,
        ]}
        testID="home-strava-connect"
      >
        <Text style={styles.buttonText}>{busy ? 'Connecting...' : 'Connect'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: `${C.clay}42`,
    backgroundColor: C.clayBg,
    shadowColor: C.ink,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  copyWrap: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
  },
  copy: {
    marginTop: 4,
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: C.ink2,
  },
  button: {
    flexShrink: 0,
    borderRadius: 999,
    backgroundColor: C.clay,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.surface,
  },
});
