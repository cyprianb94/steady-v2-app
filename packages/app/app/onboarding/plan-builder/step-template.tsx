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
import { Btn } from '../../../components/ui/Btn';
import { DragHandle } from '../../../components/plan-builder/DragHandle';
import { SessionEditor } from '../../../components/plan-builder/SessionEditor';
import { StarterChoiceCards } from '../../../components/plan-builder/StarterChoiceCards';
import { StarterSummaryStrip } from '../../../components/plan-builder/StarterSummaryStrip';
import { C } from '../../../constants/colours';
import { SESSION_TYPE } from '../../../constants/session-types';
import { FONTS } from '../../../constants/typography';
import {
  createStarterTemplate,
  canGenerateTemplate,
  hasStarterTemplateEdits,
  toTemplateSessions,
  type TemplateDay,
  type TemplateStarterMode,
} from '../../../features/plan-builder/template-starter';
import { useDirectWeekReschedule } from '../../../features/plan-builder/use-direct-week-reschedule';
import { DAYS, sessionLabel } from '../../../lib/plan-helpers';
import { formatDistance } from '../../../lib/units';
import { usePreferences } from '../../../providers/preferences-context';

type PendingStarterChange =
  | {
      nextMode: TemplateStarterMode;
    }
  | null;

type PendingStarterPreviewReset =
  | {
      nextMode: TemplateStarterMode;
    }
  | null;

function materializeTemplateSession(
  dayIndex: number,
  updated: TemplateDay,
  existing: PlannedSession | null,
): PlannedSession | null {
  if (!updated) {
    return null;
  }

  return {
    ...existing,
    ...updated,
    id: existing?.id ?? `template-${dayIndex}`,
    date: existing?.date ?? 'template',
    type: updated.type ?? existing?.type ?? 'EASY',
  } as PlannedSession;
}

function createEditableStarterTemplate(mode: TemplateStarterMode): (PlannedSession | null)[] {
  return createStarterTemplate(mode).map((session, dayIndex) =>
    materializeTemplateSession(dayIndex, session, null),
  );
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
  const [starterMode, setStarterMode] = useState<TemplateStarterMode | null>(null);
  const [templateSessions, setTemplateSessions] = useState<(PlannedSession | null)[]>(
    () => createEditableStarterTemplate('clean'),
  );
  const [editing, setEditing] = useState<number | null>(null);
  const [starterPickerVisible, setStarterPickerVisible] = useState(false);
  const [showReorderWarning, setShowReorderWarning] = useState(false);
  const [pendingStarterChange, setPendingStarterChange] = useState<PendingStarterChange>(null);
  const [pendingStarterPreviewReset, setPendingStarterPreviewReset] =
    useState<PendingStarterPreviewReset>(null);

  const weeks = Number(params.weeks) || 16;
  const hasPerWeekTweaks = params.hasPerWeekTweaks === 'true';
  const committedTemplate = toTemplateSessions(templateSessions);

  const reschedule = useDirectWeekReschedule({
    initialSessions: templateSessions,
    canDragDay: (session) => Boolean(session && session.type !== 'REST'),
  });

  useEffect(() => {
    if (!reschedule.hasChanges) {
      return;
    }

    if (hasPerWeekTweaks) {
      setShowReorderWarning(true);
      return;
    }

    setTemplateSessions(reschedule.sessions);
  }, [hasPerWeekTweaks, reschedule.hasChanges, reschedule.sessions]);

  const visibleSessions = reschedule.sessions;
  const visibleTemplate = toTemplateSessions(visibleSessions);
  const totalKm = visibleSessions.reduce((sum, session) => sum + sessionKm(session), 0);
  const canGenerate = canGenerateTemplate(visibleTemplate);
  const scheduledCount = visibleTemplate.filter((session) => session && session.type !== 'REST').length;
  const volumeLabel = `~${formatDistance(totalKm, units, { spaced: true })} / week`;
  const subtitle =
    starterMode === null
      ? 'Start from a recommended base or build your own week from scratch. Each day will be editable and movable in the next step.'
      : starterMode === 'template'
        ? `This pattern repeats across all ${weeks} weeks. Tap any day to adjust, or drag the grip to move it.`
        : 'Build a week from scratch and add only the sessions you know you can support. Dragging unlocks once the week has shape.';

  function applyStarterMode(mode: TemplateStarterMode) {
    setStarterMode(mode);
    setTemplateSessions(createEditableStarterTemplate(mode));
    setStarterPickerVisible(false);
    setPendingStarterChange(null);
    setPendingStarterPreviewReset(null);
    setShowReorderWarning(false);
    setEditing(null);
  }

  function requestStarterMode(nextMode: TemplateStarterMode) {
    if (starterMode === nextMode) {
      setStarterPickerVisible(false);
      return;
    }

    if (starterMode && hasStarterTemplateEdits(committedTemplate, starterMode)) {
      setPendingStarterChange({ nextMode });
      setStarterPickerVisible(false);
      return;
    }

    if (starterMode !== null && hasPerWeekTweaks) {
      setPendingStarterPreviewReset({ nextMode });
      setStarterPickerVisible(false);
      return;
    }

    applyStarterMode(nextMode);
  }

  function handleSave(dayIndex: number, session: TemplateDay) {
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
    const nextTemplate =
      showReorderWarning || !reschedule.hasChanges ? committedTemplate : visibleTemplate;

    if (!canGenerateTemplate(nextTemplate)) {
      return;
    }

    router.push({
      pathname: '/onboarding/plan-builder/step-plan',
      params: {
        ...params,
        template: JSON.stringify(nextTemplate),
      },
    });
  }

  function keepExistingTweaks() {
    setShowReorderWarning(false);
    reschedule.reset();
  }

  function regenerateFromReorderedTemplate() {
    setTemplateSessions(reschedule.sessions);
    setShowReorderWarning(false);
  }

  function confirmStarterModeChange() {
    if (!pendingStarterChange) {
      return;
    }

    const { nextMode } = pendingStarterChange;
    setPendingStarterChange(null);

    if (hasPerWeekTweaks) {
      setPendingStarterPreviewReset({ nextMode });
      return;
    }

    applyStarterMode(nextMode);
  }

  function applyStarterPreviewReset() {
    if (!pendingStarterPreviewReset) {
      return;
    }

    const { nextMode } = pendingStarterPreviewReset;
    applyStarterMode(nextMode);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>STEP 2 OF 3</Text>
        <Text style={styles.title}>Design your week</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {starterMode === null ? (
          <StarterChoiceCards onSelect={requestStarterMode} units={units} />
        ) : (
          <>
            <StarterSummaryStrip
              mode={starterMode}
              volumeLabel={volumeLabel}
              onChange={() => setStarterPickerVisible(true)}
            />

            {starterMode === 'clean' ? (
              <View style={styles.infoCard}>
                <View style={styles.infoDot} />
                <Text style={styles.infoText}>
                  <Text style={styles.infoStrong}>Steady</Text> — Start simple. Add the sessions you
                  can recover from every week, then build from there. Rest day is always an option
                  inside the editor.
                </Text>
              </View>
            ) : null}

            <View style={styles.layoutCard}>
              <View>
                <Text style={styles.layoutTitle}>Weekly layout</Text>
                <Text style={styles.layoutCopy}>
                  {scheduledCount > 1
                    ? 'Use the grip to move sessions between days.'
                    : 'Add a second session to unlock drag-to-reorder.'}
                </Text>
              </View>
              <Text style={styles.layoutMeta}>{volumeLabel}</Text>
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

            {visibleSessions.map((session, index) => {
              const isEmpty = starterMode === 'clean' && session === null;
              const isRest = !isEmpty && (!session || session.type === 'REST');
              const type = session?.type ?? 'REST';
              const sessionType = SESSION_TYPE[type];
              const dragging = reschedule.dragState?.fromIndex === index;
              const dropTarget =
                reschedule.dragState?.overIndex === index &&
                reschedule.dragState.fromIndex !== index;
              const canDragDay = reschedule.canDragIndex(index);

              if (isEmpty) {
                return (
                  <View
                    key={DAYS[index]}
                    style={[
                      styles.emptyDayCard,
                      dropTarget && styles.dayCardDropTarget,
                    ]}
                  >
                    <Pressable
                      testID={`template-day-${index}`}
                      onPress={() => setEditing(index)}
                      style={styles.emptyDayPressable}
                    >
                      <Text style={styles.emptyDayLabel}>{DAYS[index]}</Text>
                      <View style={styles.emptyDayCopy}>
                        <Text style={styles.emptyDayTitle}>Empty day</Text>
                        <Text style={styles.emptyDaySubtitle}>
                          Add a run, workout or rest choice.
                        </Text>
                      </View>
                      <View style={styles.addAction}>
                        <View style={styles.addActionBadge}>
                          <Text style={styles.addActionPlus}>+</Text>
                        </View>
                        <Text style={styles.addActionText}>Add</Text>
                      </View>
                    </Pressable>
                  </View>
                );
              }

              return (
                <Animated.View
                  key={session?.id ?? `${DAYS[index]}-${type}`}
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
                            {isRest ? 'Rest day' : sessionLabel(session, units)}
                          </Text>
                          <Text style={[styles.sessionDetail, isRest && styles.sessionDetailRest]} numberOfLines={1}>
                            {isRest
                              ? 'Recovery slot locked in for this day'
                              : sessionType.label}
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
              <Text style={styles.volumeValue}>{volumeLabel}</Text>
            </View>
            <Text style={styles.volumeNote}>
              Includes warm-up, cool-down, and recovery jogging between reps.
            </Text>
          </>
        )}
      </ScrollView>

      {starterMode !== null ? (
        <View style={styles.footer}>
          <Btn
            title={`Generate ${weeks}-week plan →`}
            onPress={handleNext}
            fullWidth
            disabled={!canGenerate}
          />
          {!canGenerate ? (
            <Text style={styles.footerHelper}>Add your first session to continue.</Text>
          ) : null}
        </View>
      ) : null}

      {editing !== null ? (
        <SessionEditor
          dayIndex={editing}
          existing={visibleSessions[editing]}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {starterPickerVisible ? (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.pickerSheet}>
              <Text style={styles.warningTitle}>Change starting point</Text>
              <Text style={styles.warningCopy}>
                Pick a different base. Your current week stays in place until you confirm a
                replacement.
              </Text>
              <ScrollView
                style={styles.pickerScroll}
                contentContainerStyle={styles.pickerScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <StarterChoiceCards onSelect={requestStarterMode} units={units} />
              </ScrollView>
              <Pressable
                onPress={() => setStarterPickerVisible(false)}
                style={styles.warningSecondary}
              >
                <Text style={styles.warningSecondaryText}>Keep current week</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}

      {pendingStarterChange ? (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.warningSheet}>
              <Text style={styles.warningTitle}>Replace this week?</Text>
              <Text style={styles.warningCopy}>
                Switching to{' '}
                {pendingStarterChange.nextMode === 'template'
                  ? 'the Steady template'
                  : 'a clean slate'}{' '}
                will replace the week you&apos;ve already edited.
              </Text>
              <View style={styles.warningActions}>
                <Pressable
                  onPress={() => setPendingStarterChange(null)}
                  style={styles.warningSecondary}
                >
                  <Text style={styles.warningSecondaryText}>Keep current week</Text>
                </Pressable>
                <Pressable onPress={confirmStarterModeChange} style={styles.warningPrimary}>
                  <Text style={styles.warningPrimaryText}>Replace week</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {pendingStarterPreviewReset ? (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.warningSheet}>
              <Text style={styles.warningTitle}>Regenerate plan preview?</Text>
              <Text style={styles.warningCopy}>
                Changing the starting point will reset per-week edits already made in the preview.
              </Text>
              <View style={styles.warningActions}>
                <Pressable
                  onPress={() => setPendingStarterPreviewReset(null)}
                  style={styles.warningSecondary}
                >
                  <Text style={styles.warningSecondaryText}>Keep edits</Text>
                </Pressable>
                <Pressable onPress={applyStarterPreviewReset} style={styles.warningPrimary}>
                  <Text style={styles.warningPrimaryText}>Regenerate</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {showReorderWarning ? (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
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
    borderRadius: 12,
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
    fontFamily: FONTS.sansSemiBold,
  },
  layoutCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  layoutTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink,
  },
  layoutCopy: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    marginTop: 3,
  },
  layoutMeta: {
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
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  dayCardPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
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
    width: 44,
  },
  dayName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
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
    fontSize: 14,
    lineHeight: 16,
    color: C.ink,
  },
  sessionDetail: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    marginTop: 4,
  },
  sessionDetailRest: {
    color: C.muted,
  },
  emptyDayCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: 'rgba(253, 250, 245, 0.9)',
    marginBottom: 10,
    overflow: 'hidden',
  },
  emptyDayPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  emptyDayLabel: {
    width: 44,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.muted,
    letterSpacing: 0.3,
  },
  emptyDayCopy: {
    flex: 1,
    minWidth: 0,
  },
  emptyDayTitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: C.ink2,
  },
  emptyDaySubtitle: {
    marginTop: 4,
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  addAction: {
    minWidth: 74,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(229, 221, 208, 0.95)',
    backgroundColor: 'rgba(244, 239, 230, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addActionBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(154, 142, 126, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addActionPlus: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: C.muted,
    lineHeight: 14,
  },
  addActionText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.ink2,
  },
  volumeCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 11,
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
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: 'rgba(244, 239, 230, 0.96)',
  },
  footerHelper: {
    marginTop: 8,
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28,21,16,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  pickerSheet: {
    backgroundColor: C.cream,
    borderRadius: 18,
    padding: 18,
    maxHeight: '88%',
  },
  pickerScroll: {
    marginTop: 14,
    marginBottom: 14,
  },
  pickerScrollContent: {
    paddingBottom: 6,
  },
  warningSheet: {
    backgroundColor: C.surface,
    borderRadius: 16,
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
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  warningPrimary: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
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
