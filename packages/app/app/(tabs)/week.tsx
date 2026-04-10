import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, Alert, RefreshControl } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { type CrossTrainingEntry } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { usePlan } from '../../hooks/usePlan';
import { useStravaSync } from '../../hooks/useStravaSync';
import { useAuth } from '../../lib/auth';
import { WeekHeader } from '../../components/week/WeekHeader';
import { LoadBar } from '../../components/week/LoadBar';
import { DayCard } from '../../components/week/DayCard';
import { Btn } from '../../components/ui/Btn';
import { DAYS, inferWeekStartDate } from '../../lib/plan-helpers';
import { InjuryBanner } from '../../components/recovery/InjuryBanner';
import { CrossTrainingLog } from '../../components/recovery/CrossTrainingLog';
import { RecoveryFlowModal } from '../../components/recovery/RecoveryFlowModal';
import { ReturnToRunning } from '../../components/recovery/ReturnToRunning';
import { trpc } from '../../lib/trpc';
import { clearResumeWeekOverride, setResumeWeekOverride } from '../../lib/resume-week';

export default function WeekTab() {
  const isFocused = useIsFocused();
  const { session, isLoading: authLoading } = useAuth();
  const { plan, loading, currentWeekIndex, refresh } = usePlan();
  const { requestAutoSync, forceSync, syncRevision, syncing } = useStravaSync();
  const [weekOffset, setWeekOffset] = useState(0);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [crossTrainingEntries, setCrossTrainingEntries] = useState<CrossTrainingEntry[]>([]);
  const [isLoadingCrossTraining, setIsLoadingCrossTraining] = useState(false);
  const [isSavingCrossTraining, setIsSavingCrossTraining] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [isUpdatingRtr, setIsUpdatingRtr] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const weekIdx = plan ? currentWeekIndex + weekOffset : 0;
  const week = plan?.weeks[weekIdx] ?? null;
  const activeInjury =
    plan?.activeInjury && plan.activeInjury.status !== 'resolved' ? plan.activeInjury : null;
  const weekStartDate = week ? inferWeekStartDate(week, today) : today;

  useEffect(() => {
    if (!session || !plan || !week || !activeInjury) {
      setCrossTrainingEntries([]);
      return;
    }

    let cancelled = false;

    async function fetchCrossTraining() {
      try {
        setIsLoadingCrossTraining(true);
        const entries = await trpc.crossTraining.getForWeek.query({ weekStartDate });
        if (!cancelled) {
          setCrossTrainingEntries(entries);
        }
      } catch (error) {
        console.error('Failed to fetch cross-training entries:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingCrossTraining(false);
        }
      }
    }

    fetchCrossTraining();

    return () => {
      cancelled = true;
    };
  }, [activeInjury, plan, session, week, weekStartDate]);

  useEffect(() => {
    if (!activeInjury) {
      setWeekOffset(0);
    }
  }, [activeInjury, plan?.id]);

  useEffect(() => {
    if (!isFocused || !session) return;
    requestAutoSync().catch((error) => {
      console.error('Failed to auto-sync Strava on week focus:', error);
    });
  }, [isFocused, requestAutoSync, session]);

  useEffect(() => {
    if (syncRevision === 0) return;
    refresh().catch((error) => {
      console.error('Failed to refresh week plan after Strava sync:', error);
    });
  }, [refresh, syncRevision]);

  if (authLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.clay} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Sign in to build your plan</Text>
        <Text style={styles.emptySubtitle}>
          Use the Settings tab to continue with Google, then come back here to start onboarding.
        </Text>
        <View style={{ marginTop: 20 }}>
          <Btn title="Go to settings" onPress={() => router.push('/(tabs)/settings')} />
        </View>
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
  if (!week) return null;

  const maxKm = Math.max(...plan.weeks.map((w) => w.plannedKm), 1);

  async function handleSaveReassessedTarget(value: string) {
    try {
      setIsSavingGoal(true);
      await trpc.plan.updateInjury.mutate({ reassessedTarget: value });
      await refresh();
    } catch (error) {
      console.error('Failed to update reassessed target:', error);
      Alert.alert('Could not update goal', 'Please try again in a moment.');
    } finally {
      setIsSavingGoal(false);
    }
  }

  async function refreshCrossTraining() {
    const entries = await trpc.crossTraining.getForWeek.query({ weekStartDate });
    setCrossTrainingEntries(entries);
  }

  async function handleAddCrossTraining(input: {
    date: string;
    type: CrossTrainingEntry['type'];
    durationMinutes: number;
  }) {
    try {
      setIsSavingCrossTraining(true);
      await trpc.crossTraining.log.mutate(input);
      await refreshCrossTraining();
    } catch (error) {
      console.error('Failed to save cross-training entry:', error);
      Alert.alert('Could not save entry', 'Please try again in a moment.');
    } finally {
      setIsSavingCrossTraining(false);
    }
  }

  async function handleDeleteCrossTraining(id: string) {
    try {
      setDeletingEntryId(id);
      await trpc.crossTraining.delete.mutate({ id });
      await refreshCrossTraining();
    } catch (error) {
      console.error('Failed to delete cross-training entry:', error);
      Alert.alert('Could not delete entry', 'Please try again in a moment.');
    } finally {
      setDeletingEntryId(null);
    }
  }

  async function handleMarkRtrStepComplete() {
    if (!activeInjury) return;

    if (activeInjury.rtrStep >= 3) {
      setShowResumeModal(true);
      return;
    }

    const completionDates = [...activeInjury.rtrStepCompletedDates];
    completionDates[activeInjury.rtrStep] = today;

    try {
      setIsUpdatingRtr(true);
      await trpc.plan.updateInjury.mutate({
        rtrStep: activeInjury.rtrStep + 1,
        rtrStepCompletedDates: completionDates,
        status: activeInjury.rtrStep + 1 > 0 ? 'returning' : activeInjury.status,
      });
      await refresh();
    } catch (error) {
      console.error('Failed to update return-to-running progress:', error);
      Alert.alert('Could not update progress', 'Please try again in a moment.');
    } finally {
      setIsUpdatingRtr(false);
    }
  }

  async function handleCompleteRecovery(option: { type: 'current' } | { type: 'choose'; weekNumber: number }) {
    if (!plan || !activeInjury) return;

    const completionDates = [...activeInjury.rtrStepCompletedDates];
    completionDates[activeInjury.rtrStep] = today;

    try {
      setIsUpdatingRtr(true);

      if (option.type === 'current') {
        await clearResumeWeekOverride(plan.id);
      } else {
        await setResumeWeekOverride(plan.id, option.weekNumber);
      }

      await trpc.plan.updateInjury.mutate({
        rtrStep: activeInjury.rtrStep + 1,
        rtrStepCompletedDates: completionDates,
        status: 'returning',
      });
      await trpc.plan.clearInjury.mutate();
      await refresh();
      setShowResumeModal(false);
    } catch (error) {
      console.error('Failed to complete recovery:', error);
      Alert.alert('Could not finish recovery', 'Please try again in a moment.');
    } finally {
      setIsUpdatingRtr(false);
    }
  }

  async function handleRefresh() {
    await forceSync();
    await refresh();
  }

  return (
    <View style={styles.container}>
      {activeInjury ? null : (
        <WeekHeader
          plan={plan}
          weekNumber={week.weekNumber}
          totalWeeks={plan.weeks.length}
          onPrev={() => setWeekOffset((o) => Math.max(o - 1, -currentWeekIndex))}
          onNext={() => setWeekOffset((o) => Math.min(o + 1, plan.weeks.length - 1 - currentWeekIndex))}
        />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading || syncing}
            onRefresh={() => {
              handleRefresh().catch((error) => {
                console.error('Failed to refresh week screen:', error);
              });
            }}
            tintColor={C.clay}
          />
        }
      >
        {activeInjury ? (
          <>
            <InjuryBanner
              injury={activeInjury}
              plan={plan}
              weekNumber={week.weekNumber}
              totalWeeks={plan.weeks.length}
              onSaveReassessedTarget={handleSaveReassessedTarget}
              isSavingGoal={isSavingGoal}
            />
            <CrossTrainingLog
              entries={crossTrainingEntries}
              weekStartDate={weekStartDate}
              onAdd={handleAddCrossTraining}
              onDelete={handleDeleteCrossTraining}
              isSaving={isSavingCrossTraining || isLoadingCrossTraining}
              deletingId={deletingEntryId}
            />
            <ReturnToRunning
              injury={activeInjury}
              currentWeekNumber={week.weekNumber}
              onMarkComplete={handleMarkRtrStepComplete}
              isUpdating={isUpdatingRtr}
            />
          </>
        ) : (
          <LoadBar week={week} maxKm={maxKm} />
        )}

        {week.sessions.map((session, i) => {
          const sessionDate = session?.date ?? '';
          const isToday = sessionDate === today;

          return (
            <DayCard
              key={i}
              session={session}
              dayName={DAYS[i]}
              isToday={isToday}
              muted={!!activeInjury && !session?.actualActivityId}
              onPress={() => {
                // TODO: Open session detail sheet (Slice 16)
              }}
            />
          );
        })}
      </ScrollView>

      {plan && activeInjury ? (
        <RecoveryFlowModal
          visible={showResumeModal}
          mode="resume"
          plan={plan}
          currentWeekNumber={week.weekNumber}
          injury={activeInjury}
          busy={isUpdatingRtr}
          onClose={() => setShowResumeModal(false)}
          onMarkInjury={async () => {}}
          onEndRecovery={handleCompleteRecovery}
        />
      ) : null}
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
    paddingTop: 14,
  },
});
