import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PropagateModal } from '../../../components/plan-builder/PropagateModal';
import { SessionEditorScreen } from '../../../components/plan-builder/SessionEditorScreen';
import { assignDates, generatePlan, propagateChange, propagateSwap } from '@steady/types';
import type { PhaseConfig, PlannedSession, PlanWeek, PropagateScope } from '@steady/types';
import {
  buildSessionEditDescription,
  materializeEditedSession,
  parseTrainingPaceProfileRouteParam,
} from '../../../features/plan-builder/session-editing';
import {
  getSharedPlanBuilderReviewComponent,
  type PlanBuilderReviewTab,
} from '../../../features/plan-builder/review-block-integration';
import { savePlan } from '../../../lib/plan-api';
import { usePreferences } from '../../../providers/preferences-context';

interface EditingSession {
  weekIndex: number;
  dayIndex: number;
}

interface PendingEdit extends EditingSession {
  updated: Partial<PlannedSession> | null;
  desc: string;
}

interface PendingRearrange {
  weekIndex: number;
  fromDayIndex: number;
  toDayIndex: number;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function StepPlan() {
  const { units } = usePreferences();
  const params = useLocalSearchParams<{
    raceDistance: string;
    raceLabel: string;
    raceName: string;
    raceDate: string;
    weeks: string;
    targetTime: string;
    phases: string;
    template: string;
    trainingPaceProfile?: string | string[];
  }>();

  const weeks = Number(params.weeks) || 16;
  const routePhases: PhaseConfig = JSON.parse(params.phases || '{}');
  const template: (PlannedSession | null)[] = JSON.parse(params.template || '[]');
  const trainingPaceProfile = parseTrainingPaceProfileRouteParam(params.trainingPaceProfile);

  const [phaseState, setPhaseState] = useState<PhaseConfig>(() => routePhases);
  const [plan, setPlan] = useState<PlanWeek[]>(() => generatePlan(template, weeks, 0, routePhases));
  const [progState, setProgState] = useState<number | null>(null);
  const [progEveryWeeks, setProgEveryWeeks] = useState(2);
  const [editing, setEditing] = useState<EditingSession | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [pendingRearrange, setPendingRearrange] = useState<PendingRearrange | null>(null);
  const [rescheduleResetKey, setRescheduleResetKey] = useState(0);
  const [reviewActiveTab, setReviewActiveTab] = useState<PlanBuilderReviewTab>('structure');
  const [reviewSelectedWeekIndex, setReviewSelectedWeekIndex] = useState<number | null>(null);

  const accept = (pct: number, everyWeeks = 2) => {
    const safePct = clampNumber(Math.round(pct), 0, 30);
    const safeEveryWeeks = clampNumber(Math.round(everyWeeks), 1, 12);
    setPlan(generatePlan(template, weeks, safePct, phaseState, safeEveryWeeks));
    setProgState(safePct);
    setProgEveryWeeks(safeEveryWeeks);
  };

  const handlePhasesChange = (nextPhases: PhaseConfig) => {
    setPhaseState(nextPhases);
    setPlan(generatePlan(template, weeks, progState ?? 0, nextPhases, progEveryWeeks));
  };

  function openSessionEditor(weekIndex: number, dayIndex: number) {
    setEditing({ weekIndex, dayIndex });
  }

  function handleEditorSave(dayIndex: number, updated: Partial<PlannedSession> | null) {
    if (!editing) {
      return;
    }

    setPendingEdit({
      weekIndex: editing.weekIndex,
      dayIndex,
      updated,
      desc: buildSessionEditDescription(dayIndex, updated, units),
    });
    setEditing(null);
  }

  function stageSessionMove(
    weekIndex: number,
    fromDayIndex: number,
    toDayIndex: number,
  ) {
    if (fromDayIndex === toDayIndex) {
      return;
    }

    setPendingRearrange({
      weekIndex,
      fromDayIndex,
      toDayIndex,
    });
  }

  function applyPendingRearrange(scope: PropagateScope) {
    if (!pendingRearrange) {
      return;
    }

    setPlan((prev) => {
      const sourceWeek = prev[pendingRearrange.weekIndex];
      if (!sourceWeek) {
        return prev;
      }

      return propagateSwap(
        prev,
        pendingRearrange.weekIndex,
        pendingRearrange.fromDayIndex,
        pendingRearrange.toDayIndex,
        scope,
        sourceWeek.phase,
      );
    });
    setPendingRearrange(null);
  }

  function closePendingRearrange() {
    setPendingRearrange(null);
    setRescheduleResetKey((current) => current + 1);
  }

  function applyPendingEdit(scope: PropagateScope) {
    if (!pendingEdit) {
      return;
    }

    setPlan((prev) => {
      const sourceWeek = prev[pendingEdit.weekIndex];
      if (!sourceWeek) {
        return prev;
      }

      const existing = sourceWeek.sessions[pendingEdit.dayIndex] ?? null;
      const updatedSession = materializeEditedSession(existing, pendingEdit.updated, {
        id: existing?.id ?? `preview-w${pendingEdit.weekIndex + 1}d${pendingEdit.dayIndex}`,
        date: existing?.date ?? 'preview',
        type: existing?.type ?? 'EASY',
      });

      return propagateChange(
        prev,
        pendingEdit.weekIndex,
        pendingEdit.dayIndex,
        updatedSession,
        scope,
        template,
        sourceWeek.phase,
      );
    });

    setPendingEdit(null);
  }

  const SharedReviewBlock = getSharedPlanBuilderReviewComponent();

  const [saving, setSaving] = useState(false);

  const handleDone = async () => {
    setSaving(true);
    try {
      const raceDate = params.raceDate || new Date().toISOString().slice(0, 10);
      const datedWeeks = assignDates(plan, raceDate);
      await savePlan({
        raceName: params.raceName || params.raceLabel || params.raceDistance || 'Race',
        raceDate,
        raceDistance: (params.raceDistance as any) || 'Marathon',
        targetTime: params.targetTime || '',
        phases: phaseState,
        progressionPct: progState ?? 0,
        progressionEveryWeeks: progEveryWeeks,
        templateWeek: template,
        weeks: datedWeeks,
        trainingPaceProfile,
      });
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error('Failed to save plan:', err);
      Alert.alert(
        'Could not save plan',
        err instanceof Error
          ? err.message
          : 'Please make sure you are signed in and the server is running.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <SessionEditorScreen
        dayIndex={editing.dayIndex}
        existing={plan[editing.weekIndex]?.sessions[editing.dayIndex] ?? null}
        trainingPaceProfile={trainingPaceProfile}
        onSave={handleEditorSave}
        onClose={() => setEditing(null)}
      />
    );
  }

  const pendingEditModal = pendingEdit ? (
    <PropagateModal
      changeDesc={pendingEdit.desc}
      weekIndex={pendingEdit.weekIndex}
      totalWeeks={plan.length}
      phaseName={plan[pendingEdit.weekIndex]?.phase ?? 'BUILD'}
      phaseWeekCount={plan.filter((week) => week.phase === plan[pendingEdit.weekIndex]?.phase).length}
      onApply={applyPendingEdit}
      onClose={() => setPendingEdit(null)}
    />
  ) : null;

  const pendingRearrangeModal = pendingRearrange ? (
    <PropagateModal
      weekIndex={pendingRearrange.weekIndex}
      totalWeeks={plan.length}
      phaseName={plan[pendingRearrange.weekIndex]?.phase ?? 'BUILD'}
      phaseWeekCount={plan.filter((week) => week.phase === plan[pendingRearrange.weekIndex]?.phase).length}
      title="Where should this reschedule apply?"
      body="You rearranged this week. Choose whether that day order stays local or carries into the matching part of the plan."
      applyLabel="Apply reschedule"
      scopeLabels={{
        this: 'Just this week',
        remaining: 'This week + following weeks',
        build: `${plan[pendingRearrange.weekIndex]?.phase ?? 'Build'} weeks only`,
      }}
      onApply={applyPendingRearrange}
      onClose={closePendingRearrange}
    />
  ) : null;

  return (
    <>
      <SharedReviewBlock
        plan={plan}
        template={template}
        weeks={weeks}
        phases={phaseState}
        raceLabel={params.raceLabel || params.raceDistance || 'Race'}
        raceDate={params.raceDate}
        targetTime={params.targetTime || ''}
        progressionPct={progState}
        progressionEveryWeeks={progEveryWeeks}
        saving={saving}
        activeTab={reviewActiveTab}
        selectedWeekIndex={reviewSelectedWeekIndex}
        onApplyProgression={accept}
        onChangePhases={handlePhasesChange}
        onTabChange={setReviewActiveTab}
        onSelectWeek={setReviewSelectedWeekIndex}
        onEditSession={openSessionEditor}
        onMoveSession={stageSessionMove}
        rescheduleResetKey={rescheduleResetKey}
        onSavePlan={handleDone}
      />
      {pendingEditModal}
      {pendingRearrangeModal}
    </>
  );
}
