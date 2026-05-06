import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { AnimatedWeekExpansion } from '../../components/block/AnimatedWeekExpansion';
import { BlockVolumeChart } from '../../components/block-review';
import { DragHandle } from '../../components/plan-builder/DragHandle';
import { PropagateModal } from '../../components/plan-builder/PropagateModal';
import { RunStatusIcon } from '../../components/run/RunStatusIcon';
import { Btn } from '../../components/ui/Btn';
import { AnimatedProgressFill } from '../../components/ui/AnimatedProgressFill';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { PHASE_COLOR } from '../../constants/phase-meta';
import { SESSION_TYPE } from '../../constants/session-types';
import {
  formatRaceDate,
  formatShortDate,
  getPhaseStripLabel,
} from '../../features/block/block-tab-model';
import { useBlockTabController } from '../../features/block/use-block-tab-controller';
import { formatDistance } from '../../lib/units';
import {
  getWeekVolumeRatio,
  type PlanWeek,
  type SessionType,
} from '@steady/types';

const INACTIVE_PHASE_BACKGROUND: Record<PlanWeek['phase'], string> = {
  BASE: `${C.navy}59`,
  BUILD: `${C.clay}59`,
  RECOVERY: `${PHASE_COLOR.RECOVERY}59`,
  PEAK: `${C.amber}59`,
  TAPER: `${C.forest}59`,
};

export default function BlockTab() {
  const controller = useBlockTabController();

  if (controller.status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.clay} />
      </View>
    );
  }

  if (controller.status === 'signedOut') {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Sign in to see your plan</Text>
        <Text style={styles.muted}>
          Use the Settings tab to continue with Google, then come back here.
        </Text>
        <View style={{ marginTop: 20 }}>
          <Btn title="Go to settings" onPress={controller.goToSettings} />
        </View>
      </View>
    );
  }

  if (controller.status === 'empty') {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No plan yet</Text>
        <Text style={styles.muted}>Build your training plan to get started</Text>
        <View style={{ marginTop: 20 }}>
          <Btn
            title="Build a plan"
            onPress={controller.goToPlanBuilder}
          />
        </View>
      </View>
    );
  }

  if (controller.status === 'unavailable') {
    return null;
  }

  const {
    units,
    plan,
    reviewModel,
    safeCurrentWeekIndex,
    phaseStrip,
    maxKm,
    weekRows,
    refreshing,
    onRefresh,
    scrollRef,
    scrollEnabled,
    onScroll,
    onLayout,
    onWeekRowLayout,
    onVolumeChartScrubActiveChange,
    toggleWeek,
    openSessionEditor,
    openRunDetail,
    openRescheduleModal,
    reschedule,
    onCollapseEnd,
    rescheduleModal,
    pendingEditModal,
  } = controller;

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        scrollEnabled={scrollEnabled}
        onLayout={onLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.clay}
          />
        }
      >
        {/* Race header */}
        <View style={styles.header}>
          <Text style={styles.label}>GOAL RACE</Text>
          <Text style={styles.raceTitle}>{plan.raceName}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaValue, { color: C.clay }]}>{formatRaceDate(plan.raceDate)}</Text>
            <Text style={[styles.metaValue, { color: C.muted }]}>
              {plan.weeks.length - safeCurrentWeekIndex} weeks out
            </Text>
            <Text style={[styles.metaValue, { color: C.navy }]}>{plan.targetTime}</Text>
          </View>
        </View>

        <BlockVolumeChart
          model={reviewModel}
          title="Block overview"
          raceDate={plan.raceDate}
          onScrubActiveChange={onVolumeChartScrubActiveChange}
          formatDistance={(km) => formatDistance(km, units)}
          showPhaseStrip={false}
        />

        {/* Phase strip */}
        <View style={styles.phaseSection}>
          <View style={styles.phaseStrip}>
            {phaseStrip.phases.map((p, i) => {
              const label = getPhaseStripLabel(p, plan.weeks.length);
              const isCompactLabel = label !== p.name;
              const isHistoricalCurrentSegment =
                p.name === 'INJURY' && p.isCurrent && phaseStrip.isHistoricalCurrentInjury;
              const showCurrentPhaseEmphasis = p.isCurrent && !isHistoricalCurrentSegment;

              return (
                <View
                  key={i}
                  style={[
                    styles.phaseSegment,
                    {
                      flex: p.weeks,
                      backgroundColor:
                        p.name === 'INJURY'
                          ? isHistoricalCurrentSegment
                            ? C.clayBg
                            : p.isCurrent
                            ? C.clay
                            : C.clayBg
                          : p.isCurrent
                            ? PHASE_COLOR[p.name]
                            : INACTIVE_PHASE_BACKGROUND[p.name],
                      borderWidth: p.name === 'INJURY' && (!p.isCurrent || isHistoricalCurrentSegment) ? 1 : 0,
                      borderColor: p.name === 'INJURY' ? `${C.clay}35` : 'transparent',
                    },
                    showCurrentPhaseEmphasis && styles.phaseSegmentCurrent,
                    showCurrentPhaseEmphasis && {
                      shadowColor: p.name === 'INJURY' ? C.clay : PHASE_COLOR[p.name],
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.phaseLabel,
                      isCompactLabel && styles.phaseLabelCompact,
                      {
                        color:
                          p.name === 'INJURY'
                            ? isHistoricalCurrentSegment
                              ? C.clay
                              : p.isCurrent
                              ? 'white'
                              : C.clay
                            : p.isCurrent
                              ? 'white'
                              : 'rgba(255,255,255,0.74)',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.phaseCaption}>
            <Text style={styles.phaseCaptionLead}>
              {phaseStrip.isHistoricalCurrentInjury ? 'Current week:' : 'Current phase:'}
            </Text>
            <Text>{` ${phaseStrip.caption}`}</Text>
          </Text>
        </View>

        {/* Week rows */}
        {weekRows.map((weekRow) => {
          const {
            week,
            index,
            isCurrent,
            isPast,
            isFuture,
            injuryWeek,
            isExpanded,
            shouldRenderExpandedWeek,
            isRescheduleWeek,
            displayWeek,
            weekEntries,
            recoveryEntriesLoading,
            volumeTone,
            volumeSummary,
            plannedVolumeLabel,
            weekGuide,
            days,
          } = weekRow;

          return (
            <View
              key={week.weekNumber}
              testID={`block-week-row-${week.weekNumber}`}
              onLayout={(event) => onWeekRowLayout(index, event)}
              style={[
                styles.weekRow,
                isCurrent && styles.weekRowCurrent,
                isPast && styles.weekRowPast,
                injuryWeek && styles.weekRowInjury,
                isExpanded && isFuture && styles.weekRowFutureExpanded,
              ]}
            >
              <Pressable
                onPress={() => toggleWeek(week.weekNumber)}
                style={styles.weekPressable}
                testID={`block-week-row-press-${week.weekNumber}`}
              >
                <View style={styles.weekRowMain}>
                  <View style={styles.weekLeft}>
                    <Text
                      style={[
                        styles.weekNum,
                        isCurrent && { color: C.clay, fontWeight: '700' },
                      ]}
                    >
                      W{week.weekNumber}
                    </Text>
                    <Text style={[styles.weekPhaseTag, injuryWeek && styles.weekPhaseTagInjury]}>
                      {injuryWeek ? 'INJURY' : week.phase}
                    </Text>
                  </View>

                  {injuryWeek ? (
                    <View style={styles.injuryEntries}>
                      {recoveryEntriesLoading ? (
                        <Text style={styles.injuryHelper}>Loading cross-training…</Text>
                      ) : weekEntries.length > 0 ? (
                        weekEntries.map((entry) => (
                          <View key={entry.id} style={styles.crossTrainingChip}>
                            <View style={styles.crossTrainingDot} />
                            <Text style={styles.crossTrainingText}>
                              {entry.type} {entry.durationMinutes}m
                            </Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.injuryHelper}>No cross-training logged</Text>
                      )}
                    </View>
                  ) : (
                    <View style={styles.dots}>
                      {displayWeek.sessions.map((s, d) => {
                        const type: SessionType = s?.type ?? 'REST';
                        return (
                          <View
                            key={d}
                            style={[
                              styles.dot,
                              {
                                backgroundColor: SESSION_TYPE[type].color,
                                opacity: !isPast && !isCurrent ? 0.55 : 1,
                              },
                            ]}
                          />
                        );
                      })}
                    </View>
                  )}

                  <View style={styles.weekRight}>
                    {injuryWeek ? (
                      <Text style={[styles.weekKm, isCurrent && { color: C.clay }, styles.weekKmInjury]}>
                        {`${weekEntries.length} XT`}
                      </Text>
                    ) : volumeSummary.showActual && volumeSummary.actualKm != null ? (
                      <Text numberOfLines={1} style={styles.weekKmComposite}>
                        <Text style={styles.weekKmActual}>{formatDistance(volumeSummary.actualKm, units)}</Text>
                        <Text style={styles.weekKmDivider}> / </Text>
                        <Text style={styles.weekKmPlanned}>{plannedVolumeLabel}</Text>
                      </Text>
                    ) : (
                      <Text style={[styles.weekKm, isCurrent && { color: C.clay }]}>
                        {plannedVolumeLabel}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.volumeTrack}>
                  {volumeTone === 'current' ? (
                    <>
                      <AnimatedProgressFill
                        progress={getWeekVolumeRatio(volumeSummary.plannedKm, maxKm)}
                        fillStyle={[styles.volumeFill, styles.volumeFillFuture]}
                      />
                      {volumeSummary.actualKm != null ? (
                        <View pointerEvents="none" style={styles.volumeFillOverlay}>
                          <AnimatedProgressFill
                            progress={getWeekVolumeRatio(volumeSummary.actualKm, maxKm)}
                            fillStyle={[styles.volumeFill, styles.volumeFillCurrent]}
                          />
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <AnimatedProgressFill
                      progress={getWeekVolumeRatio(volumeSummary.barKm, maxKm)}
                      fillStyle={[
                        styles.volumeFill,
                        volumeTone === 'past' && styles.volumeFillPast,
                        volumeTone === 'future' && styles.volumeFillFuture,
                      ]}
                    />
                  )}
                </View>
              </Pressable>

              {shouldRenderExpandedWeek ? (
                <AnimatedWeekExpansion
                  expanded={isExpanded}
                  expandedPaddingBottom={12}
                  showDivider={isPast}
                  onCollapseEnd={() => onCollapseEnd(week.weekNumber)}
                >
                  {weekGuide ? <Text style={styles.weekGuide}>{weekGuide}</Text> : null}

                  {days.map((day) => {
                    const {
                      detail,
                      dayIndex,
                      statusIcon,
                      session,
                      locked,
                      dragging,
                      dropTarget,
                      invalidDropTarget,
                      canEditDay,
                      canDragDay,
                      canReviewRun,
                      sessionRowText,
                    } = day;
                    const dayPressHandler = canReviewRun
                      ? () => { void openRunDetail(session); }
                      : canEditDay
                        ? () => openSessionEditor(index, dayIndex)
                        : undefined;

                    return (
                      <Animated.View
                        key={`${week.weekNumber}-${detail.dayLabel}`}
                        onLayout={(event) => {
                          reschedule.registerSlotLayout(
                            dayIndex,
                            event.nativeEvent.layout.y,
                            event.nativeEvent.layout.height,
                          );
                        }}
                        style={[
                          styles.dayRowWrap,
                          dragging && { transform: [{ translateY: reschedule.dragY }] },
                        ]}
                      >
                        <View
                          style={[
                            styles.dayRow,
                            canEditDay && styles.dayRowEditable,
                            locked && styles.dayRowLocked,
                            dropTarget && styles.dayRowDropTarget,
                            dragging && styles.dayRowDragging,
                          ]}
                        >
                          {dropTarget ? (
                            <View
                              pointerEvents="none"
                              style={[
                                styles.dayRowDropTargetOutline,
                                invalidDropTarget && styles.dayRowDropTargetOutlineInvalid,
                              ]}
                            />
                          ) : null}
                          <Pressable
                            testID={`block-day-${week.weekNumber}-${dayIndex}`}
                            disabled={!dayPressHandler}
                            onPress={dayPressHandler}
                            style={styles.dayRowPressable}
                          >
                            <View style={styles.dayMeta}>
                              <Text style={styles.dayName}>{detail.dayLabel}</Text>
                              <Text style={styles.dayDate}>{formatShortDate(detail.date)}</Text>
                            </View>

                            <View style={styles.daySession}>
                              <View
                                style={[
                                  styles.dayDot,
                                  { backgroundColor: SESSION_TYPE[detail.sessionType].color },
                                  detail.isRest && styles.dayDotRest,
                                ]}
                              />
                              <View style={styles.daySessionCopy}>
                                <Text
                                  style={[styles.daySessionLabel, detail.isRest && styles.daySessionLabelRest]}
                                  numberOfLines={1}
                                >
                                  {sessionRowText.title}
                                </Text>
                                <Text
                                  style={[styles.daySessionCaption, detail.isRest && styles.daySessionCaptionRest]}
                                  numberOfLines={1}
                                >
                                  {sessionRowText.caption}
                                </Text>
                              </View>
                            </View>
                          </Pressable>

                          <View style={styles.dayRight}>
                            {statusIcon && !canDragDay ? (
                              canReviewRun ? (
                                <Pressable
                                  accessibilityLabel={`Review ${statusIcon} run`}
                                  accessibilityRole="button"
                                  testID={`block-review-run-${week.weekNumber}-${dayIndex}`}
                                  onPress={() => { void openRunDetail(session); }}
                                  style={({ pressed }) => [
                                    styles.dayStatusButton,
                                    pressed && styles.dayStatusIconPressed,
                                  ]}
                                >
                                  <RunStatusIcon
                                    status={statusIcon}
                                    size={18}
                                    testID={`block-day-status-${week.weekNumber}-${dayIndex}`}
                                  />
                                </Pressable>
                              ) : (
                                <RunStatusIcon
                                  status={statusIcon}
                                  size={18}
                                  testID={`block-day-status-${week.weekNumber}-${dayIndex}`}
                                />
                              )
                            ) : canDragDay ? (
                              <DragHandle
                                testID={`block-drag-handle-${week.weekNumber}-${dayIndex}`}
                                disabled={false}
                                active={dragging}
                                quiet
                                alignEnd
                                onMouseDown={(event) => {
                                  event.stopPropagation?.();
                                  reschedule.recordTouchStart(event.clientY);
                                  reschedule.beginDrag(dayIndex);
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
                                onLongPress={(event) => {
                                  reschedule.recordTouchStart(event.nativeEvent.pageY);
                                  reschedule.beginDrag(dayIndex);
                                }}
                                onTouchMove={(event) => {
                                  event.stopPropagation?.();
                                  reschedule.updateDrag(event.nativeEvent.pageY);
                                }}
                                onTouchCancel={() => {
                                  reschedule.cancelDrag();
                                }}
                                onTouchEnd={() => {
                                  reschedule.finishDrag();
                                }}
                              />
                            ) : null}
                          </View>
                        </View>
                      </Animated.View>
                    );
                  })}

                  {isRescheduleWeek && reschedule.hasChanges ? (
                    <View style={styles.pendingStrip}>
                      <Text style={styles.pendingPrompt}>Do you want to apply reschedule?</Text>
                      <View style={styles.pendingActions}>
                        <Pressable
                          testID="block-reschedule-reset"
                          onPress={() => reschedule.reset()}
                          style={styles.pendingSecondary}
                        >
                          <Text style={styles.pendingSecondaryText}>No</Text>
                        </Pressable>
                        <Pressable
                          testID="block-apply-reschedule"
                          onPress={openRescheduleModal}
                          style={styles.pendingPrimary}
                        >
                          <Text style={styles.pendingPrimaryText}>Yes</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </AnimatedWeekExpansion>
              ) : null}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
      {rescheduleModal ? (
        <PropagateModal
          weekIndex={rescheduleModal.weekIndex}
          totalWeeks={rescheduleModal.totalWeeks}
          phaseName={rescheduleModal.phaseName}
          phaseWeekCount={rescheduleModal.phaseWeekCount}
          title="Where should this reschedule apply?"
          body={rescheduleModal.body}
          applyLabel={rescheduleModal.applyLabel}
          scopeLabels={rescheduleModal.scopeLabels}
          onApply={rescheduleModal.onApply}
          onClose={rescheduleModal.onClose}
        />
      ) : null}
      {pendingEditModal ? (
        <PropagateModal
          changeDesc={pendingEditModal.changeDesc}
          weekIndex={pendingEditModal.weekIndex}
          totalWeeks={pendingEditModal.totalWeeks}
          dayIndex={pendingEditModal.dayIndex}
          sessionDate={pendingEditModal.sessionDate}
          phaseName={pendingEditModal.phaseName}
          phaseWeekCount={pendingEditModal.phaseWeekCount}
          initialScope="this"
          onApply={pendingEditModal.onApply}
          onClose={pendingEditModal.onClose}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },
  content: {
    padding: 18,
    paddingTop: 60,
  },
  centered: {
    flex: 1,
    backgroundColor: C.cream,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  // Header
  header: {
    marginBottom: 14,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  raceTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 22,
    color: C.ink,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  metaValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
  },

  // Phase strip
  phaseSection: {
    marginTop: 10,
    marginBottom: 18,
  },
  phaseStrip: {
    flexDirection: 'row',
    gap: 2,
    height: 28,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  phaseSegment: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  phaseSegmentCurrent: {
    shadowColor: C.clay,
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  phaseLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 8.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    maxWidth: '100%',
    includeFontPadding: false,
  },
  phaseLabelCompact: {
    fontSize: 8,
    letterSpacing: 0.6,
  },
  phaseCaption: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  phaseCaptionLead: {
    fontFamily: FONTS.sansSemiBold,
    color: C.clay,
  },

  // Week rows
  weekRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  weekRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekPressable: {
    width: '100%',
  },
  weekRowCurrent: {
    backgroundColor: C.surface,
    borderColor: `${C.clay}35`,
    borderWidth: 1.5,
  },
  weekRowPast: {
    borderColor: C.border,
  },
  weekRowInjury: {
    backgroundColor: C.clayBg,
    borderColor: `${C.clay}22`,
  },
  weekRowFutureExpanded: {
    backgroundColor: C.surface,
    borderColor: `${C.muted}55`,
    borderWidth: 1.5,
  },
  weekLeft: {
    width: 38,
  },
  weekNum: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: C.muted,
  },
  weekPhaseTag: {
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: C.muted,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  weekPhaseTagInjury: {
    color: C.clay,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    gap: 3.5,
    alignItems: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  injuryEntries: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  crossTrainingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: `${C.navy}16`,
  },
  crossTrainingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.navy,
  },
  crossTrainingText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    color: C.navy,
  },
  injuryHelper: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  weekRight: {
    width: 92,
    alignItems: 'center',
  },
  weekKm: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.ink,
    textAlign: 'center',
  },
  weekKmComposite: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    textAlign: 'center',
  },
  weekKmActual: {
    color: C.forest,
  },
  weekKmDivider: {
    color: C.muted,
  },
  weekKmPlanned: {
    color: C.muted,
  },
  weekKmInjury: {
    color: C.clay,
  },
  volumeTrack: {
    height: 2,
    marginTop: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  volumeFill: {
    height: '100%',
    borderRadius: 999,
  },
  volumeFillOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  volumeFillPast: {
    backgroundColor: C.forest,
  },
  volumeFillCurrent: {
    backgroundColor: C.clay,
  },
  volumeFillFuture: {
    backgroundColor: C.border,
    opacity: 0.55,
  },
  weekGuide: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 17,
    color: C.ink2,
    marginBottom: 4,
  },
  dayRowWrap: {
    marginBottom: 4,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    borderRadius: 10,
  },
  dayRowPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayRowEditable: {
    borderRadius: 8,
  },
  dayRowLocked: {
    opacity: 0.74,
  },
  dayRowDropTarget: {
    position: 'relative',
  },
  dayRowDropTargetOutline: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    left: -10,
    right: -6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.clay,
  },
  dayRowDropTargetOutlineInvalid: {
    borderColor: C.border,
  },
  dayRowDragging: {
    shadowColor: C.clay,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dayMeta: {
    width: 74,
  },
  dayName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  dayDate: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
  },
  daySession: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  daySessionCopy: {
    flex: 1,
    minWidth: 0,
  },
  dayDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dayDotRest: {
    backgroundColor: C.slate,
  },
  daySessionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.ink,
  },
  daySessionLabelRest: {
    fontFamily: FONTS.sansMedium,
    color: C.ink,
  },
  daySessionCaption: {
    fontFamily: FONTS.sans,
    fontSize: 10.5,
    color: C.muted,
    marginTop: 1,
  },
  daySessionCaptionRest: {
    color: C.muted,
  },
  dayRight: {
    minWidth: 26,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  dayStatusButton: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayStatusIconPressed: {
    opacity: 0.75,
  },
  pendingStrip: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: `${C.clay}35`,
    backgroundColor: C.surface,
    gap: 12,
  },
  pendingPrompt: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    color: C.ink,
    textAlign: 'center',
  },
  pendingActions: {
    flexDirection: 'row',
    gap: 10,
  },
  pendingSecondary: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
  },
  pendingSecondaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: C.ink2,
  },
  pendingPrimary: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.clay,
  },
  pendingPrimaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Empty/loading
  emptyTitle: {
    fontFamily: FONTS.serifBold,
    fontSize: 20,
    color: C.ink,
    marginBottom: 8,
  },
  muted: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
  },
});
