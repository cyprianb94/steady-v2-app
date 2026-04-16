import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { PlannedSession, SubjectiveInput, SubjectiveBreathing, SubjectiveLegs, SubjectiveOverall } from '@steady/types';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { C } from '../../constants/colours';
import { usePreferences } from '../../providers/preferences-context';
import {
  formatDistance,
  formatPace,
  formatSessionLabel,
  formatSessionTitle,
  formatStoredPace,
  formatWarmupCooldown,
} from '../../lib/units';

interface ActivitySummary {
  id: string;
  distance: number;
  avgPace: number; // seconds per km
  duration: number; // seconds
  avgHR?: number;
  elevationGain?: number;
  subjectiveInput?: SubjectiveInput;
}

interface TodayHeroCardProps {
  session: PlannedSession | null;
  activity?: ActivitySummary;
  steadyNote?: string | null;
  onPress?: () => void;
  onSteadyNotePress?: () => void;
  onSaveSubjectiveInput?: (input: SubjectiveInput) => void | Promise<void>;
  onDismissSubjectiveInput?: () => void | Promise<void>;
}

const PLANNED_CARD_BG: Record<Exclude<PlannedSession['type'], 'REST'>, string> = {
  EASY: '#E6F0EA',
  INTERVAL: '#F9E3DA',
  TEMPO: '#F1E8DA',
  LONG: '#E5ECF7',
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function formatSessionDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[value.getUTCDay()]}, ${MONTHS[value.getUTCMonth()]} ${value.getUTCDate()}`;
}

function plannedHeartRateZone(session: PlannedSession): string {
  switch (session.type) {
    case 'INTERVAL':
      return 'Zone 5';
    case 'TEMPO':
      return 'Zone 4';
    case 'LONG':
      return 'Zone 2';
    case 'EASY':
    default:
      return 'Zone 2';
  }
}

function titleCase(value: string): string {
  return value
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function SavedSubjectiveInput({ input }: { input: SubjectiveInput }) {
  return (
    <View style={styles.savedFeelGroup}>
      <Text style={styles.savedFeelTitle}>Saved feel</Text>
      <View style={styles.savedFeelChips}>
        <View style={styles.savedFeelChip}>
          <Text style={styles.savedFeelChipText}>Legs: {titleCase(input.legs)}</Text>
        </View>
        <View style={styles.savedFeelChip}>
          <Text style={styles.savedFeelChipText}>Breathing: {titleCase(input.breathing)}</Text>
        </View>
        <View style={styles.savedFeelChip}>
          <Text style={styles.savedFeelChipText}>Overall: {titleCase(input.overall)}</Text>
        </View>
      </View>
    </View>
  );
}

export function TodayHeroCard({
  session,
  activity,
  steadyNote,
  onPress,
  onSteadyNotePress,
  onSaveSubjectiveInput,
  onDismissSubjectiveInput,
}: TodayHeroCardProps) {
  const { units } = usePreferences();
  if (!session || session.type === 'REST') {
    return (
      <View style={[styles.card, { backgroundColor: '#F7F5F1' }]} testID="hero-card">
        <Text style={styles.restTitle}>Rest day</Text>
        <Text style={styles.restSubtitle}>Recovery is part of the plan. You earned this.</Text>
      </View>
    );
  }

  const meta = SESSION_TYPE[session.type];
  const isInterval = session.type === 'INTERVAL';
  const completed = !!session.actualActivityId;
  const savedSubjectiveInput = activity?.subjectiveInput;
  const showSubjectivePrompt =
    !!session.actualActivityId &&
    !savedSubjectiveInput &&
    Boolean(onSaveSubjectiveInput || onDismissSubjectiveInput);

  if (completed) {
    const content = (
      <>
        <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
        <Text style={styles.completedBadge}>Completed</Text>
        <Text style={[styles.mainStat, { color: meta.color }]}>
          {activity
            ? `${formatDistance(activity.distance, units)} @ ${formatPace(activity.avgPace, units)}`
            : formatSessionLabel(session, units)}
        </Text>
        {activity?.avgHR ? (
          <Text style={styles.extraText}>{activity.avgHR} bpm avg</Text>
        ) : null}
        {savedSubjectiveInput ? (
          <SavedSubjectiveInput input={savedSubjectiveInput} />
        ) : null}
        {showSubjectivePrompt ? (
          <SubjectiveInputPrompt
            onSave={onSaveSubjectiveInput}
            onDismiss={onDismissSubjectiveInput}
          />
        ) : null}
      </>
    );

    if (onPress) {
      return (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [
            styles.card,
            styles.completedCard,
            { backgroundColor: meta.bg },
            pressed && styles.cardPressed,
          ]}
          testID="hero-completed"
        >
          {content}
        </Pressable>
      );
    }

    return (
      <View style={[styles.card, styles.completedCard, { backgroundColor: meta.bg }]} testID="hero-completed">
        {content}
      </View>
    );
  }

  const plannedType = session.type as Exclude<PlannedSession['type'], 'REST'>;
  const steadyNoteContent = steadyNote ? (
    <>
      <View style={styles.steadyNoteMain}>
        <View style={[styles.steadyDot, { backgroundColor: meta.color }]} />
        <Text style={styles.steadyText}>
          <Text style={styles.steadyLabel}>Steady</Text>: {steadyNote}
        </Text>
      </View>
    </>
  ) : null;
  const plannedContent = (
    <>
      <View style={styles.topRow}>
        <Text
          style={[
            styles.typeLabel,
            styles.typeLabelChip,
            { color: C.surface, backgroundColor: meta.color, borderColor: meta.color },
          ]}
          testID="hero-type-chip"
        >
          {session.type}
        </Text>
        <Text style={styles.todayBadge}>TODAY</Text>
      </View>

      <Text style={[styles.mainTitle, { color: meta.color }]}>{formatSessionTitle(session, units)}</Text>
      <Text style={styles.dateText}>{formatSessionDate(session.date)}</Text>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>
            {isInterval ? `${session.reps}×${session.repDist}m` : formatDistance(session.distance ?? 0, units)}
          </Text>
          <Text style={styles.metricLabel}>{isInterval ? 'session' : 'distance'}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{formatStoredPace(session.pace, units)}</Text>
          <Text style={styles.metricLabel}>target pace</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{plannedHeartRateZone(session)}</Text>
          <Text style={styles.metricLabel}>heart rate</Text>
        </View>
      </View>

      {(session.warmup || session.cooldown) && (
        <View style={styles.extras}>
          {session.warmup ? (
            <Text style={styles.extraText}>{formatWarmupCooldown(session.warmup, units, 'warmup')}</Text>
          ) : null}
          {session.cooldown ? (
            <Text style={styles.extraText}>{formatWarmupCooldown(session.cooldown, units, 'cooldown')}</Text>
          ) : null}
        </View>
      )}
      {steadyNote ? (
        onSteadyNotePress ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSteadyNotePress}
            style={({ pressed }) => [styles.steadyNote, pressed && styles.steadyNotePressed]}
            testID="hero-steady-note"
          >
            {steadyNoteContent}
          </Pressable>
        ) : (
          <View style={styles.steadyNote} testID="hero-steady-note">
            {steadyNoteContent}
          </View>
        )
      ) : null}
      {showSubjectivePrompt ? (
        <SubjectiveInputPrompt
          onSave={onSaveSubjectiveInput}
          onDismiss={onDismissSubjectiveInput}
        />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          styles.plannedCard,
          { backgroundColor: PLANNED_CARD_BG[plannedType], borderColor: meta.color },
          pressed && styles.cardPressed,
        ]}
        testID="hero-card"
      >
        {plannedContent}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.card,
        styles.plannedCard,
        { backgroundColor: PLANNED_CARD_BG[plannedType], borderColor: meta.color },
      ]}
      testID="hero-card"
    >
      {plannedContent}
    </View>
  );
}

interface Option<T extends string> {
  label: string;
  value: T;
}

const LEG_OPTIONS: Option<SubjectiveLegs>[] = [
  { label: 'Fresh', value: 'fresh' },
  { label: 'Normal', value: 'normal' },
  { label: 'Heavy', value: 'heavy' },
  { label: 'Dead', value: 'dead' },
];

const BREATHING_OPTIONS: Option<SubjectiveBreathing>[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Controlled', value: 'controlled' },
  { label: 'Labored', value: 'labored' },
];

const OVERALL_OPTIONS: Option<SubjectiveOverall>[] = [
  { label: 'Could go again', value: 'could-go-again' },
  { label: 'Done', value: 'done' },
  { label: 'Shattered', value: 'shattered' },
];

function OptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionRow}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.optionButtons}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.optionButton, selected && styles.optionButtonSelected]}
            >
              <Text style={[styles.optionButtonText, selected && styles.optionButtonTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SubjectiveInputPrompt({
  onSave,
  onDismiss,
}: {
  onSave?: (input: SubjectiveInput) => void | Promise<void>;
  onDismiss?: () => void | Promise<void>;
}) {
  const [legs, setLegs] = useState<SubjectiveLegs>('normal');
  const [breathing, setBreathing] = useState<SubjectiveBreathing>('controlled');
  const [overall, setOverall] = useState<SubjectiveOverall>('done');

  return (
    <View style={styles.subjectivePrompt} testID="subjective-input-prompt">
      <View style={styles.promptHeader}>
        <View>
          <Text style={styles.promptTitle}>How did that feel?</Text>
          <Text style={styles.promptSubtitle}>Three quick taps for your coach.</Text>
        </View>
        {onDismiss ? (
          <Pressable onPress={onDismiss} style={styles.dismissButton}>
            <Text style={styles.dismissText}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <OptionRow label="Legs" options={LEG_OPTIONS} value={legs} onChange={setLegs} />
      <OptionRow
        label="Breathing"
        options={BREATHING_OPTIONS}
        value={breathing}
        onChange={setBreathing}
      />
      <OptionRow label="Overall" options={OVERALL_OPTIONS} value={overall} onChange={setOverall} />

      <Pressable
        onPress={() => onSave?.({ legs, breathing, overall })}
        style={styles.saveFeelButton}
      >
        <Text style={styles.saveFeelText}>Save feel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    minHeight: 180,
    justifyContent: 'center',
  },
  completedCard: {
    opacity: 0.9,
  },
  plannedCard: {
    borderWidth: 1.5,
  },
  cardPressed: {
    opacity: 0.84,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  typeLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  typeLabelChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  todayBadge: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.amber,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  completedBadge: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.forest,
    marginBottom: 6,
  },
  mainStat: {
    fontFamily: FONTS.serifBold,
    fontSize: 26,
    marginBottom: 12,
  },
  mainTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 30,
    marginBottom: 8,
  },
  dateText: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
    marginBottom: 16,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricValue: {
    fontFamily: FONTS.serifBold,
    fontSize: 20,
    color: C.ink,
    marginBottom: 2,
  },
  metricLabel: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    textTransform: 'lowercase',
  },
  extras: {
    flexDirection: 'row',
    gap: 12,
  },
  steadyNote: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(28,21,16,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  steadyNotePressed: {
    opacity: 0.8,
  },
  steadyNoteMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  steadyDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginTop: 7,
  },
  steadyLabel: {
    fontFamily: FONTS.sansSemiBold,
    color: C.ink,
  },
  steadyText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.ink2,
  },
  extraText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.ink2,
  },
  savedFeelGroup: {
    marginTop: 14,
    gap: 8,
  },
  savedFeelTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.ink2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  savedFeelChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  savedFeelChip: {
    borderWidth: 1,
    borderColor: 'rgba(28,21,16,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  savedFeelChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  subjectivePrompt: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(28,21,16,0.14)',
    gap: 10,
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  promptTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: C.ink,
  },
  promptSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.ink2,
    marginTop: 2,
  },
  dismissButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dismissText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.muted,
  },
  optionRow: {
    gap: 5,
  },
  optionLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.ink2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: 'rgba(28,21,16,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  optionButtonSelected: {
    backgroundColor: C.ink,
    borderColor: C.ink,
  },
  optionButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  optionButtonTextSelected: {
    color: C.surface,
  },
  saveFeelButton: {
    alignSelf: 'flex-start',
    marginTop: 2,
    backgroundColor: C.clay,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveFeelText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.surface,
  },
  restTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 24,
    color: C.ink,
    marginBottom: 6,
  },
  restSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
    lineHeight: 20,
  },
});
