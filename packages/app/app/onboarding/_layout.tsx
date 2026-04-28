import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="plan-live" />
      <Stack.Screen name="plan-builder/step-goal" />
      <Stack.Screen name="plan-builder/step-date" />
      <Stack.Screen name="plan-builder/step-target" />
      <Stack.Screen name="plan-builder/step-base-week" />
      <Stack.Screen name="plan-builder/step-template" />
      <Stack.Screen name="plan-builder/step-plan" />
    </Stack>
  );
}
