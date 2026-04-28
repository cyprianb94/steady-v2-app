import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { WelcomeFrontDoor } from '../components/onboarding/WelcomeFrontDoor';
import { C } from '../constants/colours';
import { decideLaunchRoute } from '../features/routing/launch-route';
import { usePlan } from '../hooks/usePlan';
import { useAuth } from '../lib/auth';

export default function Index() {
  const { session, isLoading: authLoading } = useAuth();
  const { plan, loading: planLoading } = usePlan();
  const decision = decideLaunchRoute({
    authLoading,
    planLoading,
    hasSession: Boolean(session),
    hasPlan: Boolean(plan?.weeks?.length),
  });

  if (decision.type === 'loading') {
    return (
      <View style={styles.center} testID="index-loading">
        <ActivityIndicator size="large" color={C.clay} />
      </View>
    );
  }

  if (decision.type === 'welcome') {
    return (
      <WelcomeFrontDoor
        onAuthenticated={() => {
          router.replace('/onboarding/plan-builder/step-goal');
        }}
      />
    );
  }

  return <Redirect href={decision.href} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cream,
  },
});
