import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useAuth } from '../../lib/auth';
import { usePlan } from '../../hooks/usePlan';
import { useStravaSync } from '../../hooks/useStravaSync';
import { useTodayIso } from '../../hooks/useTodayIso';
import { Btn } from '../../components/ui/Btn';
import { PhaseThemeProvider } from '../../components/home/PhaseThemeProvider';
import { TodayHeroCard } from '../../components/home/TodayHeroCard';
import { RemainingDaysList } from '../../components/home/RemainingDaysList';
import { CoachAnnotationCard } from '../../components/home/CoachAnnotationCard';
import { FinishedRunCta } from '../../components/home/FinishedRunCta';
import { NiggleBanner } from '../../components/home/NiggleBanner';
import { WeeklyLoadCard } from '../../components/home/WeeklyLoadCard';
import { InjuryBanner } from '../../components/recovery/InjuryBanner';
import { CrossTrainingLog } from '../../components/recovery/CrossTrainingLog';
import { ReturnToRunning } from '../../components/recovery/ReturnToRunning';
import { RecoveryFlowModal } from '../../components/recovery/RecoveryFlowModal';
import { addDaysIso, findSessionForDateOrWeekday, inferWeekStartDate, startOfWeekIso } from '../../lib/plan-helpers';
import { useActivityResolution } from '../../features/run/use-activity-resolution';
import { useRunDetailNavigation } from '../../features/run/use-run-detail-navigation';
import { useRecoveryData } from '../../features/recovery/use-recovery-data';
import { useRecoveryActionController } from '../../features/recovery/use-recovery-action-controller';
import { getVisibleActiveInjury, MVP_RECOVERY_UI_ENABLED } from '../../features/recovery/recovery-ui-gate';
import { usePlanRefreshCoordinator } from '../../features/sync/use-plan-refresh-coordinator';

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

function hasCohesiveScheduledWeek(
  week: NonNullable<ReturnType<typeof usePlan>['currentWeek']>,
  inferredWeekStartDate: string,
): boolean {
  const datedSessions = week.sessions.flatMap((session, index) => (
    session?.date ? [{ index, date: session.date }] : []
  ));

  if (datedSessions.length < 4) {
    return false;
  }

  return datedSessions.every(({ index, date }) => date === addDaysIso(inferredWeekStartDate, index));
}

function resolveCurrentWeekStartDate(
  week: NonNullable<ReturnType<typeof usePlan>['currentWeek']>,
  today: string,
): string {
  const inferred = inferWeekStartDate(week, today);
  if (hasCohesiveScheduledWeek(week, inferred)) {
    return inferred;
  }

  const slotResolvedTodaySession = findSessionForDateOrWeekday(week.sessions, today);
  const exactTodaySession = week.sessions.find((session) => session?.date === today) ?? null;

  if (
    slotResolvedTodaySession
    && !exactTodaySession
    && slotResolvedTodaySession.date !== today
  ) {
    return startOfWeekIso(today);
  }

  return inferred;
}

export default function HomeScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { session, isLoading: authLoading } = useAuth();
  const { plan, loading, refreshing, currentWeek, refresh, refreshWithIndicator } = usePlan();
  const { forceSync, syncRevision, syncing } = useStravaSync();
  const [recoveryModalMode, setRecoveryModalMode] = useState<'mark' | 'resume' | null>(null);
  const [resumeFlowKind, setResumeFlowKind] = useState<'manual' | 'complete-step'>('manual');
  const today = useTodayIso();
  const weekSessions = currentWeek?.sessions ?? [];
  const weekStartDate = currentWeek ? resolveCurrentWeekStartDate(currentWeek, today) : null;
  const activeInjury = getVisibleActiveInjury(plan);
  const activityResolution = useActivityResolution({
    enabled: Boolean(session),
    isFocused,
    planId: plan?.id,
    syncRevision,
    fetchErrorMessage: 'Failed to fetch activities for home view:',
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
    fetchErrorMessage: 'Failed to fetch cross-training entries for home view:',
  });
  const recoveryController = useRecoveryActionController({
    planId: plan?.id,
    activeInjury,
    today,
    refreshPlan: refresh,
    refreshCrossTraining: recoveryData.refreshEntries,
  });
  const { refreshManually } = usePlanRefreshCoordinator({
    enabled: Boolean(session),
    isFocused,
    forceSync,
    refreshPlan: refresh,
    refreshPlanWithIndicator: refreshWithIndicator,
    syncRevision,
    syncRefreshErrorMessage: 'Failed to refresh plan after Strava sync:',
    manualRefreshErrorMessage: 'Failed to refresh home screen:',
  });
  const runDetailNavigation = useRunDetailNavigation({
    activityForSession: activityResolution.activityForSession,
  });

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

  if (!currentWeek) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Could not load this week</Text>
        <Text style={styles.emptySubtitle}>Pull to refresh or try again in a moment.</Text>
        <View style={{ marginTop: 20 }}>
          <Btn
            title="Try again"
            onPress={() => {
              refresh().catch((error) => {
                console.error('Failed to retry home bootstrap:', error);
              });
            }}
          />
        </View>
      </View>
    );
  }

  const week = currentWeek;
  const resolvedWeekStartDate = weekStartDate ?? resolveCurrentWeekStartDate(week, today);
  const todaySession = findSessionForDateOrWeekday(week.sessions, today);
  const todayActivity = activityResolution.activityForSession(todaySession);
  const weeklyActualKm = activityResolution.weekActualKm(weekSessions);
  const showFinishedRunCta = Boolean(
    todaySession
    && todaySession.type !== 'REST'
    && !activityResolution.isSessionComplete(todaySession),
  );
  const steadyNote = todaySession ? (plan.todayAnnotation ?? plan.coachAnnotation ?? null) : null;
  const coachNote = plan.coachAnnotation && plan.coachAnnotation === steadyNote ? null : plan.coachAnnotation;
  const handleTodayHeroPress = runDetailNavigation.canOpenRunDetail(todaySession)
    ? () => runDetailNavigation.openRunDetail(todaySession)
    : undefined;

  async function handleMarkRtrStepComplete() {
    const result = await recoveryController.advanceReturnToRun();
    if (result === 'needs-resume') {
      setResumeFlowKind('complete-step');
      setRecoveryModalMode('resume');
    }
  }

  async function handleMarkInjury(name: string) {
    const didMarkInjury = await recoveryController.markInjury(name);
    if (didMarkInjury) {
      setRecoveryModalMode(null);
      setResumeFlowKind('manual');
    }
  }

  async function handleEndRecovery(option: { type: 'current' } | { type: 'choose'; weekNumber: number }) {
    const didEndRecovery = await recoveryController.endRecovery({
        option,
        completeCurrentStep: resumeFlowKind === 'complete-step',
      });
    if (didEndRecovery) {
      setRecoveryModalMode(null);
      setResumeFlowKind('manual');
    }
  }

  return (
    <PhaseThemeProvider phase={week.phase}>
      <View style={styles.container}>
        <ScrollView
          testID="home-scroll"
          style={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || syncing}
              onRefresh={refreshManually}
              tintColor={C.clay}
            />
          }
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + HOME_SCROLL_TOP_PADDING },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.headerMeta}>{formatWeekRangeLabel(resolvedWeekStartDate)}</Text>
            <Text style={styles.headerKicker}>
              {activeInjury ? 'Recovery Mode' : formatPhaseHeading(week.weekNumber, week.phase)}
            </Text>
            {MVP_RECOVERY_UI_ENABLED ? (
              <Pressable
                accessibilityRole="button"
                disabled={syncing || recoveryController.isUpdatingRtr || recoveryController.isMutatingRecovery}
                onPress={() => {
                  setResumeFlowKind('manual');
                  setRecoveryModalMode(activeInjury ? 'resume' : 'mark');
                }}
                style={({ pressed }) => [
                  styles.headerAction,
                  activeInjury && styles.headerActionActive,
                  pressed && styles.headerActionPressed,
                  (syncing || recoveryController.isUpdatingRtr || recoveryController.isMutatingRecovery) && styles.headerActionDisabled,
                ]}
              >
                <Text style={[styles.headerActionText, activeInjury && styles.headerActionTextActive]}>
                  {activeInjury ? 'End recovery' : 'Mark injury'}
                </Text>
              </Pressable>
            ) : null}
          </View>
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
                weekStartDate={resolvedWeekStartDate}
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
            <>
              <WeeklyLoadCard actualKm={weeklyActualKm} plannedKm={week.plannedKm} />
              <TodayHeroCard
                session={todaySession}
                activity={todayActivity}
                steadyNote={steadyNote}
                onPress={handleTodayHeroPress}
                onReviewRun={todayActivity ? () => router.push(`/sync-run/${todayActivity.id}`) : undefined}
              />
              {todayActivity?.niggles?.length ? <NiggleBanner niggles={todayActivity.niggles} /> : null}
              {showFinishedRunCta ? (
                <View style={styles.ctaWrap}>
                  <FinishedRunCta onPress={() => router.push('/sync-run')} />
                </View>
              ) : null}
              <CoachAnnotationCard annotation={coachNote} />
              <RemainingDaysList
                sessions={week.sessions}
                today={today}
                weekStartDate={resolvedWeekStartDate}
                activityForSession={activityResolution.activityForSession}
                statusForDay={activityResolution.statusForDay}
                onSessionPress={runDetailNavigation.openRunDetail}
              />
            </>
          )}
        </ScrollView>
        {MVP_RECOVERY_UI_ENABLED ? (
          <RecoveryFlowModal
            visible={recoveryModalMode !== null}
            mode={recoveryModalMode ?? 'mark'}
            plan={plan}
            currentWeekNumber={week.weekNumber}
            injury={activeInjury}
            busy={syncing || recoveryController.isUpdatingRtr || recoveryController.isMutatingRecovery}
            onClose={() => {
              setRecoveryModalMode(null);
              setResumeFlowKind('manual');
            }}
            onMarkInjury={handleMarkInjury}
            onEndRecovery={handleEndRecovery}
          />
        ) : null}
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
  headerAction: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${C.clay}25`,
    backgroundColor: C.clayBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerActionActive: {
    borderColor: `${C.forest}25`,
    backgroundColor: C.forestBg,
  },
  headerActionPressed: {
    opacity: 0.8,
  },
  headerActionDisabled: {
    opacity: 0.5,
  },
  headerActionText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.clay,
  },
  headerActionTextActive: {
    color: C.forest,
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
