import React, { useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { sessionKm, type PlannedSession } from '@steady/types';
import { SessionEditor } from '../../../components/plan-builder/SessionEditor';
import { DragHandle } from '../../../components/plan-builder/DragHandle';
import { Btn } from '../../../components/ui/Btn';
import { C } from '../../../constants/colours';
import { SESSION_TYPE } from '../../../constants/session-types';
import { FONTS } from '../../../constants/typography';
import { useDirectWeekReschedule } from '../../../features/plan-builder/use-direct-week-reschedule';
import { DAYS, sessionLabel } from '../../../lib/plan-helpers';
import { formatDistance } from '../../../lib/units';
import { usePreferences } from '../../../providers/preferences-context';

const DEFAULT_TEMPLATE: (Partial<PlannedSession> | null)[] = [
  { type: 'EASY', distance: 8, pace: '5:20' },
  { type: 'INTERVAL', reps: 6, repDist: 800, pace: '3:50', recovery: '90s', warmup: 1.5, cooldown: 1 },
  { type: 'EASY', distance: 8, pace: '5:30' },
  { type: 'TEMPO', distance: 10, pace: '4:20', warmup: 2, cooldown: 1.5 },
  null,
  { type: 'EASY', distance: 12, pace: '5:20' },
  { type: 'LONG', distance: 20, pace: '5:10' },
];

function createTemplateSessions(
  template: (Partial<PlannedSession> | null)[],
): (PlannedSession | null)[] {
  return template.map((session, index) => {
    if (!session || session.type === 'REST') {
      return null;
    }

    return {
      id: `template-${index}`,
      date: 'template',
      type: session.type ?? 'EASY',
      ...session,
    } as PlannedSession;
  });
}

function toTemplateSessions(
  sessions: (PlannedSession | null)[],
): (Partial<PlannedSession> | null)[] {
  return sessions.map((session) => {
    if (!session || session.type === 'REST') {
      return null;
    }

    const { id: _id, date: _date, actualActivityId: _actualActivityId, ...templateSession } = session;
    return templateSession;
  });
}

function materializeTemplateSession(
  dayIndex: number,
  updated: Partial<PlannedSession> | null,
  existing: PlannedSession | null,
): PlannedSession | null {
  if (!updated || updated.type === 'REST') {
    return null;
  }

  return {
    ...existing,
    ...updated,
    id: existing?.id ?? `template-${dayIndex}`,
    date: existing?.date ?? 'template',
    type: updated.type ?? existing?.type ?? 'EASY',
  };
}

export default function StepTemplate() {
  const { units } = usePreferences();
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
  const [templateSessions, setTemplateSessions] = useState<(PlannedSession | null)[]>(
    () => createTemplateSessions(DEFAULT_TEMPLATE),
  );
  const [editing, setEditing] = useState<number | null>(null);
  const [showRegenerateWarning, setShowRegenerateWarning] = useState(false);

  const weeks = Number(params.weeks) || 16;
  const hasPerWeekTweaks = params.hasPerWeekTweaks === 'true';
  const reschedule = useDirectWeekReschedule({
    initialSessions: templateSessions,
    canDragDay: (session) => Boolean(session),
  });

  useEffect(() => {
    if (!reschedule.hasChanges) {
      return;
    }

    if (hasPerWeekTweaks) {
      setShowRegenerateWarning(true);
      return;
    }

    setTemplateSessions(reschedule.sessions);
  }, [hasPerWeekTweaks, reschedule.hasChanges, reschedule.sessions]);

  const visibleTemplateSessions =
    !showRegenerateWarning && reschedule.hasChanges
      ? reschedule.sessions
      : templateSessions;
  const totalKm = visibleTemplateSessions.reduce(
    (acc, session) => acc + sessionKm(session),
    0,
  );

  function handleSave(dayIndex: number, session: Partial<PlannedSession> | null) {
    const nextSessions = [...templateSessions];
    nextSessions[dayIndex] = materializeTemplateSession(
      dayIndex,
      session,
      templateSessions[dayIndex] ?? null,
    );
    setTemplateSessions(nextSessions);
    setEditing(null);
  }

  function handleNext() {
    const nextTemplateSessions =
      showRegenerateWarning || !reschedule.hasChanges
        ? templateSessions
        : reschedule.sessions;

    router.push({
      pathname: '/onboarding/plan-builder/step-plan',
      params: {
        ...params,
        template: JSON.stringify(toTemplateSessions(nextTemplateSessions)),
      },
    });
  }

  function keepExistingTweaks() {
    setShowRegenerateWarning(false);
    reschedule.reset();
  }

  function regenerateFromReorderedTemplate() {
    setTemplateSessions(reschedule.sessions);
    setShowRegenerateWarning(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>STEP 2 OF 3</Text>
        <Text style={styles.title}>Design your week</Text>
        <Text style={styles.subtitle}>
          Tap any day to tune the session. Use the grip to move it to a different spot in the week.
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <View style={styles.infoDot} />
          <Text style={styles.infoText}>
            <Text style={styles.infoStrong}>Steady</Text> — This is your base week. It repeats across
            all {weeks} weeks, so set the rhythm first and fine-tune details later.
          </Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Template week</Text>
          <Text style={styles.sectionMeta}>~{formatDistance(totalKm, units, { spaced: true })} / week</Text>
        </View>

        {reschedule.conflicts.length > 0 ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningBannerTitle}>Hard sessions are back-to-back</Text>
            <Text style={styles.warningBannerText}>
              {reschedule.conflicts
                .map((conflict) => `${DAYS[conflict.firstDayIndex]}-${DAYS[conflict.secondDayIndex]}`)
                .join(', ')}
            </Text>
          </View>
        ) : null}

        {reschedule.sessions.map((session, index) => {
          const type = session?.type ?? 'REST';
          const sessionType = SESSION_TYPE[type];
          const isRest = !session;
          const dragging = reschedule.dragState?.fromIndex === index;
          const dropTarget =
            reschedule.dragState?.overIndex === index &&
            reschedule.dragState.fromIndex !== index;
          const canDragDay = reschedule.canDragIndex(index);

          return (
            <Animated.View
              key={session?.id ?? `rest-${index}`}
              style={[
                styles.dayCardWrap,
                dragging && { transform: [{ translateY: reschedule.dragY }] },
              ]}
            >
              <View
                style={[
                  styles.dayCard,
                  {
                    backgroundColor: isRest ? C.surface : sessionType.bg,
                    borderColor: dropTarget ? C.clay : isRest ? C.border : `${sessionType.color}35`,
                  },
                  dropTarget && styles.dayCardDropTarget,
                  dragging && styles.dayCardDragging,
                ]}
              >
                <Pressable
                  testID={`template-day-${index}`}
                  onPress={() => setEditing(index)}
                  style={styles.dayCardPressable}
                >
                  <View style={styles.dayLabel}>
                    <Text style={[styles.dayName, { color: isRest ? C.muted : sessionType.color }]}>
                      {DAYS[index]}
                    </Text>
                  </View>

                  <View style={styles.sessionInfo}>
                    <View
                      style={[
                        styles.sessionDot,
                        { backgroundColor: sessionType.color },
                        isRest && styles.sessionDotRest,
                      ]}
                    />
                    <View style={styles.sessionCopy}>
                      <Text style={styles.sessionMain} numberOfLines={1}>
                        {isRest ? 'Rest day' : sessionType.label}
                      </Text>
                      <Text style={[styles.sessionDetail, isRest && styles.sessionDetailRest]} numberOfLines={1}>
                        {isRest
                          ? 'Open slot if you want to move a run here'
                          : sessionLabel(session, units)}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <DragHandle
                  testID={`template-drag-handle-${index}`}
                  disabled={!canDragDay}
                  active={dragging}
                  onMouseDown={(event) => {
                    event.stopPropagation?.();
                    reschedule.recordTouchStart(event.clientY);
                    reschedule.beginDrag(index);
                  }}
                  onMouseMove={(event) => {
                    event.stopPropagation?.();
                    reschedule.updateDrag(event.clientY);
                  }}
                  onMouseUp={(event) => {
                    event.stopPropagation?.();
                    reschedule.finishDrag();
                  }}
                  onTouchStart={(event) => {
                    event.stopPropagation?.();
                    reschedule.recordTouchStart(event.nativeEvent.pageY);
                  }}
                  onLongPress={() => {
                    reschedule.beginDrag(index);
                  }}
                  onTouchMove={(event) => {
                    event.stopPropagation?.();
                    reschedule.updateDrag(event.nativeEvent.pageY);
                  }}
                  onTouchEnd={() => {
                    reschedule.finishDrag();
                  }}
                />
              </View>
            </Animated.View>
          );
        })}

        <View style={styles.volumeCard}>
          <Text style={styles.volumeLabel}>Template volume</Text>
          <Text style={styles.volumeValue}>~{formatDistance(totalKm, units, { spaced: true })} / week</Text>
        </View>
        <Text style={styles.volumeNote}>
          Includes warm-up, cool-down, and recovery jogging between reps.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Btn title={`Generate ${weeks}-week plan →`} onPress={handleNext} fullWidth />
      </View>

      {editing !== null ? (
        <SessionEditor
          dayIndex={editing}
          existing={templateSessions[editing]}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {showRegenerateWarning ? (
        <Modal visible transparent animationType="fade">
          <View style={styles.warningOverlay}>
            <View style={styles.warningSheet}>
              <Text style={styles.warningTitle}>Regenerate plan preview?</Text>
              <Text style={styles.warningCopy}>
                Rearranging the template will reset per-week edits already made in the preview.
              </Text>
              <View style={styles.warningActions}>
                <Pressable onPress={keepExistingTweaks} style={styles.warningSecondary}>
                  <Text style={styles.warningSecondaryText}>Keep edits</Text>
                </Pressable>
                <Pressable onPress={regenerateFromReorderedTemplate} style={styles.warningPrimary}>
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
    marginBottom: 16,
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
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 19,
    color: C.ink,
  },
  sectionMeta: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: C.clay,
  },
  warningBanner: {
    backgroundColor: C.amberBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${C.amber}35`,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  warningBannerTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.amber,
  },
  warningBannerText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.ink2,
    marginTop: 4,
  },
  dayCardWrap: {
    marginBottom: 8,
  },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  dayCardPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingLeft: 14,
    paddingRight: 6,
  },
  dayCardDropTarget: {
    borderStyle: 'dashed',
    backgroundColor: C.clayBg,
  },
  dayCardDragging: {
    shadowColor: C.clay,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dayLabel: {
    width: 30,
  },
  dayName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  sessionInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  sessionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sessionDotRest: {
    backgroundColor: C.slate,
  },
  sessionCopy: {
    flex: 1,
    overflow: 'hidden',
  },
  sessionMain: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: C.ink,
  },
  sessionDetail: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.ink2,
    marginTop: 2,
  },
  sessionDetailRest: {
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
    borderRadius: 12,
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
