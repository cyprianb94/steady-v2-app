import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlan } from '../../hooks/usePlan';
import { useStravaSync } from '../../hooks/useStravaSync';
import { RecoveryFlowModal } from '../../components/recovery/RecoveryFlowModal';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useAuth } from '../../lib/auth';
import { trpc } from '../../lib/trpc';
import { usePreferences } from '../../providers/preferences-context';
import { endRecovery } from './recovery-actions';

const SETTINGS_TOP_SPACING = 14;
const SETTINGS_BOTTOM_SPACING = 24;

type PillTone = 'neutral' | 'success' | 'warm';

function SectionHeading({ title, copy }: { title: string; copy?: string }) {
  return (
    <View style={styles.sectionHeading}>
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
  tone?: PillTone;
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

function OverviewRow({
  label,
  detail,
  value,
  tone = 'neutral',
  showBorder = true,
}: {
  label: string;
  detail: string;
  value: string;
  tone?: PillTone;
  showBorder?: boolean;
}) {
  return (
    <View style={[styles.overviewRow, showBorder ? styles.rowDivider : null]}>
      <View style={styles.rowCopy}>
        <Text style={styles.overviewLabel}>{label}</Text>
        <Text style={styles.overviewDetail}>{detail}</Text>
      </View>
      <MetaPill label={value} tone={tone} />
    </View>
  );
}

function SelectionRow({
  title,
  subtitle,
  selected,
  disabled,
  onPress,
  showBorder = true,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  showBorder?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.settingRow,
        showBorder ? styles.rowDivider : null,
        disabled ? styles.rowDisabled : null,
        pressed && !disabled ? styles.rowPressed : null,
      ]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, selected ? styles.rowTitleSelected : null]}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.radioOuter, selected ? styles.radioOuterSelected : null]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </Pressable>
  );
}

function ActionRow({
  title,
  subtitle,
  value,
  tone = 'neutral',
  onPress,
  disabled = false,
  showBorder = true,
}: {
  title: string;
  subtitle: string;
  value: string;
  tone?: PillTone;
  onPress?: () => void;
  disabled?: boolean;
  showBorder?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || disabled}
      style={({ pressed }) => [
        styles.settingRow,
        showBorder ? styles.rowDivider : null,
        pressed && onPress && !disabled ? styles.rowPressed : null,
        disabled ? styles.rowDisabled : null,
      ]}
    >
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <MetaPill label={value} tone={tone} />
    </Pressable>
  );
}

function formatLastSync(lastSyncedAt: string | null) {
  if (!lastSyncedAt) {
    return 'No sync recorded yet.';
  }

  return `Last sync ${new Date(lastSyncedAt).toLocaleString()}.`;
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
  const hasPlan = Boolean(plan);
  const activeInjury =
    plan?.activeInjury && plan.activeInjury.status !== 'resolved' ? plan.activeInjury : null;
  const planSummary = plan ? `${plan.raceName} · ${plan.targetTime}` : 'No active plan.';
  const weekSummary = plan ? `Week ${currentWeekIndex + 1} of ${plan.weeks.length}.` : 'No active block.';
  const stravaSummary = stravaStatus?.connected
    ? stravaStatus.lastSyncedAt
      ? `Athlete ${stravaStatus.athleteId ?? 'unknown'} · ${formatLastSync(stravaStatus.lastSyncedAt)}`
      : `Athlete ${stravaStatus.athleteId ?? 'unknown'} · Connected.`
    : 'Connect when you want activity sync.';

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
      await endRecovery({
        planId: plan.id,
        option,
        clearInjury: () => trpc.plan.clearInjury.mutate(),
        refresh,
      });
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
      testID="settings-scroll"
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
        <Text style={styles.subtitle}>Defaults, training, connections, and account.</Text>
      </View>

      <View style={styles.summaryCard} testID="settings-summary">
        <Text style={styles.summaryEyebrow}>Overview</Text>
        <View style={styles.summaryRows}>
          <OverviewRow
            label="Account"
            detail={session?.user?.email ?? 'Sign in from Account to save settings.'}
            value={session ? 'Signed in' : 'Idle'}
            tone={session ? 'success' : 'neutral'}
          />
          <OverviewRow
            label="Plan"
            detail={planSummary}
            value={hasPlan ? 'Active' : 'No plan'}
            tone={hasPlan ? 'warm' : 'neutral'}
          />
          <OverviewRow
            label="Week"
            detail={weekSummary}
            value={hasPlan ? `Week ${currentWeekIndex + 1}` : '—'}
            tone={hasPlan ? 'warm' : 'neutral'}
          />
          <OverviewRow
            label="Strava"
            detail={stravaSummary}
            value={stravaStatus?.connected ? 'Connected' : 'Offline'}
            tone={stravaStatus?.connected ? 'success' : 'neutral'}
            showBorder={false}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading
          title="Preferences"
          copy={session ? 'Choose how distance and pace display across the app.' : 'Sign in to save your display defaults.'}
        />

        {session ? (
          <View style={styles.rowCard}>
            <SelectionRow
              title="Kilometres"
              subtitle="Distance in km and pace per kilometre."
              selected={units === 'metric'}
              disabled={busy || preferencesLoading || updatingUnits}
              onPress={() => {
                void handleUnitsChange('metric');
              }}
            />
            <SelectionRow
              title="Miles"
              subtitle="Distance in miles and pace per mile."
              selected={units === 'imperial'}
              disabled={busy || preferencesLoading || updatingUnits}
              onPress={() => {
                void handleUnitsChange('imperial');
              }}
              showBorder={false}
            />
          </View>
        ) : (
          <View style={styles.rowCard}>
            <ActionRow
              title="Units"
              subtitle="Sign in before saving distance and pace defaults."
              value="Locked"
              showBorder={false}
            />
          </View>
        )}

        <Text style={styles.microCopy}>
          {updatingUnits ? 'Updating defaults…' : 'Track rep distances stay in metres for now.'}
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeading
          title="Training"
          copy={hasPlan ? 'Keep plan actions close to hand.' : 'Build a test plan to unlock week and recovery flows.'}
        />

        <View style={styles.rowCard}>
          <ActionRow
            title="Plan builder"
            subtitle={hasPlan ? 'Build a fresh test plan.' : 'Build your first test plan.'}
            value="Open"
            onPress={() => router.push('/onboarding/plan-builder/step-goal')}
          />
          <ActionRow
            title="Recovery mode"
            subtitle={
              activeInjury
                ? `${activeInjury.name} active. Choose where to resume when ready.`
                : hasPlan
                  ? 'Pause the current block and start recovery.'
                  : 'Available after you build a plan.'
            }
            value={
              !hasPlan ? 'Locked' : activeInjury ? 'Active' : planLoading || busy ? 'Working…' : 'Off'
            }
            tone={activeInjury ? 'warm' : 'neutral'}
            onPress={hasPlan ? () => setRecoveryModalMode(activeInjury ? 'resume' : 'mark') : undefined}
            disabled={!hasPlan || busy || planLoading}
            showBorder={false}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading
          title="Connections"
          copy={session ? 'Connect activity sync only when you need it.' : 'Sign in before connecting external services.'}
        />

        <View style={styles.rowCard}>
          <ActionRow
            title="Strava"
            subtitle={
              session
                ? stravaStatus?.connected
                  ? formatLastSync(stravaStatus.lastSyncedAt)
                  : 'Connect when you want runs matched back to your plan.'
                : 'Sign in before connecting activity sync.'
            }
            value={
              !session
                ? 'Locked'
                : busy
                  ? 'Working…'
                  : stravaStatus?.connected
                    ? 'Disconnect'
                    : 'Connect'
            }
            tone={session && stravaStatus?.connected ? 'success' : 'neutral'}
            onPress={
              !session
                ? undefined
                : stravaStatus?.connected
                  ? handleStravaDisconnect
                  : handleStravaConnect
            }
            disabled={!session || busy}
            showBorder={false}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading
          title="Account"
          copy={session ? 'Access is already set up on this device.' : 'Use Google to save plan, sync, and preferences.'}
        />

        {session ? (
          <Pressable
            testID="settings-sign-out"
            onPress={handleSignOut}
            disabled={busy}
            style={({ pressed }) => [
              styles.signOutRow,
              busy ? styles.rowDisabled : null,
              pressed && !busy ? styles.rowPressed : null,
            ]}
          >
            <View style={styles.rowCopy}>
              <Text style={styles.signOutTitle}>Sign out</Text>
              <Text style={styles.signOutSubtitle}>Use a clean account state for testing on this device.</Text>
            </View>
            <Text style={styles.signOutValue}>{busy ? 'Working…' : 'Remove'}</Text>
          </Pressable>
        ) : (
          <View style={styles.rowCard}>
            <ActionRow
              title="Google"
              subtitle="Sign in to save your plan, units, and sync status."
              value={busy ? 'Working…' : 'Continue'}
              onPress={handleGoogleSignIn}
              disabled={busy}
              showBorder={false}
            />
          </View>
        )}
      </View>

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
    maxWidth: 320,
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
    color: C.ink2,
  },
  summaryCard: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
  },
  summaryEyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.clay,
  },
  summaryRows: {
    gap: 0,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  overviewLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: C.muted,
  },
  overviewDetail: {
    marginTop: 4,
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.ink2,
  },
  section: {
    gap: 8,
  },
  sectionHeading: {
    paddingHorizontal: 4,
    gap: 2,
  },
  sectionTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 20,
    color: C.ink,
  },
  sectionCopy: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.muted,
  },
  rowCard: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 15,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowPressed: {
    opacity: 0.82,
  },
  rowDisabled: {
    opacity: 0.6,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  rowTitleSelected: {
    color: C.amber,
  },
  rowSubtitle: {
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
    paddingHorizontal: 4,
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: C.surface,
    borderColor: '#F1D6D0',
    borderWidth: 1,
    borderRadius: 16,
  },
  signOutTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: '#A44330',
  },
  signOutSubtitle: {
    marginTop: 4,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    color: '#B56A5A',
  },
  signOutValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: '#A44330',
  },
});
