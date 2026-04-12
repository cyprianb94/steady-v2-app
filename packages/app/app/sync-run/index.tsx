import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Activity, PlannedSession } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useAuth } from '../../lib/auth';
import { trpc } from '../../lib/trpc';
import { usePlan } from '../../hooks/usePlan';
import { useStravaSync } from '../../hooks/useStravaSync';
import { findSessionForDateOrWeekday, startOfWeekIso, todayIsoLocal } from '../../lib/plan-helpers';

function formatPace(secPerKm: number): string {
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.floor(secPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatActivityTime(startTime: string, today: string): string {
  const value = new Date(startTime);
  const datePart = startTime.slice(0, 10);
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

/**
 * Returns up to 3 candidate activities for the "I just finished a run" picker.
 *
 * Priority:
 * 1. Same-day unmatched runs (most recent first)
 * 2. Recent unmatched runs from this week (most recent first)
 *
 * If everything in the week is already matched, we still show same-day
 * runs so the user can review them.
 */
function pickCandidates(activities: Activity[], today: string, weekStart: string): Activity[] {
  const weekActivities = activities.filter((a) => {
    const date = a.startTime.slice(0, 10);
    return a.source === 'strava' && date >= weekStart && date <= today;
  });

  const unmatched = weekActivities.filter((a) => !a.matchedSessionId);
  const todayUnmatched = unmatched.filter((a) => a.startTime.slice(0, 10) === today);
  const olderUnmatched = unmatched.filter((a) => a.startTime.slice(0, 10) !== today);

  // Build ordered list: today first, then older; limit to 3
  const ordered = [...todayUnmatched, ...olderUnmatched].slice(0, 3);

  // If nothing unmatched, fall back to same-day activities so user can still access them
  if (ordered.length === 0) {
    return weekActivities.filter((a) => a.startTime.slice(0, 10) === today).slice(0, 3);
  }

  return ordered;
}

export default function SyncRunPickerScreen() {
  const { session, isLoading: authLoading } = useAuth();
  const { currentWeek, refresh: refreshPlan } = usePlan();
  const { forceSync, syncing } = useStravaSync();
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayIsoLocal();
  const weekStart = startOfWeekIso(today);
  const todaySession = findSessionForDateOrWeekday(currentWeek?.sessions ?? [], today);

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
      console.error('Failed to load sync-run activities:', error);
      setAllActivities([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivities(true).catch((error) => {
      console.error('Failed to initialize sync-run picker:', error);
    });
  }, [session]);

  const candidates = useMemo(
    () => pickCandidates(allActivities, today, weekStart),
    [allActivities, today, weekStart],
  );

  const recommendedActivityId = useMemo(() => {
    if (!candidates.length) return null;

    if (todaySession?.id) {
      const matched = candidates.find((a) => a.matchedSessionId === todaySession.id);
      if (matched) return matched.id;
    }

    const sameDay = candidates.find((a) => a.startTime.slice(0, 10) === today);
    return sameDay?.id ?? candidates[0]?.id ?? null;
  }, [candidates, today, todaySession?.id]);

  function isRunnableSession(session: PlannedSession | null): session is PlannedSession {
    return session != null && session.type !== 'REST';
  }

  if (authLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.forest} />
        <Text style={styles.loadingText}>{syncing ? 'Pulling from Strava...' : 'Loading runs...'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.navAction}>Close</Text>
        </Pressable>
        <Text style={styles.navTitle}>Choose run</Text>
        <View style={styles.navSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={syncing || loading}
            onRefresh={() => {
              loadActivities(true).catch((error) => {
                console.error('Failed to refresh sync-run picker:', error);
              });
            }}
            tintColor={C.forest}
          />
        }
      >
        <Text style={styles.screenTitle}>Which run did you just finish?</Text>
        <Text style={styles.screenSub}>
          {candidates.length > 0
            ? 'We found recent runs in Strava. Tap the one you want to review and save.'
            : 'No unmatched runs found this week. Pull to refresh after your next sync.'}
        </Text>

        {candidates.map((activity) => {
          const recommended = activity.id === recommendedActivityId;
          const matchesToday = todaySession?.id && activity.matchedSessionId === todaySession.id;

          return (
            <Pressable
              key={activity.id}
              onPress={() => router.push(`/sync-run/${activity.id}`)}
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
                  {activity.distance.toFixed(1)} km · {formatDuration(activity.duration)} · {formatPace(activity.avgPace)} /km
                </Text>
                <View style={styles.runSubRow}>
                  <Text style={[styles.runTag, matchesToday ? styles.runTagMatch : styles.runTagNoMatch]}>
                    {matchesToday ? 'MATCHES TODAY' : 'NO PLAN MATCH YET'}
                  </Text>
                  {activity.avgHR ? <Text style={styles.runSubText}>{activity.avgHR} bpm avg</Text> : null}
                </View>
              </View>
            </Pressable>
          );
        })}

        <Pressable
          style={styles.noneButton}
          onPress={() => router.back()}
        >
          <Text style={styles.noneButtonText}>None of these</Text>
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
  center: {
    flex: 1,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
  },
  navBar: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 14,
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
  navTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 15,
    color: C.ink,
  },
  navSpacer: {
    width: 36,
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
