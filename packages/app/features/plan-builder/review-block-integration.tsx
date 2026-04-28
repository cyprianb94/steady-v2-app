import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  buildBlockReviewModel,
  type BlockReviewTab,
  type BlockReviewWeekModel,
  type PhaseConfig,
  type PlannedSession,
  type PlanWeek,
} from '@steady/types';
import {
  BlockReviewSurface,
  BlockReviewTabControl,
} from '../../components/block-review';
import { PhaseEditor } from '../../components/plan-builder/PhaseEditor';
import { Btn } from '../../components/ui/Btn';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { formatDistance } from '../../lib/units';
import { usePreferences } from '../../providers/preferences-context';

export type PlanBuilderReviewTab = BlockReviewTab;

export interface PlanBuilderReviewBlockProps {
  plan: PlanWeek[];
  template: (PlannedSession | null)[];
  weeks: number;
  phases: PhaseConfig;
  raceLabel: string;
  raceDate?: string;
  targetTime: string;
  progressionPct: number | null;
  progressionEveryWeeks: number;
  saving: boolean;
  activeTab?: PlanBuilderReviewTab;
  selectedWeekIndex?: number | null;
  onApplyProgression: (pct: number, everyWeeks?: number) => void;
  onChangePhases: (phases: PhaseConfig) => void;
  onTabChange?: (tab: PlanBuilderReviewTab) => void;
  onSelectWeek?: (weekIndex: number | null) => void;
  onEditSession: (weekIndex: number, dayIndex: number) => void;
  onMoveSession?: (weekIndex: number, fromDayIndex: number, toDayIndex: number) => void;
  rescheduleResetKey?: number;
  onSavePlan: () => void;
}

function PlanBuilderReviewBlock({
  plan,
  phases,
  raceLabel,
  raceDate,
  targetTime,
  progressionPct,
  progressionEveryWeeks,
  saving,
  activeTab,
  selectedWeekIndex,
  onApplyProgression,
  onChangePhases,
  onTabChange,
  onSelectWeek,
  onEditSession,
  onMoveSession,
  rescheduleResetKey,
  onSavePlan,
}: PlanBuilderReviewBlockProps) {
  const { units } = usePreferences();
  const [internalActiveTab, setInternalActiveTab] = useState<PlanBuilderReviewTab>('structure');
  const [isCustomising, setIsCustomising] = useState(false);
  const [customPct, setCustomPct] = useState('7');
  const [customEveryWeeks, setCustomEveryWeeks] = useState('2');
  const [isEditingPhases, setIsEditingPhases] = useState(false);
  const [isScrubbingVolumeChart, setIsScrubbingVolumeChart] = useState(false);
  const [isDraggingWeekSession, setIsDraggingWeekSession] = useState(false);
  const [internalSelectedWeekIndex, setInternalSelectedWeekIndex] = useState<number | null>(null);
  const resolvedActiveTab = activeTab ?? internalActiveTab;
  const resolvedSelectedWeekIndex =
    selectedWeekIndex !== undefined ? selectedWeekIndex : internalSelectedWeekIndex;

  const model = useMemo(() => buildBlockReviewModel({
    weeks: plan,
    phases,
    progressionPct: progressionPct ?? 0,
    progressionEveryWeeks,
  }), [phases, plan, progressionEveryWeeks, progressionPct]);

  function setReviewTab(tab: PlanBuilderReviewTab) {
    if (tab !== 'structure') {
      setIsEditingPhases(false);
    }

    if (onTabChange) {
      onTabChange(tab);
      return;
    }

    setInternalActiveTab(tab);
  }

  function handleWeekPress(week: BlockReviewWeekModel) {
    const nextWeekIndex =
      resolvedActiveTab === 'weeks' && resolvedSelectedWeekIndex === week.weekIndex
        ? null
        : week.weekIndex;

    if (onSelectWeek) {
      onSelectWeek(nextWeekIndex);
    } else {
      setInternalSelectedWeekIndex(nextWeekIndex);
    }
    setReviewTab('weeks');
  }

  function handleDayPress(week: BlockReviewWeekModel, dayIndex: number) {
    onEditSession(week.weekIndex, dayIndex);
  }

  function handleSelectProgression(pct: number, everyWeeks = 2) {
    onApplyProgression(pct, everyWeeks);
    setIsCustomising(false);
  }

  function handleChangeProgression() {
    setCustomPct(String(progressionPct ?? 7));
    setCustomEveryWeeks(String(progressionEveryWeeks));
    setIsCustomising(true);
  }

  function formatRaceDateLabel(date: string | undefined): string | null {
    if (!date) {
      return null;
    }

    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toLocaleDateString('en-GB', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  const raceDateLabel = formatRaceDateLabel(raceDate);

  const overload = {
    progressionPct,
    progressionEveryWeeks,
    isCustomising,
    customPct,
    customEveryWeeks,
    customOptions: [5, 7, 10, 12, 15],
    onSelectProgression: handleSelectProgression,
    onStartCustom: () => setIsCustomising(true),
    onCustomPctChange: setCustomPct,
    onCustomEveryWeeksChange: setCustomEveryWeeks,
    onChangeProgression: handleChangeProgression,
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>STEP 6 OF 6</Text>
        <Text style={styles.title}>Review your block</Text>
        <Text style={styles.subtitle}>
          {resolvedActiveTab === 'structure' ? (
            <>
              <Text>{raceLabel}</Text>
              {targetTime ? (
                <>
                  <Text> · </Text>
                  <Text style={styles.subtitleTarget}>{targetTime}</Text>
                </>
              ) : null}
              <Text> · {model.totalWeeks} weeks</Text>
              {raceDateLabel ? <Text> · {raceDateLabel}</Text> : null}
            </>
          ) : 'Tap a week to inspect or edit sessions.'}
        </Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        scrollEnabled={!isScrubbingVolumeChart && !isDraggingWeekSession}
      >
        {isEditingPhases && resolvedActiveTab === 'structure' ? (
          <View>
            <BlockReviewTabControl activeTab={resolvedActiveTab} onTabChange={setReviewTab} />
            <View style={styles.phaseEditorWrap}>
              <PhaseEditor
                phases={phases}
                totalWeeks={model.totalWeeks}
                onChange={onChangePhases}
                onDone={() => setIsEditingPhases(false)}
              />
            </View>
          </View>
        ) : (
          <BlockReviewSurface
            model={model}
            activeTab={resolvedActiveTab}
            onTabChange={setReviewTab}
            expandedWeekIndex={resolvedSelectedWeekIndex}
            onWeekPress={handleWeekPress}
            onDayPress={handleDayPress}
            onMoveSession={(week, fromDayIndex, toDayIndex) => {
              onMoveSession?.(week.weekIndex, fromDayIndex, toDayIndex);
            }}
            onWeekDragActiveChange={setIsDraggingWeekSession}
            rescheduleResetKey={rescheduleResetKey}
            onEditStructure={() => setIsEditingPhases(true)}
            onScrubActiveChange={setIsScrubbingVolumeChart}
            overload={overload}
            raceDate={raceDate}
            formatDistance={(km) => formatDistance(km, units)}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Btn
          title={
            resolvedActiveTab === 'structure'
              ? 'Review weeks →'
              : saving ? 'Saving...' : 'Save plan and start training →'
          }
          onPress={resolvedActiveTab === 'structure' ? () => setReviewTab('weeks') : onSavePlan}
          fullWidth
          disabled={saving}
        />
      </View>
    </View>
  );
}

export function getSharedPlanBuilderReviewComponent(): ComponentType<PlanBuilderReviewBlockProps> {
  return PlanBuilderReviewBlock;
}

type ComponentType<P> = React.ComponentType<P>;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 60,
    paddingBottom: 10,
  },
  step: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    color: C.ink,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
    marginTop: 3,
  },
  subtitleTarget: {
    fontFamily: FONTS.monoBold,
    color: C.navy,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  phaseEditorWrap: {
    marginTop: 10,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
});
