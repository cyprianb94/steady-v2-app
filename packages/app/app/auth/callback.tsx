import { Redirect } from 'expo-router';

export default function AuthCallback() {
  // Session extraction happens in AuthProvider via Linking.useLinkingURL().
  // This route just needs to exist so Expo Router doesn't show "Unmatched Route".
  return <Redirect href="/(tabs)/home" />;
}
