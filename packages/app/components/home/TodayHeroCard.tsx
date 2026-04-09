import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { PlannedSession, SubjectiveInput, SubjectiveBreathing, SubjectiveLegs, SubjectiveOverall } from '@steady/types';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { C } from '../../constants/colours';

interface ActivitySummary {
  id: string;
  distance: number;
  avgPace: number; // seconds per km
  duration: number; // seconds
  avgHR?: number;
  elevationGain?: number;
}

interface TodayHeroCardProps {
  session: PlannedSession | null;
  activity?: ActivitySummary;
  steadyNote?: string | null;
  onPress?: () => void;
  onSaveSubjectiveInput?: (input: SubjectiveInput) => void | Promise<void>;
  onDismissSubjectiveInput?: () => void | Promise<void>;
}

function formatPace(secPerKm: number): string {
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.floor(secPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function plannedSummary(session: PlannedSession): string {
  if (session.type === 'INTERVAL') {
    return `${session.reps}×${session.repDist}m @ ${session.pace}`;
  }
  return `${session.distance}km @ ${session.pace}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function formatSessionDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[value.getUTCDay()]}, ${MONTHS[value.getUTCMonth()]} ${value.getUTCDate()}`;
}

function plannedTitle(session: PlannedSession): string {
  if (session.type === 'INTERVAL') {
    return `${session.reps}×${session.repDist}m Intervals`;
  }

  const typeTitle = session.type === 'TEMPO' ? 'Tempo' : SESSION_TYPE[session.type].label;
  return `${session.distance}km ${typeTitle}`;
}

export function TodayHeroCard({
  session,
  activity,
  steadyNote,
  onPress,
  onSaveSubjectiveInput,
  onDismissSubjectiveInput,
}: TodayHeroCardProps) {
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
  const showSubjectivePrompt =
    !!session.actualActivityId &&
    !session.subjectiveInput &&
    !session.subjectiveInputDismissed;

  if (completed) {
    return (
      <View style={[styles.card, styles.completedCard, { backgroundColor: meta.bg }]} testID="hero-completed">
        <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
        <Text style={styles.completedBadge}>Completed</Text>
        <Text style={[styles.mainStat, { color: meta.color }]}>
          {activity
            ? `${activity.distance.toFixed(1)}km @ ${formatPace(activity.avgPace)}`
            : plannedSummary(session)}
        </Text>
        {activity?.avgHR ? (
          <Text style={styles.extraText}>{activity.avgHR} bpm avg</Text>
        ) : null}
        {showSubjectivePrompt ? (
          <SubjectiveInputPrompt
            onSave={onSaveSubjectiveInput}
            onDismiss={onDismissSubjectiveInput}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: meta.bg }]} testID="hero-card">
      <View style={styles.topRow}>
        <Text style={[styles.typeLabel, styles.typeLabelChip, { color: meta.color, borderColor: `${meta.color}66` }]}>
          {session.type}
        </Text>
        <Text style={styles.todayBadge}>TODAY</Text>
      </View>

      <Text style={[styles.mainTitle, { color: meta.color }]}>{plannedTitle(session)}</Text>
      <Text style={styles.dateText}>{formatSessionDate(session.date)}</Text>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>
            {isInterval ? `${session.reps}×${session.repDist}m` : `${session.distance}km`}
          </Text>
          <Text style={styles.metricLabel}>{isInterval ? 'session' : 'distance'}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{session.pace}</Text>
          <Text style={styles.metricLabel}>{isInterval ? 'target pace' : 'target pace'}</Text>
        </View>
      </View>

      {(session.warmup || session.cooldown) && (
        <View style={styles.extras}>
          {session.warmup ? (
            <Text style={styles.extraText}>{session.warmup}km warmup</Text>
          ) : null}
          {session.cooldown ? (
            <Text style={styles.extraText}>{session.cooldown}km cooldown</Text>
          ) : null}
        </View>
      )}
      {steadyNote ? (
        <View style={styles.steadyNote}>
          <View style={[styles.steadyDot, { backgroundColor: meta.color }]} />
          <Text style={styles.steadyText}>
            <Text style={styles.steadyLabel}>Steady</Text>: {steadyNote}
          </Text>
        </View>
      ) : null}
      {showSubjectivePrompt ? (
        <SubjectiveInputPrompt
          onSave={onSaveSubjectiveInput}
          onDismiss={onDismissSubjectiveInput}
        />
      ) : null}
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
    color: C.ink2,
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
