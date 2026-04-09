import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useAuth } from '../../lib/auth';
import { usePlan } from '../../hooks/usePlan';
import { trpc } from '../../lib/trpc';
import { Btn } from '../../components/ui/Btn';
import { PhaseThemeProvider } from '../../components/home/PhaseThemeProvider';
import { TodayHeroCard } from '../../components/home/TodayHeroCard';
import { RemainingDaysList } from '../../components/home/RemainingDaysList';
import { CoachAnnotationCard } from '../../components/home/CoachAnnotationCard';
import { WeeklyLoadCard } from '../../components/home/WeeklyLoadCard';
import { addDaysIso, findSessionForDateOrWeekday, inferWeekStartDate } from '../../lib/plan-helpers';
import type { Activity, SubjectiveInput } from '@steady/types';

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
  const insets = useSafeAreaInsets();
  const { session, isLoading: authLoading } = useAuth();
  const { plan, loading, currentWeek, refresh } = usePlan();
  const [activities, setActivities] = useState<Activity[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const weekSessions = currentWeek?.sessions ?? [];

  const activitiesBySessionId = useMemo(() => {
    return new Map(
      activities
        .filter((activity) => Boolean(activity.matchedSessionId))
        .map((activity) => [activity.matchedSessionId!, activity]),
    );
  }, [activities]);

  const weeklyActualKm = useMemo(() => {
    const total = weekSessions.reduce((sum, session) => {
      if (!session?.id) return sum;
      return sum + (activitiesBySessionId.get(session.id)?.distance ?? 0);
    }, 0);
    return Number(total.toFixed(1));
  }, [activitiesBySessionId, weekSessions]);

  useEffect(() => {
    if (!plan) {
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
  }, [plan?.id]);

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
  const weekStartDate = inferWeekStartDate(week, today);
  const steadyNote = todaySession ? plan.coachAnnotation : null;
  const coachNote = steadyNote && plan.coachAnnotation === steadyNote ? null : plan.coachAnnotation;

  async function saveSubjectiveInput(input: SubjectiveInput) {
    if (!todaySession) return;
    await trpc.plan.saveSubjectiveInput.mutate({
      sessionId: todaySession.id,
      input,
    });
    await refresh();
  }

  async function dismissSubjectiveInput() {
    if (!todaySession) return;
    await trpc.plan.dismissSubjectiveInput.mutate({
      sessionId: todaySession.id,
    });
    await refresh();
  }

  return (
    <PhaseThemeProvider phase={week.phase}>
      <View style={styles.container}>
        <ScrollView
          testID="home-scroll"
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + HOME_SCROLL_TOP_PADDING },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.headerMeta}>{formatWeekRangeLabel(weekStartDate)}</Text>
            <Text style={styles.headerKicker}>{formatPhaseHeading(week.weekNumber, week.phase)}</Text>
            <Text style={styles.headerSubtitle}>Focus on the session in front of you.</Text>
          </View>
          <WeeklyLoadCard actualKm={weeklyActualKm} plannedKm={week.plannedKm} />
          <TodayHeroCard
            session={todaySession}
            activity={todaySession?.id ? activitiesBySessionId.get(todaySession.id) : undefined}
            steadyNote={steadyNote}
            onSaveSubjectiveInput={saveSubjectiveInput}
            onDismissSubjectiveInput={dismissSubjectiveInput}
          />
          <CoachAnnotationCard annotation={coachNote} />
          <RemainingDaysList
            sessions={week.sessions}
            today={today}
            activitiesBySessionId={activitiesBySessionId}
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
    fontSize: 30,
    color: C.ink,
  },
  headerSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
    marginTop: 2,
  },
});
