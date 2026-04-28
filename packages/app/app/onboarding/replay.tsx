import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { WelcomeFrontDoor } from '../../components/onboarding/WelcomeFrontDoor';
import { enableOnboardingReplay } from '../../features/onboarding/onboarding-replay';

export default function OnboardingReplayScreen() {
  useEffect(() => {
    enableOnboardingReplay();
  }, []);

  return (
    <WelcomeFrontDoor
      onAuthenticated={() => {
        router.push('/onboarding/plan-builder/step-goal');
      }}
    />
  );
}
