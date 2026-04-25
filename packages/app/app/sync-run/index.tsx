import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Activity, PlannedSession } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useAuth } from '../../lib/auth';
import { trpc } from '../../lib/trpc';
import { usePlan } from '../../hooks/usePlan';
import { useStravaSync } from '../../hooks/useStravaSync';
import { activityLocalDate, addDaysIso, findSessionForDateOrWeekday, startOfWeekIso, todayIsoLocal } from '../../lib/plan-helpers';
import { buildCurrentDisplayWeek } from '../../features/run/display-week';
import { usePreferences } from '../../providers/preferences-context';
import { formatDistance, formatPace, formatSessionTitle } from '../../lib/units';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatActivityTime(startTime: string, today: string): string {
  const value = new Date(startTime);
  const datePart = activityLocalDate(startTime);
  const time = value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (datePart === today) return time;
  const label = value.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${label}, ${time}`;
}

function activityTitle(activity: Activity): string {
  if (activity.name) return activity.name;
  const hour = new Date(activity.startTime).getHours();
  if (hour < 10) return 'Morning Run';
  if (hour < 14) return 'Lunchtime Run';
  if (hour < 18) return 'Afternoon Run';
  return 'Evening Run';
}

function isRunnableSession(session: PlannedSession | null): session is PlannedSession {
  return session != null && session.type !== 'REST';
}

function firstRouteParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Returns up to 3 candidate activities for the "I just finished a run" picker.
 *
 * Priority:
 * 1. Same-day runs, even if they were auto-matched (most recent first)
 * 2. Recent unmatched runs from this week (most recent first)
 */
function pickCandidates(activities: Activity[], today: string, weekStart: string): Activity[] {
  // Look back one day before week start so runs just before midnight on Sunday
  // still appear on Monday morning.
  const windowStart = addDaysIso(weekStart, -1);
  const weekActivities = activities.filter((a) => {
    const date = activityLocalDate(a.startTime);
    return a.source === 'strava' && date >= windowStart && date <= today;
  });

  const mostRecentFirst = (left: Activity, right: Activity) => right.startTime.localeCompare(left.startTime);
  const todayActivities = weekActivities
    .filter((a) => activityLocalDate(a.startTime) === today)
    .sort(mostRecentFirst);
  const olderUnmatched = weekActivities
    .filter((a) => activityLocalDate(a.startTime) !== today && !a.matchedSessionId)
    .sort(mostRecentFirst);

  return [...todayActivities, ...olderUnmatched].slice(0, 3);
}

function pickCandidatesForSession(activities: Activity[], session: PlannedSession): Activity[] {
  return activities
    .filter((activity) => (
      activity.source === 'strava'
      && (!activity.matchedSessionId || activity.matchedSessionId === session.id)
      && activityLocalDate(activity.startTime) === session.date
    ))
    .sort((left, right) => right.startTime.localeCompare(left.startTime))
    .slice(0, 3);
}

export default function SyncRunPickerScreen() {
  const { sessionId: rawSessionId } = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const requestedSessionId = useMemo(
    () => firstRouteParamValue(rawSessionId),
    [rawSessionId],
  );
  const insets = useSafeAreaInsets();
  const { session, isLoading: authLoading } = useAuth();
  const { units } = usePreferences();
  const { currentWeek, refresh: refreshPlan } = usePlan();
  const { forceSync, syncing } = useStravaSync();
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayIsoLocal();
  const weekStart = startOfWeekIso(today);
  const displayWeek = useMemo(
    () => (currentWeek ? buildCurrentDisplayWeek(currentWeek, today) : null),
    [currentWeek, today],
  );
  const todaySession = findSessionForDateOrWeekday(displayWeek?.sessions ?? [], today);
  const requestedSession = useMemo(
    () => (displayWeek?.sessions ?? []).find((candidate) => candidate?.id === requestedSessionId) ?? null,
    [displayWeek?.sessions, requestedSessionId],
  );

  async function loadActivities(runSync = false) {
    if (!session) {
      setAllActivities([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      if (runSync) {
        await forceSync();
        await refreshPlan();
      }
      const next = await trpc.activity.list.query();
      setAllActivities(next);
    } catch (error) {
      console.warn('Failed to load sync-run activities:', error);
      setAllActivities([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivities(true).catch((error) => {
      console.warn('Failed to initialize sync-run picker:', error);
    });
  }, [session]);

  const candidates = useMemo(
    () => (isRunnableSession(requestedSession)
      ? pickCandidatesForSession(allActivities, requestedSession)
      : pickCandidates(allActivities, today, weekStart)),
    [allActivities, requestedSession, today, weekStart],
  );

  const recommendedActivityId = useMemo(() => {
    if (!candidates.length) return null;

    if (requestedSession?.id) {
      const matched = candidates.find((activity) => activity.matchedSessionId === requestedSession.id);
      if (matched) return matched.id;
    }

    if (todaySession?.id) {
      const matched = candidates.find((a) => a.matchedSessionId === todaySession.id);
      if (matched) return matched.id;
    }

    const sameDay = candidates.find((a) => activityLocalDate(a.startTime) === today);
    return sameDay?.id ?? candidates[0]?.id ?? null;
  }, [candidates, requestedSession?.id, today, todaySession?.id]);
  const hasCandidates = candidates.length > 0;

  function isRunnableSession(session: PlannedSession | null): session is PlannedSession {
    return session != null && session.type !== 'REST';
  }

  if (authLoading || loading) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={C.forest} />
          <Text style={styles.loadingTitle}>{syncing ? 'Finding your run…' : 'Loading recent runs…'}</Text>
          <Text style={styles.loadingText}>
            {syncing
              ? 'Pulling your latest activity from Strava. This usually takes about 5 seconds.'
              : 'Checking your recent runs so we can open the right one.'}
          </Text>
          {syncing ? (
            <View style={styles.loadingSteps}>
              <Text style={[styles.loadingStep, styles.loadingStepDone]}>CONNECTED</Text>
              <Text style={styles.loadingStepSep}>·</Text>
              <Text style={[styles.loadingStep, styles.loadingStepActive]}>FETCHING</Text>
              <Text style={styles.loadingStepSep}>·</Text>
              <Text style={styles.loadingStep}>MATCHING</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.navSide} onPress={() => router.back()}>
          <Text style={styles.navAction}>Close</Text>
        </Pressable>
        <Text style={styles.navTitle}>Choose run</Text>
        <View style={styles.navSide} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={syncing || loading}
            onRefresh={() => {
              loadActivities(true).catch((error) => {
                console.warn('Failed to refresh sync-run picker:', error);
              });
            }}
            tintColor={C.forest}
          />
        }
      >
        <Text style={styles.screenTitle}>
          {isRunnableSession(requestedSession) ? 'Which run matches this session?' : 'Which run did you just finish?'}
        </Text>
        <Text style={styles.screenSub}>
          {isRunnableSession(requestedSession)
            ? `Pick a synced run for ${formatSessionTitle(requestedSession, units)}.`
            : candidates.length > 0
              ? 'We found recent runs in Strava. Tap the one you want to review and save.'
              : 'No fresh runs found yet. Pull to refresh after your next Strava sync.'}
        </Text>

        {candidates.map((activity) => {
          const recommended = activity.id === recommendedActivityId;
          const matchesRequestedSession = requestedSession?.id && activity.matchedSessionId === requestedSession.id;
          const matchesToday = todaySession?.id && activity.matchedSessionId === todaySession.id;

          return (
            <Pressable
              key={activity.id}
              onPress={() => router.push(
                requestedSession
                  ? `/sync-run/${activity.id}?sessionId=${encodeURIComponent(requestedSession.id)}`
                  : `/sync-run/${activity.id}`,
              )}
              style={[styles.runCard, recommended && styles.runCardRecommended]}
            >
              <View style={[styles.runIcon, recommended && styles.runIconRecommended]}>
                <Text style={[styles.runIconText, recommended && styles.runIconTextRecommended]}>›</Text>
              </View>

              <View style={styles.runBody}>
                <View style={styles.runTitleRow}>
                  <Text style={styles.runTitle}>{activityTitle(activity)}</Text>
                  <Text style={styles.runTime}>{formatActivityTime(activity.startTime, today)}</Text>
                </View>
                <Text style={styles.runMetrics}>
                  {formatDistance(activity.distance, units, { spaced: true })} · {formatDuration(activity.duration)} · {formatPace(activity.avgPace, units, { withUnit: true })}
                </Text>
                <View style={styles.runSubRow}>
                  <Text style={[styles.runTag, (matchesRequestedSession || matchesToday) ? styles.runTagMatch : styles.runTagNoMatch]}>
                    {matchesRequestedSession ? 'MATCHES SESSION' : matchesToday ? 'MATCHES TODAY' : 'NO PLAN MATCH YET'}
                  </Text>
                  {activity.avgHR ? <Text style={styles.runSubText}>{activity.avgHR} bpm avg</Text> : null}
                </View>
              </View>
            </Pressable>
          );
        })}

        <Pressable style={styles.noneButton} onPress={() => router.back()}>
          <Text style={styles.noneButtonText}>{hasCandidates ? 'None of these' : 'Back'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  loadingCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 28,
    paddingVertical: 32,
    alignItems: 'center',
  },
  loadingTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    color: C.ink,
  },
  loadingText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: C.muted,
    maxWidth: 260,
  },
  loadingSteps: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingStep: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1,
  },
  loadingStepDone: {
    color: C.forest,
  },
  loadingStepActive: {
    color: C.ink,
    fontFamily: FONTS.monoBold,
  },
  loadingStepSep: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.muted,
  },
  navBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navAction: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.muted,
  },
  navSide: {
    width: 74,
  },
  navTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 15,
    color: C.ink,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
  screenTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 30,
    lineHeight: 34,
    color: C.ink,
    marginBottom: 8,
  },
  screenSub: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.muted,
    marginBottom: 20,
  },
  runCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 14,
  },
  runCardRecommended: {
    borderColor: C.forest,
    backgroundColor: C.forestBg,
  },
  runIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  runIconRecommended: {
    borderColor: C.forest,
    backgroundColor: C.forest,
  },
  runIconText: {
    fontFamily: FONTS.serifBold,
    fontSize: 16,
    color: C.ink,
  },
  runIconTextRecommended: {
    color: C.surface,
  },
  runBody: {
    flex: 1,
  },
  runTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 5,
  },
  runTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 17,
    color: C.ink,
    flex: 1,
  },
  runTime: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.muted,
  },
  runMetrics: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.ink2,
    marginBottom: 7,
  },
  runSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  runTag: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1,
  },
  runTagMatch: {
    backgroundColor: C.forest,
    color: C.surface,
  },
  runTagNoMatch: {
    backgroundColor: '#ECE8E1',
    color: C.slate,
  },
  runSubText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  noneButton: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    backgroundColor: C.surface,
    alignItems: 'center',
    paddingVertical: 14,
  },
  noneButtonText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: C.ink2,
  },
});
