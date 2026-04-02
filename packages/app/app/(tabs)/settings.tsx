import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Btn } from '../../components/ui/Btn';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useAuth } from '../../lib/auth';

export default function SettingsTab() {
  const { signInWithGoogle, signOut, session, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    try {
      setIsSubmitting(true);
      await signInWithGoogle();
    } catch (error) {
      Alert.alert('Google sign-in failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      setIsSubmitting(true);
      await signOut();
    } catch (error) {
      Alert.alert('Sign-out failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  const busy = isLoading || isSubmitting;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Authentication</Text>
        <Text style={styles.status}>
          {session?.user?.email
            ? `Signed in as ${session.user.email}`
            : isLoading
              ? 'Checking session...'
              : 'Not signed in'}
        </Text>

        {session ? (
          <>
            <Btn
              title="Build a test plan"
              onPress={() => router.push('/onboarding/plan-builder/step-goal')}
              fullWidth
              disabled={busy}
            />
            <Btn
              title="Open coach"
              onPress={() => router.push('/(tabs)/coach')}
              variant="secondary"
              fullWidth
              disabled={busy}
            />
            <Btn
              title={busy ? 'Working...' : 'Sign Out'}
              onPress={handleSignOut}
              variant="secondary"
              fullWidth
              disabled={busy}
            />
          </>
        ) : (
          <Btn
            title={busy ? 'Working...' : 'Continue with Google'}
            onPress={handleGoogleSignIn}
            fullWidth
            disabled={busy}
          />
        )}
        <Text style={styles.hint}>
          Test flow: sign in here, build a plan, then open coach to send a message against your saved data.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.sansSemiBold,
    color: C.ink,
    textAlign: 'center',
  },
  card: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  label: {
    fontSize: 12,
    fontFamily: FONTS.sansSemiBold,
    letterSpacing: 0.6,
    color: C.muted,
    textTransform: 'uppercase',
  },
  status: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FONTS.sans,
    color: C.ink2,
  },
  hint: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONTS.sans,
    color: C.muted,
  },
});
