import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Activity,
  PlannedSession,
  PlanWeek,
  RunFuelEvent,
  Shoe,
  SubjectiveBreathing,
  SubjectiveInput,
  SubjectiveLegs,
  SubjectiveOverall,
} from '@steady/types';
import { shoeLifetimeKm } from '@steady/types';
import { trpc } from '../../lib/trpc';
import { findSessionForDateOrWeekday, todayIsoLocal } from '../../lib/plan-helpers';
import { buildCurrentDisplayWeek } from '../run/display-week';
import { GEL_BRANDS } from '../fuelling/gel-catalogue';
import { suggestedBrands as buildSuggestedFuelBrands, uniqueRecentFuelGels } from '../fuelling/fuel-events';
import {
  type EditableNiggle,
  isActivityDateCompatibleWithSession,
  isRunnableSession,
  isSessionSelectable,
  listMatchableSessions,
  resolveDefaultMatchSessionId,
  shouldRefreshKilometreSplits,
  toEditableNiggles,
} from './sync-run-detail';

const RUN_DETAIL_LOAD_TIMEOUT_MS = 8000;

export interface RunDetailSaveFailureCopy {
  inline: string;
  alertTitle: string;
  alertBody: string;
}

export interface RunDetailControllerOptions {
  activityId: string | null;
  requestedSessionId: string | null;
  currentWeek: PlanWeek | null;
  refreshPlan: () => Promise<void>;
  onSaved: () => void;
  showAlert: (title: string, body: string) => void;
}

export function saveRunFailureCopy(error: unknown): RunDetailSaveFailureCopy {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('fuel_events') || message.toLowerCase().includes('fuel events')) {
    return {
      inline: 'Fuelling storage is not ready yet. Apply the latest database migration, then retry. Your notes and selections are still here.',
      alertTitle: 'Could not save fuelling',
      alertBody: 'The database is missing the fuelling column. Apply the latest migration, then retry.',
    };
  }

  return {
    inline: 'Could not save this run yet. Your notes and selections are still here so you can retry.',
    alertTitle: 'Could not save run',
    alertBody: 'Please try again in a moment.',
  };
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function useRunDetailController({
  activityId,
  requestedSessionId,
  currentWeek,
  refreshPlan,
  onSaved,
  showAlert,
}: RunDetailControllerOptions) {
  const splitRefreshAttemptedIds = useRef(new Set<string>());
  const [activity, setActivity] = useState<Activity | null>(null);
  const [fuelHistoryActivities, setFuelHistoryActivities] = useState<Activity[]>([]);
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fuelSliderActive, setFuelSliderActive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [planRefreshError, setPlanRefreshError] = useState<string | null>(null);
  const [draftSeedActivityId, setDraftSeedActivityId] = useState<string | null>(null);

  const [legs, setLegs] = useState<SubjectiveLegs | null>(null);
  const [breathing, setBreathing] = useState<SubjectiveBreathing | null>(null);
  const [overall, setOverall] = useState<SubjectiveOverall | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedShoeId, setSelectedShoeId] = useState<string | null>(null);
  const [niggles, setNiggles] = useState<EditableNiggle[]>([]);
  const [fuelEvents, setFuelEvents] = useState<RunFuelEvent[]>([]);

  const today = todayIsoLocal();
  const displayWeek = useMemo(
    () => (currentWeek ? buildCurrentDisplayWeek(currentWeek, today) : null),
    [currentWeek, today],
  );
  const todaySession = findSessionForDateOrWeekday(displayWeek?.sessions ?? [], today);
  const sessionOptions = useMemo(
    () => listMatchableSessions(displayWeek?.sessions ?? [], today),
    [displayWeek?.sessions, today],
  );
  const requestedSession = useMemo(
    () => sessionOptions.find((session) => session.id === requestedSessionId) ?? null,
    [requestedSessionId, sessionOptions],
  );
  const recommendedSessionId = useMemo(
    () => resolveDefaultMatchSessionId({
      activity,
      preferredSession: requestedSession,
      today,
      todaySession: isRunnableSession(todaySession) ? todaySession : null,
      sessionOptions,
    }),
    [activity, requestedSession, sessionOptions, today, todaySession],
  );
  const selectedSession = sessionOptions.find((session) => session.id === selectedSessionId) ?? null;
  const selectedShoe = shoes.find((shoe) => shoe.id === selectedShoeId) ?? null;
  const selectedShoeLifetimeKm = selectedShoe ? shoeLifetimeKm(selectedShoe) : 0;
  const matchedSession = activity?.matchedSessionId
    ? sessionOptions.find((session) => session.id === activity.matchedSessionId) ?? null
    : null;
  const hasStaleMatchedSession = Boolean(
    activity?.matchedSessionId
      && (
        !matchedSession
        || !isSessionSelectable(matchedSession, activity.id)
        || !isActivityDateCompatibleWithSession(activity, matchedSession)
      ),
  );
  const feelComplete = legs !== null && breathing !== null && overall !== null;
  const subjectiveInput: SubjectiveInput | undefined = feelComplete
    ? { legs: legs!, breathing: breathing!, overall: overall! }
    : undefined;
  const canSave = feelComplete && !saving;
  const fuelHistory = useMemo(
    () => activity
      ? [
          { ...activity, fuelEvents },
          ...fuelHistoryActivities.filter((historyActivity) => historyActivity.id !== activity.id),
        ]
      : fuelHistoryActivities,
    [activity, fuelEvents, fuelHistoryActivities],
  );
  const recentFuelGels = useMemo(
    () => uniqueRecentFuelGels(fuelHistory),
    [fuelHistory],
  );
  const suggestedFuelBrands = useMemo(
    () => buildSuggestedFuelBrands(recentFuelGels, GEL_BRANDS),
    [recentFuelGels],
  );

  useEffect(() => {
    setDraftSeedActivityId(null);
  }, [activityId]);

  useEffect(() => {
    if (!activityId) {
      setActivity(null);
      setShoes([]);
      setLoadError('We could not find that run. Go back and open it again.');
      setLoading(false);
      return;
    }

    const resolvedActivityId = activityId;
    let cancelled = false;

    async function loadDetail() {
      try {
        setLoading(true);
        setLoadError(null);
        setShoes([]);
        setFuelHistoryActivities([]);
        const nextActivity = await withTimeout(
          trpc.activity.get.query({ activityId: resolvedActivityId }),
          RUN_DETAIL_LOAD_TIMEOUT_MS,
          'sync-run detail activity fetch',
        );
        if (cancelled) {
          return;
        }
        setActivity(nextActivity);
        void withTimeout(
          trpc.shoe.list.query(),
          RUN_DETAIL_LOAD_TIMEOUT_MS,
          'sync-run detail shoe fetch',
        )
          .then((nextShoes) => {
            if (!cancelled) {
              setShoes(nextShoes);
            }
          })
          .catch((error) => {
            console.warn('Failed to load shoes for sync-run detail:', error);
            if (!cancelled) {
              setShoes([]);
            }
          });
        void withTimeout(
          trpc.activity.list.query(),
          RUN_DETAIL_LOAD_TIMEOUT_MS,
          'sync-run detail activity history fetch',
        )
          .then((activities) => {
            if (!cancelled) {
              setFuelHistoryActivities(activities);
            }
          })
          .catch((error) => {
            console.warn('Failed to load activity history for run fuelling:', error);
            if (!cancelled) {
              setFuelHistoryActivities(nextActivity ? [nextActivity] : []);
            }
          });
      } catch (error) {
        console.warn('Failed to load sync-run detail activity:', error);
        if (!cancelled) {
          setActivity(null);
          setFuelHistoryActivities([]);
          setLoadError('We could not refresh this run. Try again or go back to the picker.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetail().catch((error) => {
      console.warn('Failed to initialize sync-run detail:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [activityId]);

  useEffect(() => {
    if (!activity || draftSeedActivityId === activity.id) {
      return;
    }

    setSelectedSessionId(recommendedSessionId);
    setSelectedShoeId(activity.shoeId ?? null);
    setNiggles(toEditableNiggles(activity.niggles));
    setFuelEvents(activity.fuelEvents ?? []);
    setNotes(activity.notes ?? '');
    setLegs(activity.subjectiveInput?.legs ?? null);
    setBreathing(activity.subjectiveInput?.breathing ?? null);
    setOverall(activity.subjectiveInput?.overall ?? null);
    setDraftSeedActivityId(activity.id);
  }, [activity, draftSeedActivityId, recommendedSessionId]);

  useEffect(() => {
    if (!activity || !shouldRefreshKilometreSplits(activity, selectedSession)) {
      return;
    }

    if (splitRefreshAttemptedIds.current.has(activity.id)) {
      return;
    }

    splitRefreshAttemptedIds.current.add(activity.id);
    let cancelled = false;

    void withTimeout(
      trpc.strava.refreshActivity.mutate({ activityId: activity.id }),
      RUN_DETAIL_LOAD_TIMEOUT_MS,
      'sync-run detail split refresh',
    )
      .then((refreshedActivity) => {
        if (!cancelled) {
          setActivity((current) => (current?.id === activity.id ? refreshedActivity : current));
        }
      })
      .catch((error) => {
        console.warn('Failed to refresh kilometre splits for run detail:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [activity, selectedSession]);

  async function reloadDetail() {
    if (!activityId) {
      setActivity(null);
      setShoes([]);
      setLoadError('We could not find that run. Go back and open it again.');
      setLoading(false);
      return;
    }

    const resolvedActivityId = activityId;
    try {
      setLoading(true);
      setLoadError(null);
      const nextActivity = await withTimeout(
        trpc.activity.get.query({ activityId: resolvedActivityId }),
        RUN_DETAIL_LOAD_TIMEOUT_MS,
        'sync-run detail activity fetch',
      );
      setActivity(nextActivity);
      void withTimeout(
        trpc.shoe.list.query(),
        RUN_DETAIL_LOAD_TIMEOUT_MS,
        'sync-run detail shoe fetch',
      )
        .then((nextShoes) => {
          setShoes(nextShoes);
        })
        .catch((error) => {
          console.warn('Failed to reload shoes for sync-run detail:', error);
          setShoes([]);
        });
      void withTimeout(
        trpc.activity.list.query(),
        RUN_DETAIL_LOAD_TIMEOUT_MS,
        'sync-run detail activity history fetch',
      )
        .then((activities) => {
          setFuelHistoryActivities(activities);
        })
        .catch((error) => {
          console.warn('Failed to reload activity history for run fuelling:', error);
          setFuelHistoryActivities(nextActivity ? [nextActivity] : []);
        });
    } catch (error) {
      console.warn('Failed to load sync-run detail activity:', error);
      setActivity(null);
      setFuelHistoryActivities([]);
      setLoadError('We could not refresh this run. Try again or go back to the picker.');
    } finally {
      setLoading(false);
    }
  }

  async function saveRunDetail() {
    if (!activity || !subjectiveInput) return;

    setSaveError(null);
    setPlanRefreshError(null);

    const replacingRequestedSessionMatch = Boolean(
      selectedSession
      && requestedSession
      && selectedSession.id === requestedSession.id
      && selectedSession.actualActivityId
      && selectedSession.actualActivityId !== activity.id,
    );

    if (selectedSession && !isSessionSelectable(selectedSession, activity.id) && !replacingRequestedSessionMatch) {
      setSaveError('That session is already linked to another run. Pick a different session or save this as a bonus run.');
      showAlert('Choose a different session', 'That planned session is already linked to another run.');
      return;
    }

    try {
      setSaving(true);
      const result = await trpc.activity.saveRunDetail.mutate({
        activityId: activity.id,
        subjectiveInput,
        niggles,
        fuelEvents,
        notes: notes.trim() || undefined,
        shoeId: selectedShoeId,
        matchedSessionId: selectedSessionId,
        replaceExistingMatch: replacingRequestedSessionMatch,
      });

      setActivity({ ...result.activity, niggles: result.niggles });
    } catch (error) {
      console.warn('Failed to save synced run:', error);
      const failureCopy = saveRunFailureCopy(error);
      setSaveError(failureCopy.inline);
      showAlert(failureCopy.alertTitle, failureCopy.alertBody);
      setSaving(false);
      return;
    }

    try {
      await refreshPlan();
    } catch (error) {
      console.warn('Saved run but failed to refresh the plan:', error);
      setPlanRefreshError('Run saved. We will refresh the plan when you return home.');
      showAlert('Run saved', 'We could not refresh the plan yet, but your run was saved.');
    } finally {
      setSaving(false);
    }

    onSaved();
  }

  return {
    activity,
    shoes,
    loading,
    saving,
    fuelSliderActive,
    setFuelSliderActive,
    loadError,
    saveError,
    planRefreshError,
    today,
    todaySession,
    sessionOptions,
    requestedSession,
    recommendedSessionId,
    selectedSession,
    selectedSessionId,
    setSelectedSessionId,
    selectedShoe,
    selectedShoeId,
    setSelectedShoeId,
    selectedShoeLifetimeKm,
    hasStaleMatchedSession,
    legs,
    setLegs,
    breathing,
    setBreathing,
    overall,
    setOverall,
    notes,
    setNotes,
    niggles,
    setNiggles,
    fuelEvents,
    setFuelEvents,
    recentFuelGels,
    suggestedFuelBrands,
    feelComplete,
    canSave,
    reloadDetail,
    saveRunDetail,
    waitingForCurrentDraft: Boolean(activity && draftSeedActivityId !== activity.id),
  };
}
