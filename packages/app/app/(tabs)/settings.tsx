import { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn } from '../../components/ui/Btn';
import { usePlan } from '../../hooks/usePlan';
import { useStravaSync } from '../../hooks/useStravaSync';
import { RecoveryFlowModal } from '../../components/recovery/RecoveryFlowModal';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useAuth } from '../../lib/auth';
import { clearResumeWeekOverride, setResumeWeekOverride } from '../../lib/resume-week';
import { trpc } from '../../lib/trpc';
import { usePreferences } from '../../providers/preferences-context';

const SETTINGS_TOP_SPACING = 14;
const SETTINGS_BOTTOM_SPACING = 24;

function SectionHeading({
  label,
  title,
  copy,
}: {
  label: string;
  title: string;
  copy?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {copy ? <Text style={styles.sectionCopy}>{copy}</Text> : null}
    </View>
  );
}

function MetaPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warm';
}) {
  return (
    <View
      style={[
        styles.metaPill,
        tone === 'success' && styles.metaPillSuccess,
        tone === 'warm' && styles.metaPillWarm,
      ]}
    >
      <Text
        style={[
          styles.metaPillText,
          tone === 'success' && styles.metaPillTextSuccess,
          tone === 'warm' && styles.metaPillTextWarm,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function UnitOption({
  title,
  description,
  selected,
  disabled,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.unitOption,
        selected && styles.unitOptionSelected,
        disabled && styles.unitOptionDisabled,
        pressed && !disabled ? styles.unitOptionPressed : null,
      ]}
    >
      <View style={styles.unitOptionTopRow}>
        <Text style={[styles.unitOptionTitle, selected && styles.unitOptionTitleSelected]}>
          {title}
        </Text>
        <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
      </View>
      <Text style={styles.unitOptionDescription}>{description}</Text>
    </Pressable>
  );
}

function SettingRow({
  title,
  subtitle,
  value,
  tone = 'neutral',
  onPress,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  value: string;
  tone?: 'neutral' | 'warm' | 'success';
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || disabled}
      style={({ pressed }) => [
        styles.settingRow,
        pressed && onPress && !disabled ? styles.settingRowPressed : null,
      ]}
    >
      <View style={styles.settingRowCopy}>
        <Text style={styles.settingRowTitle}>{title}</Text>
        <Text style={styles.settingRowSubtitle}>{subtitle}</Text>
      </View>
      <MetaPill label={value} tone={tone} />
    </Pressable>
  );
}

export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signOut, session, isLoading } = useAuth();
  const { plan, loading: planLoading, currentWeekIndex, refresh } = usePlan();
  const { status: stravaStatus, refreshStatus, forceSync, syncing: stravaSyncing } = useStravaSync();
  const { units, setUnits, loading: preferencesLoading, updatingUnits } = usePreferences();
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

  async function handleStravaConnect() {
    try {
      setIsSubmitting(true);
      const config = await trpc.strava.config.query();
      if (!config.clientId) {
        throw new Error('STRAVA_CLIENT_ID is not configured on the server');
      }

      const redirectTo = Linking.createURL('strava-callback');
      const authorizeUrl = new URL('https://www.strava.com/oauth/mobile/authorize');
      authorizeUrl.searchParams.set('client_id', config.clientId);
      authorizeUrl.searchParams.set('redirect_uri', redirectTo);
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('approval_prompt', 'auto');
      authorizeUrl.searchParams.set('scope', 'activity:read_all');

      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl.toString(), redirectTo, {
        preferEphemeralSession: true,
      });

      if (result.type !== 'success') {
        return;
      }

      const { params, errorCode } = QueryParams.getQueryParams(result.url);
      if (errorCode) {
        throw new Error(errorCode);
      }

      const code = typeof params.code === 'string' ? params.code : null;
      if (!code) {
        throw new Error('Strava did not return an authorization code');
      }

      await trpc.strava.connect.mutate({ code });
      await refreshStatus();
      await forceSync();
      await refresh();
    } catch (error) {
      Alert.alert('Strava connection failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStravaDisconnect() {
    try {
      setIsSubmitting(true);
      await trpc.strava.disconnect.mutate();
      await refreshStatus();
      await refresh();
    } catch (error) {
      Alert.alert('Strava disconnect failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUnitsChange(nextUnits: 'metric' | 'imperial') {
    if (nextUnits === units || updatingUnits) return;

    try {
      await setUnits(nextUnits);
    } catch (error) {
      Alert.alert('Could not update units', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  const busy = isLoading || isSubmitting || stravaSyncing;
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

  const hasPlan = Boolean(plan);
  const heroTitle = session?.user?.email ?? 'Sign in to make Steady yours';
  const heroCopy = session
    ? plan
      ? `${plan.raceName} · ${plan.targetTime}`
      : 'No active plan yet'
    : 'Your account, plan defaults, and integrations all live here.';

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
        <Text style={styles.headerEyebrow}>MVP SETUP</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Keep the app tidy: account, units, training controls, and connections in one place.
        </Text>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Current setup</Text>
        <Text style={styles.heroTitle}>{heroTitle}</Text>
        <Text style={styles.heroCopy}>{heroCopy}</Text>
        <View style={styles.heroPills}>
          <MetaPill label={units === 'metric' ? 'Kilometres' : 'Miles'} tone="warm" />
          <MetaPill
            label={stravaStatus?.connected ? 'Strava connected' : 'Strava not connected'}
            tone={stravaStatus?.connected ? 'success' : 'neutral'}
          />
          <MetaPill
            label={hasPlan ? `Week ${currentWeekIndex + 1}` : 'No plan'}
            tone={hasPlan ? 'success' : 'neutral'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading
          label="Account"
          title={session ? 'Signed in and ready to train' : 'Start with your account'}
          copy={session
            ? 'Authentication is the gate for plan sync, Strava sync, and saved preferences.'
            : 'Sign in first so plan data, units, and integrations can persist.'}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {session?.user?.email ?? (isLoading ? 'Checking session…' : 'Not signed in')}
          </Text>
          <Text style={styles.cardCopy}>
            {session
              ? 'Use this account to build a test plan, sync activities, and keep your defaults attached to you.'
              : 'Continue with Google to unlock plan building and synced settings.'}
          </Text>

          {session ? (
            <View style={styles.buttonStack}>
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
            </View>
          ) : (
            <Btn
              title={busy ? 'Working...' : 'Continue with Google'}
              onPress={handleGoogleSignIn}
              fullWidth
              disabled={busy}
            />
          )}
        </View>
      </View>

      {session ? (
        <View style={styles.section}>
          <SectionHeading
            label="Preferences"
            title="Default units"
            copy="This changes distance and pace displays across the app, including weekly load, plan volume, and run review."
          />

          <View style={styles.card}>
            <View style={styles.unitGrid}>
              <UnitOption
                title="Kilometres"
                description="Distance in km and pace per kilometre."
                selected={units === 'metric'}
                disabled={busy || preferencesLoading || updatingUnits}
                onPress={() => {
                  void handleUnitsChange('metric');
                }}
              />
              <UnitOption
                title="Miles"
                description="Distance in miles and pace per mile."
                selected={units === 'imperial'}
                disabled={busy || preferencesLoading || updatingUnits}
                onPress={() => {
                  void handleUnitsChange('imperial');
                }}
              />
            </View>
            <Text style={styles.microCopy}>
              {updatingUnits ? 'Updating your defaults…' : 'Track rep distances stay in metres for now.'}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeading
          label="Training"
          title={hasPlan ? 'Plan controls' : 'Build your first plan'}
          copy={hasPlan
            ? 'Keep basic training controls close to hand without burying them under integrations.'
            : 'You do not need anything else before generating your first plan.'}
        />

        <View style={styles.card}>
          {plan ? (
            <>
              <Text style={styles.cardTitle}>{plan.raceName}</Text>
              <Text style={styles.cardCopy}>
                {plan.targetTime} · Week {currentWeekIndex + 1} of {plan.weeks.length}
              </Text>

              <View style={styles.rowGroup}>
                <SettingRow
                  title={activeInjury ? 'Recovery mode' : 'Recovery mode'}
                  subtitle={activeInjury
                    ? `${activeInjury.name} · week ${currentWeekIndex + 1}`
                    : 'Switch the app into recovery mode if training is interrupted.'}
                  value={activeInjury ? 'Active' : 'Off'}
                  tone={activeInjury ? 'warm' : 'neutral'}
                  onPress={() => setRecoveryModalMode(activeInjury ? 'resume' : 'mark')}
                  disabled={busy || planLoading}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>No training plan yet</Text>
              <Text style={styles.cardCopy}>
                Build one test plan so the home, block, and recovery flows have a real structure to work with.
              </Text>
              <Btn
                title="Build a test plan"
                onPress={() => router.push('/onboarding/plan-builder/step-goal')}
                fullWidth
                disabled={busy}
              />
            </>
          )}
        </View>
      </View>

      {session ? (
        <View style={styles.section}>
          <SectionHeading
            label="Connections"
            title="Activity sync"
            copy="Keep integrations separate from training defaults so the screen reads cleanly."
          />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Strava</Text>
            <Text style={styles.cardCopy}>
              {stravaStatus?.connected
                ? 'Runs sync automatically and can be matched back to your plan.'
                : 'Connect Strava when you want actual runs and planned sessions to stay aligned.'}
            </Text>

            <View style={styles.rowGroup}>
              <SettingRow
                title="Connection"
                subtitle={stravaStatus?.connected
                  ? `Athlete ${stravaStatus.athleteId ?? 'unknown'}`
                  : 'Not connected yet'}
                value={stravaStatus?.connected ? 'Connected' : 'Not connected'}
                tone={stravaStatus?.connected ? 'success' : 'neutral'}
              />
              <SettingRow
                title="Latest sync"
                subtitle={stravaStatus?.lastSyncedAt
                  ? new Date(stravaStatus.lastSyncedAt).toLocaleString()
                  : 'No sync completed yet'}
                value={stravaStatus?.lastSyncedAt ? 'Recorded' : 'Pending'}
                tone={stravaStatus?.lastSyncedAt ? 'success' : 'neutral'}
              />
            </View>

            {stravaStatus?.connected ? (
              <Btn
                title={busy ? 'Working...' : 'Disconnect Strava'}
                onPress={handleStravaDisconnect}
                variant="secondary"
                fullWidth
                disabled={busy}
              />
            ) : (
              <Pressable
                onPress={handleStravaConnect}
                disabled={busy}
                style={({ pressed }) => [
                  styles.stravaButton,
                  pressed && !busy ? styles.stravaButtonPressed : null,
                  busy ? styles.stravaButtonDisabled : null,
                ]}
              >
                <Text style={styles.stravaButtonText}>
                  {busy ? 'Working...' : 'Connect with Strava'}
                </Text>
              </Pressable>
            )}
          </View>
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
    gap: 22,
  },
  header: {
    paddingHorizontal: 4,
    gap: 4,
  },
  headerEyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.muted,
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.serifBold,
    color: C.ink,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONTS.sans,
    color: C.ink2,
    maxWidth: 320,
  },
  heroCard: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  heroEyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.clay,
  },
  heroTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 21,
    lineHeight: 28,
    color: C.ink,
  },
  heroCopy: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 21,
    color: C.ink2,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  section: {
    gap: 10,
  },
  sectionHeading: {
    paddingHorizontal: 4,
    gap: 2,
  },
  sectionLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: C.muted,
  },
  sectionTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 19,
    color: C.ink,
  },
  sectionCopy: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
    color: C.muted,
  },
  card: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  cardTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: C.ink,
  },
  cardCopy: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 21,
    color: C.ink2,
  },
  buttonStack: {
    gap: 10,
  },
  rowGroup: {
    gap: 0,
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  settingRowPressed: {
    opacity: 0.85,
  },
  settingRowCopy: {
    flex: 1,
  },
  settingRowTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  settingRowSubtitle: {
    marginTop: 4,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.muted,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.border,
  },
  metaPillSuccess: {
    backgroundColor: C.forestBg,
    borderColor: `${C.forest}20`,
  },
  metaPillWarm: {
    backgroundColor: C.amberBg,
    borderColor: `${C.amber}30`,
  },
  metaPillText: {
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    color: C.ink2,
  },
  metaPillTextSuccess: {
    color: C.forest,
  },
  metaPillTextWarm: {
    color: C.amber,
  },
  unitGrid: {
    gap: 10,
  },
  unitOption: {
    backgroundColor: C.cream,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  unitOptionSelected: {
    backgroundColor: C.amberBg,
    borderColor: `${C.amber}50`,
  },
  unitOptionDisabled: {
    opacity: 0.65,
  },
  unitOptionPressed: {
    opacity: 0.88,
  },
  unitOptionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  unitOptionTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: C.ink,
  },
  unitOptionTitleSelected: {
    color: C.amber,
  },
  unitOptionDescription: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.muted,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  radioOuterSelected: {
    borderColor: C.amber,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: C.amber,
  },
  microCopy: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
  },
  stravaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#FC4C02',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  stravaButtonPressed: {
    opacity: 0.9,
  },
  stravaButtonDisabled: {
    opacity: 0.6,
  },
  stravaButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: C.surface,
  },
});
