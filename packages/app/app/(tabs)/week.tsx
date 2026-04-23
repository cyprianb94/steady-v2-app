import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { usePlan } from '../../hooks/usePlan';
import { useStravaSync } from '../../hooks/useStravaSync';
import { useTodayIso } from '../../hooks/useTodayIso';
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
import { useActivityResolution } from '../../features/run/use-activity-resolution';
import { useRunDetailNavigation } from '../../features/run/use-run-detail-navigation';
import { useRecoveryData } from '../../features/recovery/use-recovery-data';
import { useRecoveryActionController } from '../../features/recovery/use-recovery-action-controller';
import { getVisibleActiveInjury, MVP_RECOVERY_UI_ENABLED } from '../../features/recovery/recovery-ui-gate';
import { usePlanRefreshCoordinator } from '../../features/sync/use-plan-refresh-coordinator';

export default function WeekTab() {
  const isFocused = useIsFocused();
  const { session, isLoading: authLoading } = useAuth();
  const { plan, loading, refreshing, currentWeekIndex, refresh, refreshWithIndicator } = usePlan();
  const { forceSync, syncRevision, syncing } = useStravaSync();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const today = useTodayIso();
  const weekIdx = plan
    ? Math.min(Math.max(currentWeekIndex + weekOffset, 0), Math.max(plan.weeks.length - 1, 0))
    : 0;
  const week = plan?.weeks[weekIdx] ?? null;
  const weekStartDate = week ? inferWeekStartDate(week, today) : null;
  const activeInjury = getVisibleActiveInjury(plan);
  const activityResolution = useActivityResolution({
    enabled: Boolean(session),
    isFocused,
    planId: plan?.id,
    syncRevision,
    fetchErrorMessage: 'Failed to fetch activities for week view:',
  });
  const recoveryScope = useMemo(
    () => (MVP_RECOVERY_UI_ENABLED && weekStartDate ? { type: 'week' as const, weekStartDate } : null),
    [weekStartDate],
  );
  const recoveryData = useRecoveryData({
    plan,
    enabled: Boolean(session) && MVP_RECOVERY_UI_ENABLED,
    isFocused,
    injury: activeInjury,
    scope: recoveryScope,
    fetchErrorMessage: 'Failed to fetch cross-training entries:',
  });
  const recoveryController = useRecoveryActionController({
    planId: plan?.id,
    activeInjury,
    today,
    refreshPlan: refresh,
    refreshCrossTraining: recoveryData.refreshEntries,
  });
  const runDetailNavigation = useRunDetailNavigation({
    activityForSession: activityResolution.activityForSession,
    activityIdForSession: activityResolution.activityIdForSession,
  });

  useEffect(() => {
    if (!activeInjury) {
      setWeekOffset(0);
    }
  }, [activeInjury, plan?.id]);

  const { refreshManually } = usePlanRefreshCoordinator({
    enabled: Boolean(session),
    isFocused,
    forceSync,
    refreshPlan: refresh,
    refreshPlanWithIndicator: refreshWithIndicator,
    syncRevision,
    syncRefreshErrorMessage: 'Failed to refresh week plan after Strava sync:',
    manualRefreshErrorMessage: 'Failed to refresh week screen:',
  });

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

  if (!plan || plan.weeks.length === 0) {
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
  if (!week) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Could not load this week</Text>
        <Text style={styles.emptySubtitle}>Pull to refresh or try again in a moment.</Text>
        <View style={{ marginTop: 20 }}>
          <Btn
            title="Try again"
            onPress={() => {
              refresh().catch((error) => {
                console.error('Failed to retry week bootstrap:', error);
              });
            }}
          />
        </View>
      </View>
    );
  }

  const maxKm = Math.max(...plan.weeks.map((w) => w.plannedKm), 1);
  async function handleMarkRtrStepComplete() {
    const result = await recoveryController.advanceReturnToRun();
    if (result === 'needs-resume') {
      setShowResumeModal(true);
    }
  }

  async function handleCompleteRecovery(option: { type: 'current' } | { type: 'choose'; weekNumber: number }) {
    const didCompleteRecovery = await recoveryController.endRecovery({
        option,
        completeCurrentStep: true,
      });
    if (didCompleteRecovery) {
      setShowResumeModal(false);
    }
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
            refreshing={refreshing || syncing}
            onRefresh={refreshManually}
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
              onSaveReassessedTarget={async (value) => {
                await recoveryController.saveReassessedTarget(value);
              }}
              isSavingGoal={recoveryController.isSavingGoal}
            />
            <CrossTrainingLog
              entries={recoveryData.entries}
              weekStartDate={weekStartDate ?? today}
              onAdd={async (input) => {
                await recoveryController.addCrossTraining(input);
              }}
              onDelete={async (id) => {
                await recoveryController.deleteCrossTraining(id);
              }}
              isSaving={recoveryController.isSavingCrossTraining || recoveryData.isLoadingEntries}
              deletingId={recoveryController.deletingEntryId}
            />
            <ReturnToRunning
              injury={activeInjury}
              currentWeekNumber={week.weekNumber}
              onMarkComplete={handleMarkRtrStepComplete}
              isUpdating={recoveryController.isUpdatingRtr}
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
              onPress={runDetailNavigation.canOpenRunDetail(session)
                ? () => runDetailNavigation.openRunDetail(session)
                : undefined}
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
          busy={recoveryController.isUpdatingRtr || recoveryController.isEndingRecovery}
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
