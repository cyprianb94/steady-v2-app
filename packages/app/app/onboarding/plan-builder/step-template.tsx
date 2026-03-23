import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { C } from '../../../constants/colours';
import { SESSION_TYPE } from '../../../constants/session-types';
import { FONTS } from '../../../constants/typography';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { Btn } from '../../../components/ui/Btn';
import { SessionEditor } from '../../../components/plan-builder/SessionEditor';
import { DAYS, sessionLabel, TYPE_DEFAULTS } from '../../../lib/plan-helpers';
import { sessionKm } from '@steady/server/src/lib/session-km';
import type { PlannedSession } from '@steady/types';

const DEFAULT_TEMPLATE: (Partial<PlannedSession> | null)[] = [
  { type: 'EASY', distance: 8, pace: '5:20' },
  { type: 'INTERVAL', reps: 6, repDist: 800, pace: '3:50', recovery: '90s', warmup: 1.5, cooldown: 1 },
  { type: 'EASY', distance: 8, pace: '5:30' },
  { type: 'TEMPO', distance: 10, pace: '4:20', warmup: 2, cooldown: 1.5 },
  null,
  { type: 'EASY', distance: 12, pace: '5:20' },
  { type: 'LONG', distance: 20, pace: '5:10' },
];

export default function StepTemplate() {
  const params = useLocalSearchParams<{ race: string; weeks: string; target: string; phases: string }>();
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [editing, setEditing] = useState<number | null>(null);

  const totalKm = template.reduce((acc, s) => acc + sessionKm(s as PlannedSession | null), 0);
  const weeks = Number(params.weeks) || 16;

  const handleSave = (dayIndex: number, session: Partial<PlannedSession> | null) => {
    const t = [...template];
    t[dayIndex] = session;
    setTemplate(t);
    setEditing(null);
  };

  const handleNext = () => {
    router.push({
      pathname: '/onboarding/plan-builder/step-plan',
      params: {
        ...params,
        template: JSON.stringify(template),
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>STEP 2 OF 3</Text>
        <Text style={styles.title}>Design your week</Text>
        <Text style={styles.subtitle}>
          This pattern repeats across all {weeks} weeks. Tap any day to adjust.
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoDot} />
          <Text style={styles.infoText}>
            <Text style={styles.infoStrong}>Steady</Text> — This is your base week. It repeats across
            all {weeks} weeks — you'll be able to fine-tune each week individually in the next step.
          </Text>
        </View>

        {/* Day cards */}
        {DAYS.map((day, i) => {
          const s = template[i];
          const isRest = !s || s.type === 'REST';
          const tc = s ? SESSION_TYPE[s.type as keyof typeof SESSION_TYPE] : null;

          return (
            <Pressable
              key={day}
              onPress={() => setEditing(i)}
              style={[
                styles.dayCard,
                {
                  backgroundColor: isRest ? C.cream : tc?.bg || C.cream,
                  borderColor: isRest ? C.border : `${tc?.color}35`,
                },
              ]}
            >
              <View style={styles.dayLabel}>
                <Text style={[styles.dayName, { color: isRest ? C.muted : tc?.color }]}>
                  {day}
                </Text>
              </View>
              {isRest ? (
                <>
                  <Text style={styles.restText}>Rest day</Text>
                  <Text style={styles.addIcon}>+</Text>
                </>
              ) : (
                <>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionMain} numberOfLines={1}>
                      {sessionLabel(s)}
                    </Text>
                    <Text style={styles.sessionType}>{tc?.label}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </>
              )}
            </Pressable>
          );
        })}

        {/* Volume summary */}
        <View style={styles.volumeCard}>
          <Text style={styles.volumeLabel}>Template volume</Text>
          <Text style={styles.volumeValue}>~{Math.round(totalKm)}km / week</Text>
        </View>
        <Text style={styles.volumeNote}>
          Includes warm-up, cool-down and recovery jogs between reps
        </Text>
      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <Btn title={`Generate ${weeks}-week plan →`} onPress={handleNext} fullWidth />
      </View>

      {/* Session editor modal */}
      {editing !== null && (
        <SessionEditor
          dayIndex={editing}
          existing={template[editing]}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 60,
    paddingBottom: 8,
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
    fontSize: 24,
    color: C.ink,
    marginBottom: 4,
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 20,
  },
  infoCard: {
    backgroundColor: C.forestBg,
    borderWidth: 1,
    borderColor: `${C.forest}25`,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  infoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.forest,
    marginTop: 5,
  },
  infoText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    color: C.ink2,
    lineHeight: 19,
  },
  infoStrong: {
    color: C.forest,
    fontWeight: '600',
  },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 6,
  },
  dayLabel: {
    width: 30,
  },
  dayName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  restText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: C.muted,
  },
  addIcon: {
    fontFamily: FONTS.sans,
    fontSize: 20,
    color: C.border,
  },
  sessionInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  sessionMain: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12.5,
    color: C.ink,
  },
  sessionType: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    marginTop: 1,
  },
  chevron: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
  },
  volumeCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  volumeLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  volumeValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.clay,
  },
  volumeNote: {
    fontFamily: FONTS.sans,
    fontSize: 10.5,
    color: C.muted,
    marginTop: 6,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
});
