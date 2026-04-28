import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import {
  disableOnboardingReplay,
  useOnboardingReplay,
} from '../../features/onboarding/onboarding-replay';

export default function OnboardingLayout() {
  const replayActive = useOnboardingReplay();

  return (
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="replay" />
        <Stack.Screen name="plan-live" />
        <Stack.Screen name="plan-builder/step-goal" />
        <Stack.Screen name="plan-builder/step-date" />
        <Stack.Screen name="plan-builder/step-target" />
        <Stack.Screen name="plan-builder/step-base-week" />
        <Stack.Screen name="plan-builder/step-template" />
        <Stack.Screen name="plan-builder/step-plan" />
      </Stack>
      {replayActive ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            disableOnboardingReplay();
            router.replace('/(tabs)/settings');
          }}
          style={styles.closeButton}
          testID="onboarding-replay-close"
        >
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 52,
    right: 18,
    zIndex: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink,
  },
});
