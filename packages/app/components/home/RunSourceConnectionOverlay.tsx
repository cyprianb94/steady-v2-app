import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';

interface RunSourceConnectionOverlayProps {
  stravaBusy?: boolean;
  appleHealthBusy?: boolean;
  showAppleHealth?: boolean;
  onConnectStrava: () => void;
  onConnectAppleHealth: () => void;
}

interface SourceButtonProps {
  busy: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}

function SourceButton({
  busy,
  disabled,
  label,
  onPress,
  testID,
}: SourceButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
      testID={testID}
    >
      <Text style={styles.buttonText}>{busy ? 'Connecting...' : label}</Text>
    </Pressable>
  );
}

export function RunSourceConnectionOverlay({
  stravaBusy = false,
  appleHealthBusy = false,
  showAppleHealth = true,
  onConnectStrava,
  onConnectAppleHealth,
}: RunSourceConnectionOverlayProps) {
  const anyBusy = stravaBusy || appleHealthBusy;

  return (
    <View style={styles.card} testID="home-run-source-overlay">
      <View style={styles.copyWrap}>
        <Text style={styles.title}>Connect a run source</Text>
        <Text style={styles.copy}>
          {showAppleHealth
            ? 'Use Strava or Apple Health so Steady can compare planned vs actual.'
            : 'Use Strava so Steady can compare planned vs actual.'}
        </Text>
      </View>
      <View style={styles.actions}>
        <SourceButton
          busy={stravaBusy}
          disabled={anyBusy}
          label="Strava"
          onPress={onConnectStrava}
          testID="home-connect-strava"
        />
        {showAppleHealth ? (
          <SourceButton
            busy={appleHealthBusy}
            disabled={anyBusy}
            label="Apple Health"
            onPress={onConnectAppleHealth}
            testID="home-connect-apple-health"
          />
        ) : null}
      </View>
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
    gap: 10,
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
    gap: 4,
  },
  title: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
  },
  copy: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: C.ink2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: C.clay,
    paddingHorizontal: 10,
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
    textAlign: 'center',
  },
});
