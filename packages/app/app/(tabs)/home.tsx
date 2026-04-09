import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useAuth } from '../../lib/auth';
import { usePlan } from '../../hooks/usePlan';
import { Btn } from '../../components/ui/Btn';
import { PhaseThemeProvider } from '../../components/home/PhaseThemeProvider';
import { PhaseInfoStrip } from '../../components/home/PhaseInfoStrip';
import { TodayHeroCard } from '../../components/home/TodayHeroCard';
import { RemainingDaysList } from '../../components/home/RemainingDaysList';
import { CoachAnnotationCard } from '../../components/home/CoachAnnotationCard';

export default function HomeScreen() {
  const { session, isLoading: authLoading } = useAuth();
  const { plan, loading, currentWeek } = usePlan();
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
  const todaySession = week.sessions.find((s) => s?.date === today) ?? null;

  return (
    <PhaseThemeProvider phase={week.phase}>
      <View style={styles.container}>
        <ScrollView
          testID="home-scroll"
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <PhaseInfoStrip
            phase={week.phase}
            weekNumber={week.weekNumber}
            totalWeeks={plan.weeks.length}
            raceDate={plan.raceDate}
            today={today}
          />
          <TodayHeroCard session={todaySession} />
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
    paddingTop: 14,
  },
});
