import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Activity, CrossTrainingEntry } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useAuth } from '../../lib/auth';
import { listActivities } from '../../lib/activity-api';
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
import { InjuryBanner } from '../../components/recovery/InjuryBanner';
import { CrossTrainingLog } from '../../components/recovery/CrossTrainingLog';
import { ReturnToRunning } from '../../components/recovery/ReturnToRunning';
import { RecoveryFlowModal } from '../../components/recovery/RecoveryFlowModal';
import { addDaysIso, findSessionForDateOrWeekday, inferWeekStartDate, startOfWeekIso } from '../../lib/plan-helpers';
import { clearResumeWeekOverride, setResumeWeekOverride } from '../../lib/resume-week';

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
  const { plan, loading, currentWeek, refresh } = usePlan();
  const { forceSync, syncRevision, syncing } = useStravaSync();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [crossTrainingEntries, setCrossTrainingEntries] = useState<CrossTrainingEntry[]>([]);
  const [isLoadingCrossTraining, setIsLoadingCrossTraining] = useState(false);
  const [isSavingCrossTraining, setIsSavingCrossTraining] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [isUpdatingRtr, setIsUpdatingRtr] = useState(false);
  const [isMutatingRecovery, setIsMutatingRecovery] = useState(false);
  const [recoveryModalMode, setRecoveryModalMode] = useState<'mark' | 'resume' | null>(null);
  const today = useTodayIso();
  const weekSessions = currentWeek?.sessions ?? [];
  const activeInjury =
    plan?.activeInjury && plan.activeInjury.status !== 'resolved' ? plan.activeInjury : null;
  const weekStartDate = currentWeek ? resolveCurrentWeekStartDate(currentWeek, today) : null;

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
    if (!plan || !session || !isFocused) {
      setActivities([]);
      return;
    }

    let cancelled = false;
    const userId = session.user.id;

    async function fetchActivities() {
      try {
        const nextActivities = await listActivities(userId);
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
  }, [isFocused, plan?.id, session, syncRevision]);

  useEffect(() => {
    if (syncRevision === 0) return;
    refresh().catch((error) => {
      console.error('Failed to refresh plan after Strava sync:', error);
    });
  }, [refresh, syncRevision]);

  useEffect(() => {
    if (!plan || !currentWeek || !activeInjury || !weekStartDate) {
      setCrossTrainingEntries([]);
      setIsLoadingCrossTraining(false);
      return;
    }

    const recoveryWeekStartDate = weekStartDate;
    let cancelled = false;

    async function fetchCrossTraining() {
      try {
        setIsLoadingCrossTraining(true);
        const entries = await trpc.crossTraining.getForWeek.query({ weekStartDate: recoveryWeekStartDate });
        if (!cancelled) {
          setCrossTrainingEntries(entries);
        }
      } catch (error) {
        console.error('Failed to fetch cross-training entries for home view:', error);
        if (!cancelled) {
          setCrossTrainingEntries([]);
        }
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
  }, [activeInjury, currentWeek, plan, weekStartDate]);

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
  const resolvedWeekStartDate = weekStartDate ?? resolveCurrentWeekStartDate(week, today);
  const todaySession = findSessionForDateOrWeekday(week.sessions, today);
  const showFinishedRunCta = Boolean(
    todaySession && todaySession.type !== 'REST' && !todaySession.actualActivityId,
  );
  const steadyNote = todaySession ? plan.coachAnnotation : null;
  const coachNote = steadyNote && plan.coachAnnotation === steadyNote ? null : plan.coachAnnotation;

  async function handleSaveReassessedTarget(value: string) {
    try {
      setIsSavingGoal(true);
      await trpc.plan.updateInjury.mutate({ reassessedTarget: value });
      await refresh();
    } catch (error) {
      console.error('Failed to update reassessed target from home:', error);
      Alert.alert('Could not update goal', 'Please try again in a moment.');
    } finally {
      setIsSavingGoal(false);
    }
  }

  async function refreshCrossTraining() {
    const entries = await trpc.crossTraining.getForWeek.query({ weekStartDate: resolvedWeekStartDate });
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
      console.error('Failed to save cross-training entry from home:', error);
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
      console.error('Failed to delete cross-training entry from home:', error);
      Alert.alert('Could not delete entry', 'Please try again in a moment.');
    } finally {
      setDeletingEntryId(null);
    }
  }

  async function handleMarkRtrStepComplete() {
    if (!activeInjury) return;

    if (activeInjury.rtrStep >= 3) {
      setRecoveryModalMode('resume');
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
      console.error('Failed to update return-to-running progress from home:', error);
      Alert.alert('Could not update progress', 'Please try again in a moment.');
    } finally {
      setIsUpdatingRtr(false);
    }
  }

  async function handleMarkInjury(name: string) {
    try {
      setIsMutatingRecovery(true);
      await trpc.plan.markInjury.mutate({ name });
      await refresh();
      setRecoveryModalMode(null);
    } catch (error) {
      console.error('Failed to start recovery from home:', error);
      Alert.alert('Could not start recovery', 'Please try again in a moment.');
    } finally {
      setIsMutatingRecovery(false);
    }
  }

  async function handleEndRecovery(option: { type: 'current' } | { type: 'choose'; weekNumber: number }) {
    if (!plan) return;

    try {
      setIsMutatingRecovery(true);

      if (option.type === 'current') {
        await clearResumeWeekOverride(plan.id);
      } else {
        await setResumeWeekOverride(plan.id, option.weekNumber);
      }

      await trpc.plan.clearInjury.mutate();
      await refresh();
      setRecoveryModalMode(null);
    } catch (error) {
      console.error('Failed to end recovery from home:', error);
      Alert.alert('Could not end recovery', 'Please try again in a moment.');
    } finally {
      setIsMutatingRecovery(false);
    }
  }

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
            <Text style={styles.headerMeta}>{formatWeekRangeLabel(resolvedWeekStartDate)}</Text>
            <Text style={styles.headerKicker}>
              {activeInjury ? 'Recovery Mode' : formatPhaseHeading(week.weekNumber, week.phase)}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={syncing || isUpdatingRtr || isMutatingRecovery}
              onPress={() => setRecoveryModalMode(activeInjury ? 'resume' : 'mark')}
              style={({ pressed }) => [
                styles.headerAction,
                activeInjury && styles.headerActionActive,
                pressed && styles.headerActionPressed,
                (syncing || isUpdatingRtr || isMutatingRecovery) && styles.headerActionDisabled,
              ]}
            >
              <Text style={[styles.headerActionText, activeInjury && styles.headerActionTextActive]}>
                {activeInjury ? 'End recovery' : 'Mark injury'}
              </Text>
            </Pressable>
          </View>
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
                weekStartDate={resolvedWeekStartDate}
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
            <>
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
            </>
          )}
        </ScrollView>
        <RecoveryFlowModal
          visible={recoveryModalMode !== null}
          mode={recoveryModalMode ?? 'mark'}
          plan={plan}
          currentWeekNumber={week.weekNumber}
          injury={activeInjury}
          busy={syncing || isUpdatingRtr || isMutatingRecovery}
          onClose={() => setRecoveryModalMode(null)}
          onMarkInjury={handleMarkInjury}
          onEndRecovery={handleEndRecovery}
        />
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
