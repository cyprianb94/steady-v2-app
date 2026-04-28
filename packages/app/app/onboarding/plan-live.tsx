import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PlannedSession, TrainingPlanWithAnnotation } from '@steady/types';
import { Btn } from '../../components/ui/Btn';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { connectStravaAndRefresh } from '../../features/strava/strava-connection';
import { usePlan } from '../../hooks/usePlan';
import { useStravaSync } from '../../hooks/useStravaSync';

function titleCasePhase(value: string | undefined): string {
  if (!value) return 'Base';
  return `${value.slice(0, 1)}${value.slice(1).toLowerCase()}`;
}

function sessionTypeLabel(value: string | undefined): string {
  if (!value) return 'session';
  if (value === 'EASY') return 'easy';
  if (value === 'LONG') return 'long run';
  if (value === 'TEMPO') return 'tempo';
  if (value === 'INTERVAL') return 'intervals';
  return value.toLowerCase();
}

function firstRunnableSession(plan: TrainingPlanWithAnnotation | null): PlannedSession | null {
  const firstWeek = plan?.weeks?.[0];
  if (!firstWeek) return null;
  return firstWeek.sessions.find(
    (session): session is PlannedSession => Boolean(session && session.type !== 'REST'),
  ) ?? null;
}

function firstSessionLabel(session: PlannedSession | null): string {
  if (!session) return 'First easy run is ready';
  if (session.type === 'INTERVAL') {
    const repDistance = session.repDist ? `${session.repDist}m` : 'reps';
    return `${session.reps ?? 6}x${repDistance} intervals at ${session.pace ?? 'planned pace'}/km`;
  }

  const distance = 'distance' in session && typeof session.distance === 'number'
    ? `${session.distance}km `
    : '';
  const pace = 'pace' in session && session.pace ? ` at ${session.pace}/km` : '';
  return `${distance}${sessionTypeLabel(session.type)}${pace}`;
}

function PlanSummary({ plan }: { plan: TrainingPlanWithAnnotation | null }) {
  const firstWeek = plan?.weeks?.[0] ?? null;
  const firstSession = firstRunnableSession(plan);
  const weekCount = plan?.weeks?.length ?? 0;
  const firstWeekKm = Math.round(firstWeek?.plannedKm ?? 0);

  return (
    <View style={styles.liveCard}>
      <View style={styles.liveHead}>
        <View>
          <Text style={styles.sectionLabel}>Active block</Text>
          <Text style={styles.liveTitle}>{plan?.raceName ?? 'Training block'}</Text>
        </View>
        <Text style={styles.weeksValue}>{weekCount || 0}w</Text>
      </View>

      <View style={styles.statGrid}>
        <View style={styles.stat}>
          <Text style={styles.miniLabel}>Target</Text>
          <Text style={styles.statValue}>{plan?.targetTime || '-'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.miniLabel}>Week 1</Text>
          <Text style={styles.statValue}>{firstWeekKm}km</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.miniLabel}>Phase</Text>
          <Text style={styles.statValue}>{titleCasePhase(firstWeek?.phase)}</Text>
        </View>
      </View>

      <View style={styles.firstSession}>
        <Text style={styles.miniLabel}>First session</Text>
        <Text style={styles.firstSessionTitle}>{firstSessionLabel(firstSession)}</Text>
        <Text style={styles.firstSessionCopy}>
          Keep this one genuinely easy. The point is getting the block started cleanly.
        </Text>
      </View>
    </View>
  );
}

export default function PlanLiveScreen() {
  const insets = useSafeAreaInsets();
  const { plan, loading, refresh } = usePlan();
  const { refreshStatus, forceSync, syncing } = useStravaSync();
  const [connecting, setConnecting] = useState(false);
  const busy = connecting || syncing;
  const contentPadding = useMemo(
    () => ({
      paddingTop: insets.top + 28,
      paddingBottom: insets.bottom + 24,
    }),
    [insets.bottom, insets.top],
  );

  async function handleConnectStrava() {
    try {
      setConnecting(true);
      const connected = await connectStravaAndRefresh({
        refreshStatus,
        forceSync,
        refreshPlan: refresh,
      });
      if (connected) {
        router.replace('/(tabs)/home');
      }
    } catch (error) {
      Alert.alert('Strava connection failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setConnecting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center} testID="plan-live-loading">
        <ActivityIndicator size="large" color={C.clay} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, contentPadding]}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <View style={styles.successMark}>
          <Text style={styles.successMarkText}>✓</Text>
        </View>
        <Text style={styles.title}>Plan is live.</Text>
        <Text style={styles.copy}>
          Your block is saved. Connect Strava next so Steady can pull your completed runs into the plan.
        </Text>
      </View>

      <PlanSummary plan={plan} />

      <View style={styles.connectCard}>
        <View style={styles.connectCopyWrap}>
          <Text style={styles.connectTitle}>Connect Strava</Text>
          <Text style={styles.connectCopy}>
            Without this, Steady cannot compare planned vs actual automatically.
          </Text>
        </View>
        <View style={styles.importantPill}>
          <Text style={styles.importantText}>Important</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Btn
          title={busy ? 'Connecting...' : 'Connect Strava'}
          fullWidth
          disabled={busy}
          onPress={() => {
            void handleConnectStrava();
          }}
          testID="plan-live-connect-strava"
        />
        <Btn
          title="Go to Home"
          variant="secondary"
          fullWidth
          disabled={busy}
          onPress={() => router.replace('/(tabs)/home')}
          testID="plan-live-home"
        />
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
    flexGrow: 1,
    paddingHorizontal: 18,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cream,
  },
  successMark: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.forest,
  },
  successMarkText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 27,
    color: C.surface,
  },
  title: {
    marginTop: 16,
    fontFamily: FONTS.serifBold,
    fontSize: 32,
    lineHeight: 35,
    color: C.ink,
  },
  copy: {
    maxWidth: 330,
    marginTop: 9,
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 21,
    color: C.ink2,
  },
  liveCard: {
    marginTop: 24,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  liveHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  sectionLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
    color: C.muted,
  },
  liveTitle: {
    marginTop: 5,
    fontFamily: FONTS.serifBold,
    fontSize: 21,
    color: C.ink,
  },
  weeksValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 14,
    color: C.ink,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    minHeight: 72,
    borderRadius: 10,
    backgroundColor: C.card,
    padding: 10,
  },
  miniLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.35,
    textTransform: 'uppercase',
    color: C.muted,
  },
  statValue: {
    marginTop: 8,
    fontFamily: FONTS.monoBold,
    fontSize: 16,
    color: C.ink,
  },
  firstSession: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: `${C.forest}3D`,
    borderRadius: 12,
    backgroundColor: C.forestBg,
  },
  firstSessionTitle: {
    marginTop: 7,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  firstSessionCopy: {
    marginTop: 4,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: C.ink2,
  },
  connectCard: {
    marginTop: 10,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: `${C.clay}3D`,
    backgroundColor: C.clayBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  connectCopyWrap: {
    flex: 1,
  },
  connectTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
  },
  connectCopy: {
    marginTop: 3,
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
    color: C.ink2,
  },
  importantPill: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: C.clay,
  },
  importantText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.surface,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 20,
    gap: 10,
  },
});
