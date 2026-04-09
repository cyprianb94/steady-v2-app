import { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn } from '../../components/ui/Btn';
import { usePlan } from '../../hooks/usePlan';
import { RecoveryFlowModal } from '../../components/recovery/RecoveryFlowModal';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useAuth } from '../../lib/auth';
import { clearResumeWeekOverride, setResumeWeekOverride } from '../../lib/resume-week';
import { trpc } from '../../lib/trpc';

const SETTINGS_TOP_SPACING = 14;
const SETTINGS_BOTTOM_SPACING = 24;

export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signOut, session, isLoading } = useAuth();
  const { plan, loading: planLoading, currentWeekIndex, refresh } = usePlan();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryModalMode, setRecoveryModalMode] = useState<'mark' | 'resume' | null>(null);

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
  const activeInjury =
    plan?.activeInjury && plan.activeInjury.status !== 'resolved' ? plan.activeInjury : null;

  async function handleMarkInjury(name: string) {
    try {
      setIsSubmitting(true);
      await trpc.plan.markInjury.mutate({ name });
      await refresh();
      setRecoveryModalMode(null);
      router.push('/(tabs)/home');
    } catch (error) {
      Alert.alert('Could not start recovery', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEndRecovery(option: { type: 'current' } | { type: 'choose'; weekNumber: number }) {
    if (!plan) return;

    try {
      setIsSubmitting(true);

      if (option.type === 'current') {
        await clearResumeWeekOverride(plan.id);
      } else {
        await setResumeWeekOverride(plan.id, option.weekNumber);
      }

      await trpc.plan.clearInjury.mutate();
      await refresh();
      setRecoveryModalMode(null);
      router.push('/(tabs)/home');
    } catch (error) {
      Alert.alert('Could not end recovery', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + SETTINGS_TOP_SPACING,
          paddingBottom: insets.bottom + SETTINGS_BOTTOM_SPACING,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
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
          Test flow: sign in here, then build a plan to start training.
        </Text>
      </View>

      {session && plan ? (
        <View style={styles.card}>
          <Text style={styles.label}>Plan</Text>
          <Text style={styles.status}>
            {plan.raceName} · {plan.targetTime}
          </Text>

          <Pressable
            onPress={() => setRecoveryModalMode(activeInjury ? 'resume' : 'mark')}
            style={styles.row}
            disabled={busy || planLoading}
          >
            <View>
              <Text style={styles.rowTitle}>{activeInjury ? 'End Recovery' : 'Mark Injury'}</Text>
              <Text style={styles.rowSub}>
                {activeInjury
                  ? `${activeInjury.name} · Week ${currentWeekIndex + 1}`
                  : 'Switch the app into recovery mode'}
              </Text>
            </View>
            <Text style={styles.rowValue}>{activeInjury ? 'Active' : 'Off'}</Text>
          </Pressable>
        </View>
      ) : null}

      {plan ? (
        <RecoveryFlowModal
          visible={recoveryModalMode !== null}
          mode={recoveryModalMode ?? 'mark'}
          plan={plan}
          currentWeekNumber={plan.weeks[currentWeekIndex]?.weekNumber ?? 1}
          injury={activeInjury}
          busy={busy}
          onClose={() => setRecoveryModalMode(null)}
          onMarkInjury={handleMarkInjury}
          onEndRecovery={handleEndRecovery}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  content: {
    paddingHorizontal: 18,
    gap: 16,
  },
  header: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.serifBold,
    color: C.ink,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 14,
    marginTop: 2,
  },
  rowTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  rowSub: {
    marginTop: 3,
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
  },
  rowValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: C.clay,
  },
});
