import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useAuth } from '../../lib/auth';
import { usePlan } from '../../hooks/usePlan';
import { useStravaSync } from '../../hooks/useStravaSync';
import { useTodayIso } from '../../hooks/useTodayIso';
import { trpc } from '../../lib/trpc';
import { Btn } from '../../components/ui/Btn';
import { PhaseThemeProvider } from '../../components/home/PhaseThemeProvider';
import { TodayHeroCard } from '../../components/home/TodayHeroCard';
import { RemainingDaysList } from '../../components/home/RemainingDaysList';
import { CoachAnnotationCard } from '../../components/home/CoachAnnotationCard';
import { WeeklyLoadCard } from '../../components/home/WeeklyLoadCard';
import { addDaysIso, findSessionForDateOrWeekday, startOfWeekIso } from '../../lib/plan-helpers';
import type { Activity } from '@steady/types';

const HOME_SCROLL_TOP_PADDING = 14;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function formatWeekRangeLabel(weekStartDate: string): string {
  const start = new Date(`${weekStartDate}T00:00:00Z`);
  const weekEndDate = addDaysIso(weekStartDate, 6);
  const end = new Date(`${weekEndDate}T00:00:00Z`);

  return `${MONTHS[start.getUTCMonth()].toUpperCase()} ${start.getUTCDate()} – ${end.getUTCDate()} · ${end.getUTCFullYear()}`;
}

function formatPhaseHeading(weekNumber: number, phase: string): string {
  return `Week ${weekNumber} · ${phase.slice(0, 1)}${phase.slice(1).toLowerCase()} Phase`;
}

export default function HomeScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { session, isLoading: authLoading } = useAuth();
  const { plan, loading, currentWeek, refresh } = usePlan();
  const { forceSync, syncRevision, syncing } = useStravaSync();
  const [activities, setActivities] = useState<Activity[]>([]);
  const today = useTodayIso();
  const weekSessions = currentWeek?.sessions ?? [];

  // Two lookup maps so we handle both normalized and legacy session IDs
  const activitiesById = useMemo(() => {
    return new Map(activities.map((a) => [a.id, a]));
  }, [activities]);

  const activitiesByMatchedSessionId = useMemo(() => {
    return new Map(
      activities
        .filter((a) => Boolean(a.matchedSessionId))
        .map((a) => [a.matchedSessionId!, a]),
    );
  }, [activities]);

  // Resolve activity for a session: prefer actualActivityId, fallback to matchedSessionId
  function activityForSession(session: { id: string; actualActivityId?: string } | null): Activity | undefined {
    if (!session) return undefined;
    if (session.actualActivityId) return activitiesById.get(session.actualActivityId);
    return activitiesByMatchedSessionId.get(session.id);
  }

  const weeklyActualKm = useMemo(() => {
    const total = weekSessions.reduce((sum, s) => {
      if (!s?.id) return sum;
      return sum + (activityForSession(s)?.distance ?? 0);
    }, 0);
    return Number(total.toFixed(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activitiesById, activitiesByMatchedSessionId, weekSessions]);

  useEffect(() => {
    if (!plan || !isFocused) {
      setActivities([]);
      return;
    }

    let cancelled = false;

    async function fetchActivities() {
      try {
        const nextActivities = await trpc.activity.list.query();
        if (!cancelled) {
          setActivities(nextActivities);
        }
      } catch (error) {
        console.error('Failed to fetch activities for home view:', error);
        if (!cancelled) {
          setActivities([]);
        }
      }
    }

    fetchActivities();

    return () => {
      cancelled = true;
    };
  }, [isFocused, plan?.id, syncRevision]);

  useEffect(() => {
    if (!isFocused || !session) return;

    Promise.resolve(refresh()).catch((error) => {
      console.error('Failed to refresh home plan on focus:', error);
    });
  }, [isFocused, refresh, session]);

  useEffect(() => {
    if (syncRevision === 0) return;
    refresh().catch((error) => {
      console.error('Failed to refresh plan after Strava sync:', error);
    });
  }, [refresh, syncRevision]);

  if (authLoading || loading) {
    return (
      <View style={styles.center} testID="home-loading">
        <ActivityIndicator size="large" color={C.clay} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Sign in to see your plan</Text>
        <Text style={styles.emptySubtitle}>
          Use the Settings tab to continue with Google, then come back here.
        </Text>
        <View style={{ marginTop: 20 }}>
          <Btn title="Go to settings" onPress={() => router.push('/(tabs)/settings')} />
        </View>
      </View>
    );
  }

  if (!plan || !currentWeek) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No plan yet</Text>
        <Text style={styles.emptySubtitle}>Build your training plan to get started</Text>
        <View style={{ marginTop: 20 }}>
          <Btn
            title="Build a plan"
            onPress={() => router.push('/onboarding/plan-builder/step-goal')}
          />
        </View>
      </View>
    );
  }

  const week = currentWeek;
  const todaySession = findSessionForDateOrWeekday(week.sessions, today);
  const showFinishedRunCta = Boolean(
    todaySession && todaySession.type !== 'REST' && !todaySession.actualActivityId,
  );
  const weekStartDate = startOfWeekIso(today);
  const steadyNote = todaySession ? plan.coachAnnotation : null;
  const coachNote = steadyNote && plan.coachAnnotation === steadyNote ? null : plan.coachAnnotation;

  async function handleRefresh() {
    await forceSync();
    await refresh();
  }

  return (
    <PhaseThemeProvider phase={week.phase}>
      <View style={styles.container}>
        <ScrollView
          testID="home-scroll"
          style={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={loading || syncing}
              onRefresh={() => {
                handleRefresh().catch((error) => {
                  console.error('Failed to refresh home screen:', error);
                });
              }}
              tintColor={C.clay}
            />
          }
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + HOME_SCROLL_TOP_PADDING },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.headerMeta}>{formatWeekRangeLabel(weekStartDate)}</Text>
            <Text style={styles.headerKicker}>{formatPhaseHeading(week.weekNumber, week.phase)}</Text>
          </View>
          <WeeklyLoadCard actualKm={weeklyActualKm} plannedKm={week.plannedKm} />
          <TodayHeroCard
            session={todaySession}
            activity={activityForSession(todaySession)}
            steadyNote={steadyNote}
          />
          {showFinishedRunCta ? (
            <View style={styles.ctaWrap}>
              <Btn
                title="I just finished this run"
                fullWidth
                onPress={() => router.push('/sync-run')}
              />
            </View>
          ) : null}
          <CoachAnnotationCard annotation={coachNote} />
          <RemainingDaysList
            sessions={week.sessions}
            today={today}
            activitiesById={activitiesById}
            activitiesByMatchedSessionId={activitiesByMatchedSessionId}
          />
        </ScrollView>
      </View>
    </PhaseThemeProvider>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  emptyTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    color: C.ink,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    paddingTop: HOME_SCROLL_TOP_PADDING,
  },
  header: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  ctaWrap: {
    marginTop: 14,
  },
  headerMeta: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headerKicker: {
    fontFamily: FONTS.serifBold,
    fontSize: 32,
    fontWeight: '700',
    color: C.ink,
  },
});
