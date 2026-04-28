import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  deriveTrainingPaceProfile,
  normalizeTrainingPaceProfile,
  type PhaseName,
  type TrainingPlan,
  type TrainingPaceProfile,
  type WeeklyVolumeMetric,
} from '@steady/types';
import { usePlan } from '../../hooks/usePlan';
import { useStravaSync } from '../../hooks/useStravaSync';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { PHASE_COLOR } from '../../constants/phase-meta';
import { useAuth } from '../../lib/auth';
import { getStravaOAuthRedirects } from '../../lib/strava-auth';
import { trpc } from '../../lib/trpc';
import { usePreferences, type Units } from '../../providers/preferences-context';
import { trainingPaceProfileSummary } from '../../components/pace-profile/TrainingPaceProfileEditor';

const SETTINGS_TOP_SPACING = 18;
const SETTINGS_BOTTOM_SPACING = 24;
const PHASE_ORDER: PhaseName[] = ['BASE', 'BUILD', 'RECOVERY', 'PEAK', 'TAPER'];
const FEEDBACK_EMAIL = 'cyprianbrytan@gmail.com';
const STRAVA_WEB_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_MOBILE_AUTHORIZE_URL = 'https://www.strava.com/oauth/mobile/authorize';

type RowTone = 'default' | 'danger';

interface SettingsRowProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: RowTone;
  showBorder?: boolean;
  testID?: string;
}

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function Chevron() {
  return <Text style={styles.chevron}>›</Text>;
}

function SettingsRow({
  title,
  subtitle,
  onPress,
  disabled = false,
  tone = 'default',
  showBorder = true,
  testID,
}: SettingsRowProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress || disabled}
      style={({ pressed }) => [
        styles.settingsRow,
        showBorder ? styles.rowDivider : null,
        disabled ? styles.rowDisabled : null,
        pressed && onPress && !disabled ? styles.rowPressed : null,
      ]}
    >
      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowTitle, tone === 'danger' ? styles.rowTitleDanger : null]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Chevron />
    </Pressable>
  );
}

function StatusText({ label, connected }: { label: string; connected: boolean }) {
  return (
    <View style={styles.statusLine}>
      <View style={[styles.statusDot, connected ? styles.statusDotConnected : styles.statusDotIdle]} />
      <Text style={[styles.statusText, connected ? styles.statusTextConnected : styles.statusTextIdle]}>
        {label}
      </Text>
    </View>
  );
}

function getStravaAuthorizeUrl(authSessionCallbackUri: string) {
  try {
    return new URL(authSessionCallbackUri).protocol === 'exp:'
      ? STRAVA_WEB_AUTHORIZE_URL
      : STRAVA_MOBILE_AUTHORIZE_URL;
  } catch {
    return authSessionCallbackUri.startsWith('exp://')
      ? STRAVA_WEB_AUTHORIZE_URL
      : STRAVA_MOBILE_AUTHORIZE_URL;
  }
}

function formatPhaseName(phase: PhaseName | undefined) {
  if (!phase) return 'Block active';
  return `${phase.slice(0, 1)}${phase.slice(1).toLowerCase()} phase`;
}

function getSafeWeekIndex(plan: TrainingPlan | null | undefined, currentWeekIndex: number) {
  const weekCount = plan?.weeks?.length ?? 0;
  if (weekCount <= 0) return 0;
  return Math.min(Math.max(currentWeekIndex, 0), weekCount - 1);
}

function getPhaseSegments(plan: TrainingPlan | null | undefined) {
  if (!plan) return [];

  const configuredPhases = plan.phases
    ? PHASE_ORDER.map((phase) => ({ phase, count: plan.phases[phase] ?? 0 }))
    : [];
  const hasConfiguredPhases = configuredPhases.some((segment) => segment.count > 0);

  const segments = hasConfiguredPhases
    ? configuredPhases
    : PHASE_ORDER.map((phase) => ({
        phase,
        count: plan.weeks?.filter((week) => week?.phase === phase).length ?? 0,
      }));

  return segments.filter((segment) => segment.count > 0);
}

function getPlanTrainingPaceProfile(
  plan: TrainingPlan | null | undefined,
): TrainingPaceProfile | null {
  if (!plan) {
    return null;
  }

  return normalizeTrainingPaceProfile(plan.trainingPaceProfile)
    ?? deriveTrainingPaceProfile({
      raceDistance: plan.raceDistance,
      targetTime: plan.targetTime,
    });
}

function LastSyncText({ lastSyncedAt }: { lastSyncedAt: string | null | undefined }) {
  if (!lastSyncedAt) {
    return <Text style={styles.syncMeta}>No sync recorded yet.</Text>;
  }

  const syncedAt = new Date(lastSyncedAt);
  if (Number.isNaN(syncedAt.getTime())) {
    return <Text style={styles.syncMeta}>Last sync recorded.</Text>;
  }

  const today = new Date();
  const dateLabel = syncedAt.toDateString() === today.toDateString()
    ? 'today'
    : syncedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timeLabel = syncedAt.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Text style={styles.syncMeta}>
      Last synced {dateLabel} at <Text style={styles.monoInline}>{timeLabel}</Text>.
    </Text>
  );
}

function PlanCard({
  plan,
  currentWeekIndex,
  onOpenPlanBuilder,
}: {
  plan: TrainingPlan | null | undefined;
  currentWeekIndex: number;
  onOpenPlanBuilder: () => void;
}) {
  const hasPlan = Boolean(plan);
  const safeWeekIndex = getSafeWeekIndex(plan, currentWeekIndex);
  const currentWeek = plan?.weeks?.[safeWeekIndex];
  const currentWeekNumber = currentWeek?.weekNumber ?? safeWeekIndex + 1;
  const weekCount = plan?.weeks?.length ?? 0;
  const phaseSegments = getPhaseSegments(plan);
  const trainingPaceProfile = getPlanTrainingPaceProfile(plan);

  return (
    <View style={styles.card}>
      <View style={styles.planHead}>
        <View style={styles.planKicker}>
          <StatusText label={hasPlan ? 'Active' : 'No plan'} connected={hasPlan} />
          <Text style={styles.phaseName}>{hasPlan ? formatPhaseName(currentWeek?.phase) : 'Build a plan'}</Text>
        </View>

        <Text style={styles.planTitle}>{plan?.raceName ?? 'No active plan'}</Text>

        {hasPlan ? (
          <>
            <View style={styles.planMeta}>
              <Text style={styles.metaText}>
                Target <Text style={[styles.monoInline, styles.targetValue]}>{plan?.targetTime}</Text>
              </Text>
              <Text style={styles.metaText}>
                Week <Text style={[styles.monoInline, styles.weekValue]}>{currentWeekNumber}</Text> of{' '}
                <Text style={styles.monoInline}>{weekCount}</Text>
              </Text>
            </View>

            {phaseSegments.length > 0 ? (
              <View style={styles.phaseStrip} testID="settings-phase-strip">
                {phaseSegments.map((segment) => (
                  <View
                    key={segment.phase}
                    style={[
                      styles.phaseSegment,
                      {
                        flex: segment.count,
                        backgroundColor: PHASE_COLOR[segment.phase],
                      },
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.emptyPlanCopy}>Build a plan to see your current block here.</Text>
        )}
      </View>

      {hasPlan && trainingPaceProfile ? (
        <SettingsRow
          testID="settings-training-paces"
          title="Training paces"
          subtitle={trainingPaceProfileSummary(trainingPaceProfile)}
          onPress={() => router.push('/settings/training-paces')}
        />
      ) : null}

      <SettingsRow
        title={hasPlan ? 'Replace plan' : 'Build plan'}
        onPress={onOpenPlanBuilder}
      />
    </View>
  );
}

function UnitSegment({
  title,
  caption,
  selected,
  disabled,
  onPress,
}: {
  title: string;
  caption: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.unitSegment,
        selected ? styles.unitSegmentSelected : null,
        disabled ? styles.rowDisabled : null,
        pressed && !disabled ? styles.rowPressed : null,
      ]}
    >
      <View style={styles.unitTitleLine}>
        <Text style={styles.unitTitle}>{title}</Text>
        <View style={[styles.radio, selected ? styles.radioSelected : null]}>
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
      </View>
      <Text style={styles.unitCaption}>{caption}</Text>
    </Pressable>
  );
}

export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signOut, session, isLoading } = useAuth();
  const { plan, loading: planLoading, currentWeekIndex, refresh } = usePlan();
  const { status: stravaStatus, refreshStatus, forceSync, syncing: stravaSyncing } = useStravaSync();
  const {
    units,
    setUnits,
    weeklyVolumeMetric,
    setWeeklyVolumeMetric,
    loading: preferencesLoading,
    updatingUnits,
    updatingWeeklyVolumeMetric,
  } = usePreferences();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const busy = isLoading || isSubmitting || stravaSyncing;
  const preferenceBusy = busy || preferencesLoading || updatingUnits || updatingWeeklyVolumeMetric;
  const stravaConnected = Boolean(session && stravaStatus?.connected);

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

  async function performSignOut() {
    try {
      setIsSubmitting(true);
      await signOut();
    } catch (error) {
      Alert.alert('Sign-out failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', 'This removes the account from this device. You can sign back in with Google.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void performSignOut();
        },
      },
    ]);
  }

  async function handleStravaConnect() {
    try {
      setIsSubmitting(true);
      const config = await trpc.strava.config.query();
      if (!config.clientId) {
        throw new Error('STRAVA_CLIENT_ID is not configured on the server');
      }

      const {
        authorizationRedirectUri,
        authSessionCallbackUri,
      } = getStravaOAuthRedirects();
      const authorizeUrl = new URL(getStravaAuthorizeUrl(authSessionCallbackUri));
      authorizeUrl.searchParams.set('client_id', config.clientId);
      authorizeUrl.searchParams.set('redirect_uri', authorizationRedirectUri);
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('approval_prompt', 'auto');
      authorizeUrl.searchParams.set('scope', 'read,activity:read_all');

      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl.toString(), authSessionCallbackUri, {
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

  async function handleStravaSyncNow() {
    try {
      setIsSubmitting(true);
      await forceSync();
      await refreshStatus();
      await refresh();
    } catch (error) {
      Alert.alert('Strava sync failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function performStravaDisconnect() {
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

  function confirmStravaDisconnect() {
    Alert.alert('Disconnect Strava?', 'New runs will stop syncing until you reconnect.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => {
          void performStravaDisconnect();
        },
      },
    ]);
  }

  async function handleUnitsChange(nextUnits: Units) {
    if (nextUnits === units || preferenceBusy) return;

    try {
      await setUnits(nextUnits);
    } catch (error) {
      Alert.alert('Could not update units', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async function handleWeeklyVolumeMetricChange(nextMetric: WeeklyVolumeMetric) {
    if (nextMetric === weeklyVolumeMetric || preferenceBusy) return;

    try {
      await setWeeklyVolumeMetric(nextMetric);
    } catch (error) {
      Alert.alert('Could not update weekly volume', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  function openPlanBuilder() {
    if (!plan) {
      router.push('/onboarding/plan-builder/step-goal');
      return;
    }

    Alert.alert('Replace plan?', 'You will build a new plan before anything changes.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        onPress: () => {
          router.push('/onboarding/plan-builder/step-goal');
        },
      },
    ]);
  }

  async function handleSendFeedback() {
    const subject = encodeURIComponent('Steady feedback');
    const body = encodeURIComponent(session?.user?.email ? `Account: ${session.user.email}\n\n` : '');

    try {
      await Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`);
    } catch {
      Alert.alert('Could not open email', `Send feedback to ${FEEDBACK_EMAIL}.`);
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
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <SectionLabel title="Plan" />
        <PlanCard plan={plan} currentWeekIndex={currentWeekIndex} onOpenPlanBuilder={openPlanBuilder} />
      </View>

      <View style={styles.section}>
        <SectionLabel title="Activity sync" />
        <View style={styles.card}>
          <View style={styles.syncHead}>
            <View style={styles.syncTitleLine}>
              <Text style={styles.syncName}>Strava</Text>
              <StatusText
                label={stravaConnected ? 'Connected' : 'Not connected'}
                connected={stravaConnected}
              />
            </View>
            <LastSyncText lastSyncedAt={stravaConnected ? stravaStatus?.lastSyncedAt : null} />
          </View>

          <SettingsRow
            title={!session ? 'Sign in to connect' : stravaConnected ? 'Sync now' : 'Connect Strava'}
            onPress={!session ? handleGoogleSignIn : stravaConnected ? handleStravaSyncNow : handleStravaConnect}
            disabled={busy || planLoading}
          />

          {stravaConnected ? (
            <SettingsRow
              title="Disconnect Strava"
              onPress={confirmStravaDisconnect}
              disabled={busy}
              tone="danger"
              showBorder={false}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel title="Units" />
        <View style={styles.unitCard}>
          <UnitSegment
            title="Kilometres"
            caption="Pace as /km."
            selected={units === 'metric'}
            disabled={preferenceBusy}
            onPress={() => {
              void handleUnitsChange('metric');
            }}
          />
          <UnitSegment
            title="Miles"
            caption="Pace as /mi."
            selected={units === 'imperial'}
            disabled={preferenceBusy}
            onPress={() => {
              void handleUnitsChange('imperial');
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel title="Weekly volume" />
        <View style={styles.unitCard}>
          <UnitSegment
            title="Mileage"
            caption="Distance on Home."
            selected={weeklyVolumeMetric === 'distance'}
            disabled={preferenceBusy}
            onPress={() => {
              void handleWeeklyVolumeMetricChange('distance');
            }}
          />
          <UnitSegment
            title="Time on feet"
            caption="Duration on Home."
            selected={weeklyVolumeMetric === 'time'}
            disabled={preferenceBusy}
            onPress={() => {
              void handleWeeklyVolumeMetricChange('time');
            }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionLabel title="Account" />
        <View style={styles.card}>
          {session ? (
            <>
              <View style={styles.accountEmail}>
                <Text style={styles.emailLabel}>Signed in as</Text>
                <Text style={styles.emailValue}>{session.user.email}</Text>
              </View>
              <SettingsRow
                testID="settings-sign-out"
                title="Sign out"
                onPress={confirmSignOut}
                disabled={busy}
                tone="danger"
              />
            </>
          ) : (
            <SettingsRow
              title="Sign in with Google"
              onPress={handleGoogleSignIn}
              disabled={busy}
            />
          )}

          <SettingsRow
            title="Send feedback"
            onPress={() => {
              void handleSendFeedback();
            }}
            showBorder={Boolean(session)}
          />
        </View>
      </View>
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
    gap: 14,
  },
  header: {
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 26,
    lineHeight: 30,
    fontFamily: FONTS.serifBold,
    fontWeight: '600',
    color: C.ink,
  },
  section: {
    gap: 7,
  },
  sectionLabel: {
    paddingHorizontal: 2,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
    color: C.muted,
  },
  card: {
    overflow: 'hidden',
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  planHead: {
    padding: 12,
  },
  planKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 7,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  statusDotConnected: {
    backgroundColor: C.forest,
  },
  statusDotIdle: {
    backgroundColor: C.muted,
  },
  statusText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
  },
  statusTextConnected: {
    color: C.forest,
  },
  statusTextIdle: {
    color: C.muted,
  },
  phaseName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
    color: C.muted,
  },
  planTitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 18,
    lineHeight: 22,
    color: C.ink,
  },
  planMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  metaText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 16,
    color: C.muted,
  },
  monoInline: {
    fontFamily: FONTS.monoBold,
    letterSpacing: 0,
    color: C.ink2,
  },
  targetValue: {
    color: C.navy,
  },
  weekValue: {
    color: C.clay,
  },
  phaseStrip: {
    flexDirection: 'row',
    height: 8,
    marginTop: 10,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: C.border,
  },
  phaseSegment: {
    minWidth: 2,
  },
  emptyPlanCopy: {
    marginTop: 7,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.muted,
  },
  settingsRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  rowPressed: {
    opacity: 0.82,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowTitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    lineHeight: 18,
    color: C.ink,
  },
  rowTextWrap: {
    flex: 1,
    gap: 2,
  },
  rowSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
    color: C.muted,
  },
  rowTitleDanger: {
    color: C.clay,
  },
  chevron: {
    width: 22,
    fontFamily: FONTS.sansMedium,
    fontSize: 22,
    lineHeight: 22,
    textAlign: 'center',
    color: C.muted,
  },
  syncHead: {
    padding: 12,
  },
  syncTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  syncName: {
    fontFamily: FONTS.sansMedium,
    fontSize: 16,
    lineHeight: 20,
    color: C.ink,
  },
  syncMeta: {
    marginTop: 7,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.muted,
  },
  unitCard: {
    flexDirection: 'row',
    gap: 5,
    padding: 5,
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  unitSegment: {
    flex: 1,
    minHeight: 60,
    padding: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  unitSegmentSelected: {
    borderColor: 'rgba(28, 21, 16, 0.22)',
    backgroundColor: C.card,
  },
  unitTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  unitTitle: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    lineHeight: 17,
    color: C.ink,
  },
  radio: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  radioSelected: {
    borderColor: C.ink2,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: C.ink2,
  },
  unitCaption: {
    marginTop: 6,
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
    color: C.muted,
  },
  accountEmail: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emailLabel: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 14,
    color: C.muted,
  },
  emailValue: {
    marginTop: 5,
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    lineHeight: 18,
    color: C.ink,
  },
});
