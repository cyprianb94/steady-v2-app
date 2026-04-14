import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { C } from '../../../constants/colours';
import { SESSION_TYPE } from '../../../constants/session-types';
import { FONTS } from '../../../constants/typography';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { Btn } from '../../../components/ui/Btn';
import { RearrangeSheet } from '../../../components/block/RearrangeSheet';
import { SessionEditor } from '../../../components/plan-builder/SessionEditor';
import { DAYS, sessionLabel, TYPE_DEFAULTS } from '../../../lib/plan-helpers';
import { sessionKm } from '@steady/types';
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

function toRearrangeSessions(template: (Partial<PlannedSession> | null)[]): (PlannedSession | null)[] {
  return template.map((session, index) => {
    if (!session || session.type === 'REST') return null;
    return {
      id: `template-${index}`,
      date: 'template',
      type: session.type ?? 'EASY',
      ...session,
    } as PlannedSession;
  });
}

function toTemplateSessions(sessions: (PlannedSession | null)[]): (Partial<PlannedSession> | null)[] {
  return sessions.map((session) => {
    if (!session || session.type === 'REST') return null;
    const { id: _id, date: _date, actualActivityId: _actualActivityId, ...templateSession } = session;
    return templateSession;
  });
}

export default function StepTemplate() {
  const params = useLocalSearchParams<{
    raceDistance: string;
    raceLabel: string;
    raceName: string;
    raceDate: string;
    weeks: string;
    targetTime: string;
    phases: string;
    hasPerWeekTweaks?: string;
  }>();
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [editing, setEditing] = useState<number | null>(null);
  const [rearranging, setRearranging] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<(Partial<PlannedSession> | null)[] | null>(null);

  const totalKm = template.reduce((acc, s) => acc + sessionKm(s as PlannedSession | null), 0);
  const weeks = Number(params.weeks) || 16;
  const hasPerWeekTweaks = params.hasPerWeekTweaks === 'true';

  const handleSave = (dayIndex: number, session: Partial<PlannedSession> | null) => {
    const t = [...template];
    t[dayIndex] = session;
    setTemplate(t);
    setEditing(null);
  };

  const applyTemplateRearrange = (nextTemplate: (Partial<PlannedSession> | null)[]) => {
    setTemplate(nextTemplate);
    setPendingTemplate(null);
  };

  const handleRearrangeDone = (sessions: (PlannedSession | null)[]) => {
    const nextTemplate = toTemplateSessions(sessions);
    setRearranging(false);

    if (hasPerWeekTweaks) {
      setPendingTemplate(nextTemplate);
      return;
    }

    applyTemplateRearrange(nextTemplate);
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

        <View style={styles.templateActions}>
          <View>
            <Text style={styles.templateActionsTitle}>Weekly layout</Text>
            <Text style={styles.templateActionsText}>Move sessions between days before generating.</Text>
          </View>
          <Pressable onPress={() => setRearranging(true)} style={styles.rearrangeButton}>
            <Text style={styles.rearrangeButtonText}>Rearrange</Text>
          </Pressable>
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

      {rearranging ? (
        <RearrangeSheet
          visible={rearranging}
          weekNumber={1}
          sessions={toRearrangeSessions(template)}
          onCancel={() => setRearranging(false)}
          onDone={handleRearrangeDone}
        />
      ) : null}

      {pendingTemplate ? (
        <Modal visible transparent animationType="fade">
          <View style={styles.warningOverlay}>
            <View style={styles.warningSheet}>
              <Text style={styles.warningTitle}>Regenerate plan preview?</Text>
              <Text style={styles.warningCopy}>
                Rearranging the template will reset per-week edits already made in the preview.
              </Text>
              <View style={styles.warningActions}>
                <Pressable
                  onPress={() => setPendingTemplate(null)}
                  style={styles.warningSecondary}
                >
                  <Text style={styles.warningSecondaryText}>Keep edits</Text>
                </Pressable>
                <Pressable
                  onPress={() => applyTemplateRearrange(pendingTemplate)}
                  style={styles.warningPrimary}
                >
                  <Text style={styles.warningPrimaryText}>Regenerate</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
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
  templateActions: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  templateActionsTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink,
  },
  templateActionsText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    marginTop: 2,
  },
  rearrangeButton: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${C.clay}45`,
    backgroundColor: C.clayBg,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rearrangeButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.clay,
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
  warningOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28,21,16,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  warningSheet: {
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 18,
    gap: 12,
  },
  warningTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 20,
    color: C.ink,
  },
  warningCopy: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
    color: C.ink2,
  },
  warningActions: {
    flexDirection: 'row',
    gap: 10,
  },
  warningSecondary: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningPrimary: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: C.clay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningSecondaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink2,
  },
  warningPrimaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
