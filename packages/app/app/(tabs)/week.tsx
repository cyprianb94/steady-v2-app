import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { usePlan } from '../../hooks/usePlan';
import { WeekHeader } from '../../components/week/WeekHeader';
import { LoadBar } from '../../components/week/LoadBar';
import { DayCard } from '../../components/week/DayCard';
import { Btn } from '../../components/ui/Btn';
import { DAYS } from '../../lib/plan-helpers';

export default function WeekTab() {
  const { plan, loading, currentWeekIndex } = usePlan();
  const [weekOffset, setWeekOffset] = useState(0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.clay} />
      </View>
    );
  }

  if (!plan) {
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

  const weekIdx = currentWeekIndex + weekOffset;
  const week = plan.weeks[weekIdx];
  if (!week) return null;

  const maxKm = Math.max(...plan.weeks.map((w) => w.plannedKm), 1);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <View style={styles.container}>
      <WeekHeader
        plan={plan}
        weekNumber={week.weekNumber}
        totalWeeks={plan.weeks.length}
        onPrev={() => setWeekOffset((o) => Math.max(o - 1, -currentWeekIndex))}
        onNext={() => setWeekOffset((o) => Math.min(o + 1, plan.weeks.length - 1 - currentWeekIndex))}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <LoadBar week={week} maxKm={maxKm} />

        {week.sessions.map((session, i) => {
          const sessionDate = session?.date ?? '';
          const isToday = sessionDate === today;

          return (
            <DayCard
              key={i}
              session={session}
              dayName={DAYS[i]}
              isToday={isToday}
              onPress={() => {
                // TODO: Open session detail sheet (Slice 16)
              }}
            />
          );
        })}
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
  },
});
