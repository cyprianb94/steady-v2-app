import React from 'react';
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
import { PhaseInfoStrip } from '../../components/home/PhaseInfoStrip';
import { TodayHeroCard } from '../../components/home/TodayHeroCard';
import { RemainingDaysList } from '../../components/home/RemainingDaysList';
import { CoachAnnotationCard } from '../../components/home/CoachAnnotationCard';
import { findSessionForDateOrWeekday } from '../../lib/plan-helpers';
import type { SubjectiveInput } from '@steady/types';

const HOME_SCROLL_TOP_PADDING = 14;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { session, isLoading: authLoading } = useAuth();
  const { plan, loading, currentWeek, refresh } = usePlan();
  const today = new Date().toISOString().slice(0, 10);

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
            <Text style={styles.headerKicker}>Today</Text>
            <Text style={styles.headerSubtitle}>Focus on the session in front of you.</Text>
          </View>
          <PhaseInfoStrip
            phase={week.phase}
            weekNumber={week.weekNumber}
            totalWeeks={plan.weeks.length}
            raceDate={plan.raceDate}
            today={today}
          />
          <TodayHeroCard
            session={todaySession}
            onSaveSubjectiveInput={saveSubjectiveInput}
            onDismissSubjectiveInput={dismissSubjectiveInput}
          />
          <CoachAnnotationCard annotation={plan.coachAnnotation} />
          <RemainingDaysList sessions={week.sessions} today={today} />
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
  headerKicker: {
    fontFamily: FONTS.serifBold,
    fontSize: 28,
    color: C.ink,
  },
  headerSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
    marginTop: 2,
  },
});
