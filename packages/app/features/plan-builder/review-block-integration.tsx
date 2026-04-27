import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  buildBlockReviewModel,
  type BlockReviewTab,
  type BlockReviewWeekModel,
  type PhaseConfig,
  type PlannedSession,
  type PlanWeek,
} from '@steady/types';
import { BlockReviewSurface } from '../../components/block-review';
import { Btn } from '../../components/ui/Btn';
import { SessionDot } from '../../components/ui/SessionDot';
import { C } from '../../constants/colours';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { DAYS, sessionLabel } from '../../lib/plan-helpers';
import { formatDistance } from '../../lib/units';
import { usePreferences } from '../../providers/preferences-context';

export interface PlanBuilderReviewBlockProps {
  plan: PlanWeek[];
  template: (PlannedSession | null)[];
  weeks: number;
  phases: PhaseConfig;
  raceLabel: string;
  targetTime: string;
  progressionPct: number | null;
  saving: boolean;
  activeTab?: BlockReviewTab;
  selectedWeekIndex?: number | null;
  onApplyProgression: (pct: number) => void;
  onChangeProgression?: () => void;
  onTabChange?: (tab: BlockReviewTab) => void;
  onSelectWeek?: (weekIndex: number) => void;
  onEditSession: (weekIndex: number, dayIndex: number) => void;
  onSavePlan: () => void;
}

function PlanBuilderReviewBlock({
  plan,
  phases,
  raceLabel,
  targetTime,
  progressionPct,
  saving,
  activeTab,
  selectedWeekIndex,
  onApplyProgression,
  onChangeProgression,
  onTabChange,
  onSelectWeek,
  onEditSession,
  onSavePlan,
}: PlanBuilderReviewBlockProps) {
  const { units } = usePreferences();
  const [internalActiveTab, setInternalActiveTab] = useState<BlockReviewTab>('overview');
  const [isCustomising, setIsCustomising] = useState(false);
  const [customPct, setCustomPct] = useState('7');
  const [internalSelectedWeekIndex, setInternalSelectedWeekIndex] = useState<number | null>(null);
  const resolvedActiveTab = activeTab ?? internalActiveTab;
  const resolvedSelectedWeekIndex =
    selectedWeekIndex !== undefined ? selectedWeekIndex : internalSelectedWeekIndex;

  const model = useMemo(() => buildBlockReviewModel({
    weeks: plan,
    phases,
    progressionPct: progressionPct ?? 0,
  }), [phases, plan, progressionPct]);

  const selectedWeek = resolvedSelectedWeekIndex == null ? null : plan[resolvedSelectedWeekIndex] ?? null;

  function setReviewTab(tab: BlockReviewTab) {
    if (onTabChange) {
      onTabChange(tab);
      return;
    }

    setInternalActiveTab(tab);
  }

  function handleWeekPress(week: BlockReviewWeekModel) {
    if (onSelectWeek) {
      onSelectWeek(week.weekIndex);
    } else {
      setInternalSelectedWeekIndex(week.weekIndex);
    }
    setReviewTab('weeks');
  }

  function handleSelectProgression(pct: number) {
    onApplyProgression(pct);
    setIsCustomising(false);
  }

  function handleChangeProgression() {
    setIsCustomising(false);
    onChangeProgression?.();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>STEP 6 OF 6</Text>
        <Text style={styles.title}>Review your block</Text>
        <Text style={styles.subtitle}>
          {raceLabel} · {targetTime} · {model.structureLabel}
        </Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <BlockReviewSurface
          model={model}
          activeTab={resolvedActiveTab}
          onTabChange={setReviewTab}
          onWeekPress={handleWeekPress}
          overload={{
            progressionPct,
            isCustomising,
            customPct,
            onSelectProgression: handleSelectProgression,
            onStartCustom: () => setIsCustomising(true),
            onCustomPctChange: setCustomPct,
            onChangeProgression: handleChangeProgression,
          }}
          formatDistance={(km) => formatDistance(km, units)}
        />

        {selectedWeek ? (
          <SelectedWeekEditor
            week={selectedWeek}
            weekIndex={resolvedSelectedWeekIndex ?? 0}
            onEditSession={onEditSession}
          />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Btn
          title={saving ? 'Saving...' : 'Save plan and start training →'}
          onPress={onSavePlan}
          fullWidth
          disabled={saving}
        />
      </View>
    </View>
  );
}

function SelectedWeekEditor({
  week,
  weekIndex,
  onEditSession,
}: {
  week: PlanWeek;
  weekIndex: number;
  onEditSession: (weekIndex: number, dayIndex: number) => void;
}) {
  const { units } = usePreferences();

  return (
    <View style={styles.editCard} testID={`plan-week-${week.weekNumber}-editor`}>
      <View style={styles.editHead}>
        <Text style={styles.editTitle}>Edit W{week.weekNumber}</Text>
        <Text style={styles.editMeta}>Any change will ask where to apply.</Text>
      </View>

      {week.sessions.map((session, dayIndex) => (
        <Pressable
          key={`${week.weekNumber}-${dayIndex}`}
          testID={`plan-week-${week.weekNumber}-day-${dayIndex}`}
          onPress={() => onEditSession(weekIndex, dayIndex)}
          style={({ pressed }) => [
            styles.sessionRow,
            pressed && styles.sessionRowPressed,
          ]}
        >
          <Text style={styles.dayLabel}>{DAYS[dayIndex]}</Text>
          <View style={styles.sessionMain}>
            <SessionDot type={session?.type ?? 'REST'} size={8} />
            <View style={styles.sessionCopy}>
              <Text style={styles.sessionTitle} numberOfLines={1}>
                {session && session.type !== 'REST' ? sessionLabel(session, units) : 'Rest day'}
              </Text>
              <Text style={styles.sessionMeta} numberOfLines={1}>
                {session && session.type !== 'REST' ? SESSION_TYPE[session.type].label : 'Recovery'}
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function getSharedPlanBuilderReviewComponent():
  | ComponentType<PlanBuilderReviewBlockProps>
  | null {
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
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  editCard: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 6,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
  },
  editHead: {
    marginBottom: 5,
  },
  editTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 18,
    color: C.ink,
  },
  editMeta: {
    fontFamily: FONTS.sans,
    fontSize: 10.5,
    color: C.muted,
    marginTop: 1,
  },
  sessionRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  sessionRowPressed: {
    opacity: 0.7,
  },
  dayLabel: {
    width: 34,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.muted,
  },
  sessionMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionCopy: {
    flex: 1,
    minWidth: 0,
  },
  sessionTitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12.5,
    color: C.ink,
  },
  sessionMeta: {
    fontFamily: FONTS.sans,
    fontSize: 10.5,
    color: C.muted,
    marginTop: 1,
  },
  chevron: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: C.muted,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
});
