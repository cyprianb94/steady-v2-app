import { useEffect, useState } from 'react';

const ENABLE_ONBOARDING_REPLAY_ENV = 'EXPO_PUBLIC_ENABLE_ONBOARDING_REPLAY';

let replayActive = false;
const listeners = new Set<(active: boolean) => void>();

function notifyReplayListeners() {
  listeners.forEach((listener) => listener(replayActive));
}

export function isOnboardingReplayEntryVisible(): boolean {
  return __DEV__ || process.env[ENABLE_ONBOARDING_REPLAY_ENV] === '1';
}

export function enableOnboardingReplay() {
  replayActive = true;
  notifyReplayListeners();
}

export function disableOnboardingReplay() {
  replayActive = false;
  notifyReplayListeners();
}

export function isOnboardingReplayActive(): boolean {
  return replayActive;
}

export function useOnboardingReplay(): boolean {
  const [active, setActive] = useState(replayActive);

  useEffect(() => {
    listeners.add(setActive);
    return () => {
      listeners.delete(setActive);
    };
  }, []);

  return active;
}
