export type LaunchRouteDecision =
  | { type: 'loading' }
  | { type: 'welcome' }
  | { type: 'redirect'; href: '/onboarding/plan-builder/step-goal' | '/(tabs)/home' };

interface LaunchRouteInput {
  authLoading: boolean;
  planLoading: boolean;
  hasSession: boolean;
  hasPlan: boolean;
}

export function decideLaunchRoute({
  authLoading,
  planLoading,
  hasSession,
  hasPlan,
}: LaunchRouteInput): LaunchRouteDecision {
  if (authLoading || (hasSession && planLoading)) {
    return { type: 'loading' };
  }

  if (!hasSession) {
    return { type: 'welcome' };
  }

  if (!hasPlan) {
    return { type: 'redirect', href: '/onboarding/plan-builder/step-goal' };
  }

  return { type: 'redirect', href: '/(tabs)/home' };
}
