import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { addDaysIso, type PhaseName, type PlannedSession, type SessionType } from '@steady/types';
import { C } from '../../constants/colours';
import { PHASE_COLOR } from '../../constants/phase-meta';
import { SESSION_TYPE } from '../../constants/session-types';
import { FONTS } from '../../constants/typography';
import { useDirectWeekReschedule } from '../../features/plan-builder/use-direct-week-reschedule';
import { DAYS } from '../../lib/plan-helpers';
import { formatDistance, type DistanceUnits } from '../../lib/units';
import { DragHandle } from '../plan-builder/DragHandle';
import { AnimatedProgressFill } from '../ui/AnimatedProgressFill';
import { AnimatedWeekExpansion } from './AnimatedWeekExpansion';
import { formatBlockSessionRowText } from './session-row-text';

export interface BlockWeekListWeek {
  id?: string | number;
  weekIndex: number;
  weekNumber: number;
  phase: PhaseName;
  weekStartDate?: string | null;
  plannedKm: number;
  volumeRatio?: number;
  sessions: readonly (Partial<PlannedSession> | null)[];
  isCurrent?: boolean;
  isPast?: boolean;
  isExpanded?: boolean;
}

export interface BlockWeekListProps {
  weeks: readonly BlockWeekListWeek[];
  expandedWeekIndex?: number | null;
  units?: DistanceUnits;
  helperLabel?: string | null;
  onWeekPress?: (weekIndex: number, week: BlockWeekListWeek) => void;
  onToggleWeek?: (weekIndex: number, week: BlockWeekListWeek) => void;
  onDayPress?: (
    weekIndex: number,
    dayIndex: number,
    session: Partial<PlannedSession> | null,
    week: BlockWeekListWeek,
  ) => void;
  onMoveSession?: (
    weekIndex: number,
    fromDayIndex: number,
    toDayIndex: number,
    week: BlockWeekListWeek,
  ) => void;
  onDragActiveChange?: (active: boolean) => void;
  rescheduleResetKey?: number;
  formatVolume?: (km: number, week: BlockWeekListWeek) => string;
  formatSessionLabel?: (
    session: Partial<PlannedSession> | null,
    dayIndex: number,
    week: BlockWeekListWeek,
  ) => string;
  formatSessionMeta?: (
    session: Partial<PlannedSession> | null,
    dayIndex: number,
    week: BlockWeekListWeek,
  ) => string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface BlockWeekRowProps extends Omit<BlockWeekListProps, 'weeks' | 'style' | 'testID'> {
  week: BlockWeekListWeek;
  volumeRatio: number;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function phaseLabel(phase: PhaseName): string {
  return `${phase.slice(0, 1)}${phase.slice(1).toLowerCase()}`;
}

function sessionType(session: Partial<PlannedSession> | null): SessionType {
  return session?.type ?? 'REST';
}

function rowDotColor(type: SessionType): string {
  return SESSION_TYPE[type].color;
}

function dayDotColor(type: SessionType): string {
  return type === 'REST' ? C.slate : SESSION_TYPE[type].color;
}

function defaultSessionMeta(session: Partial<PlannedSession> | null, units: DistanceUnits): string {
  return formatBlockSessionRowText(session, units).caption;
}

function defaultSessionLabel(session: Partial<PlannedSession> | null, units: DistanceUnits): string {
  return formatBlockSessionRowText(session, units).title;
}

function normalizeSessions(
  sessions: readonly (Partial<PlannedSession> | null)[],
): (PlannedSession | null)[] {
  return Array.from({ length: 7 }, (_, index) => {
    const session = sessions[index] ?? null;
    return session ? session as PlannedSession : null;
  });
}

function isIsoDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function resolveDayDate(
  week: BlockWeekListWeek,
  session: Partial<PlannedSession> | null,
  dayIndex: number,
): string | null {
  if (isIsoDate(session?.date)) {
    return session.date;
  }

  if (isIsoDate(week.weekStartDate)) {
    return addDaysIso(week.weekStartDate, dayIndex);
  }

  return null;
}

function formatShortDate(date: string | null): string {
  if (!date) {
    return '';
  }

  const value = new Date(`${date}T00:00:00`);
  if (Number.isNaN(value.getTime())) {
    return '';
  }

  return value.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function BlockWeekList({
  weeks,
  expandedWeekIndex,
  units = 'metric',
  helperLabel = null,
  onWeekPress,
  onToggleWeek,
  onDayPress,
  onMoveSession,
  onDragActiveChange,
  rescheduleResetKey,
  formatVolume,
  formatSessionLabel,
  formatSessionMeta,
  style,
  testID = 'block-week-list',
}: BlockWeekListProps) {
  const maxKm = Math.max(...weeks.map((week) => week.plannedKm), 0);

  return (
    <View style={[styles.weekList, style]} testID={testID}>
      {weeks.map((week) => (
        <BlockWeekRow
          key={week.id ?? week.weekNumber}
          week={week}
          volumeRatio={week.volumeRatio ?? (maxKm > 0 ? week.plannedKm / maxKm : 0)}
          expandedWeekIndex={expandedWeekIndex}
          units={units}
          helperLabel={helperLabel}
          onWeekPress={onWeekPress}
          onToggleWeek={onToggleWeek}
          onDayPress={onDayPress}
          onMoveSession={onMoveSession}
          onDragActiveChange={onDragActiveChange}
          rescheduleResetKey={rescheduleResetKey}
          formatVolume={formatVolume}
          formatSessionLabel={formatSessionLabel}
          formatSessionMeta={formatSessionMeta}
        />
      ))}
    </View>
  );
}

export function BlockWeekRow({
  week,
  volumeRatio,
  expandedWeekIndex,
  units = 'metric',
  helperLabel = null,
  onWeekPress,
  onToggleWeek,
  onDayPress,
  onMoveSession,
  onDragActiveChange,
  rescheduleResetKey,
  formatVolume,
  formatSessionLabel: formatSessionLabelOverride,
  formatSessionMeta,
}: BlockWeekRowProps) {
  const isExpanded = week.isExpanded || expandedWeekIndex === week.weekIndex;
  const phaseColor = PHASE_COLOR[week.phase];
  const [shouldRenderExpanded, setShouldRenderExpanded] = useState(isExpanded);
  const initialSessions = useMemo(() => normalizeSessions(week.sessions), [week.sessions]);
  const reschedule = useDirectWeekReschedule({
    initialSessions,
    canDragDay: () => Boolean(onMoveSession),
    canDropDay: () => Boolean(onMoveSession),
  });
  const displaySessions = onMoveSession ? reschedule.sessions : initialSessions;
  const volumeLabel = formatVolume
    ? formatVolume(week.plannedKm, week)
    : formatDistance(week.plannedKm, units);

  useEffect(() => {
    if (isExpanded) {
      setShouldRenderExpanded(true);
    }
  }, [isExpanded]);

  useEffect(() => {
    if (rescheduleResetKey !== undefined) {
      reschedule.reset();
    }
  }, [rescheduleResetKey]);

  useEffect(() => () => {
    onDragActiveChange?.(false);
  }, [onDragActiveChange]);

  function handleWeekPress() {
    onWeekPress?.(week.weekIndex, week);
    onToggleWeek?.(week.weekIndex, week);
  }

  function handleRecordTouchStart(pageY: number) {
    onDragActiveChange?.(true);
    reschedule.recordTouchStart(pageY);
  }

  function handleCancelDrag() {
    reschedule.cancelDrag();
    onDragActiveChange?.(false);
  }

  function handleFinishDrag() {
    const dragState = reschedule.finishDrag();
    onDragActiveChange?.(false);

    if (!dragState || dragState.fromIndex === dragState.overIndex) {
      return;
    }

    onMoveSession?.(
      week.weekIndex,
      dragState.fromIndex,
      dragState.overIndex,
      week,
    );
  }

  return (
    <View
      style={[
        styles.weekRow,
        week.isPast && styles.weekRowPast,
        (week.isCurrent || isExpanded) && styles.weekRowCurrentOrExpanded,
      ]}
      testID={`block-week-row-${week.weekNumber}`}
    >
      <Pressable
        disabled={!onWeekPress && !onToggleWeek}
        onPress={handleWeekPress}
        style={({ pressed }) => [styles.weekPressable, pressed && styles.pressed]}
        testID={`block-week-row-press-${week.weekNumber}`}
      >
        <View style={styles.weekMain}>
          <View style={styles.weekLeft}>
            <Text
              style={[
                styles.weekNumber,
                (week.isCurrent || isExpanded) && styles.weekNumberEmphasis,
              ]}
            >
              W{week.weekNumber}
            </Text>
            <Text style={styles.phaseMini}>{phaseLabel(week.phase)}</Text>
          </View>

          <View style={styles.runDots}>
            {Array.from({ length: 7 }, (_, index) => {
              const type = sessionType(week.sessions[index] ?? null);
              return (
                <View
                  key={`${week.weekNumber}-${index}`}
                  style={[
                    styles.runDot,
                    { backgroundColor: rowDotColor(type) },
                  ]}
                />
              );
            })}
          </View>

          <View style={styles.weekRight}>
            <Text style={styles.weekKm}>{volumeLabel}</Text>
          </View>
        </View>

        <View style={styles.weekBar}>
          <AnimatedProgressFill
            progress={clampRatio(volumeRatio)}
            fillStyle={[styles.weekBarFill, { backgroundColor: phaseColor }]}
            testID={`block-week-volume-${week.weekNumber}`}
          />
        </View>
      </Pressable>

      {shouldRenderExpanded ? (
        <AnimatedWeekExpansion
          expanded={isExpanded}
          expandedMarginTop={10}
          showDivider={false}
          onCollapseEnd={() => setShouldRenderExpanded(false)}
        >
          <BlockWeekExpandedBody
            week={week}
            sessions={displaySessions}
            units={units}
            helperLabel={helperLabel}
            onDayPress={onDayPress}
            onMoveSession={onMoveSession}
            dragState={reschedule.dragState}
            dragY={reschedule.dragY}
            onRegisterDayLayout={reschedule.registerSlotLayout}
            onRecordTouchStart={handleRecordTouchStart}
            onBeginDrag={reschedule.beginDrag}
            onUpdateDrag={reschedule.updateDrag}
            onCancelDrag={handleCancelDrag}
            onFinishDrag={handleFinishDrag}
            formatSessionLabel={formatSessionLabelOverride}
            formatSessionMeta={formatSessionMeta}
          />
        </AnimatedWeekExpansion>
      ) : null}
    </View>
  );
}

export function BlockWeekExpandedBody({
  week,
  sessions,
  units = 'metric',
  helperLabel = null,
  onDayPress,
  onMoveSession,
  dragState,
  dragY,
  onRegisterDayLayout,
  onRecordTouchStart,
  onBeginDrag,
  onUpdateDrag,
  onCancelDrag,
  onFinishDrag,
  formatSessionLabel: formatSessionLabelOverride,
  formatSessionMeta,
}: {
  week: BlockWeekListWeek;
  sessions?: readonly (Partial<PlannedSession> | null)[];
  units?: DistanceUnits;
  helperLabel?: string | null;
  onDayPress?: BlockWeekListProps['onDayPress'];
  onMoveSession?: BlockWeekListProps['onMoveSession'];
  dragState?: { fromIndex: number; overIndex: number } | null;
  dragY?: Animated.Value;
  onRegisterDayLayout?: (index: number, y: number, height: number) => void;
  onRecordTouchStart?: (pageY: number) => void;
  onBeginDrag?: (index: number) => boolean;
  onUpdateDrag?: (pageY: number) => void;
  onCancelDrag?: () => void;
  onFinishDrag?: () => void;
  formatSessionLabel?: BlockWeekListProps['formatSessionLabel'];
  formatSessionMeta?: BlockWeekListProps['formatSessionMeta'];
}) {
  const displaySessions = sessions ?? week.sessions;
  const canMoveSessions = Boolean(onMoveSession);

  return (
    <View testID={`block-week-expanded-${week.weekNumber}`}>
      {helperLabel ? <Text style={styles.helperLabel}>{helperLabel}</Text> : null}
      {Array.from({ length: 7 }, (_, dayIndex) => {
        const session = displaySessions[dayIndex] ?? null;
        const type = sessionType(session);
        const title = formatSessionLabelOverride
          ? formatSessionLabelOverride(session, dayIndex, week)
          : defaultSessionLabel(session, units);
        const meta = formatSessionMeta
          ? formatSessionMeta(session, dayIndex, week)
          : defaultSessionMeta(session, units);
        const dateLabel = formatShortDate(resolveDayDate(week, session, dayIndex));
        const dragging = dragState?.fromIndex === dayIndex;
        const dropTarget =
          dragState?.overIndex === dayIndex && dragState.fromIndex !== dayIndex;

        return (
          <Animated.View
            key={`${week.weekNumber}-${dayIndex}`}
            onLayout={(event) => {
              onRegisterDayLayout?.(
                dayIndex,
                event.nativeEvent.layout.y,
                event.nativeEvent.layout.height,
              );
            }}
            style={[
              styles.dayRowWrap,
              dragging && dragY ? { transform: [{ translateY: dragY }] } : null,
            ]}
          >
            <View
              style={[
                styles.dayRow,
                onDayPress && styles.dayRowEditable,
                dropTarget && styles.dayRowDropTarget,
                dragging && styles.dayRowDragging,
              ]}
            >
              {dropTarget ? (
                <View pointerEvents="none" style={styles.dayRowDropTargetOutline} />
              ) : null}
              <Pressable
                disabled={!onDayPress}
                onPress={() => onDayPress?.(week.weekIndex, dayIndex, session, week)}
                style={({ pressed }) => [
                  styles.dayRowPressable,
                  pressed && styles.pressed,
                ]}
                testID={`block-week-day-${week.weekNumber}-${dayIndex}`}
              >
                <View style={styles.dayMeta}>
                  <Text style={styles.dayName}>{DAYS[dayIndex]}</Text>
                  {dateLabel ? <Text style={styles.dayDate}>{dateLabel}</Text> : null}
                </View>
                <View style={styles.daySession}>
                  <View
                    style={[
                      styles.dayDot,
                      { backgroundColor: dayDotColor(type) },
                      type === 'REST' && styles.dayDotRest,
                    ]}
                  />
                  <View style={styles.dayCopy}>
                    <Text
                      style={[styles.sessionTitle, type === 'REST' && styles.sessionTitleRest]}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    <Text
                      style={[styles.sessionMeta, type === 'REST' && styles.sessionMetaRest]}
                      numberOfLines={1}
                    >
                      {meta}
                    </Text>
                  </View>
                </View>
              </Pressable>

              <View style={styles.dayRight}>
                {canMoveSessions ? (
                  <DragHandle
                    testID={`block-week-drag-handle-${week.weekNumber}-${dayIndex}`}
                    disabled={!canMoveSessions}
                    active={Boolean(dragging)}
                    onMouseDown={(event) => {
                      event.stopPropagation?.();
                      onRecordTouchStart?.(event.clientY);
                      onBeginDrag?.(dayIndex);
                    }}
                    onMouseMove={(event) => {
                      event.stopPropagation?.();
                      onUpdateDrag?.(event.clientY);
                    }}
                    onMouseUp={(event) => {
                      event.stopPropagation?.();
                      onFinishDrag?.();
                    }}
                    onTouchStart={(event) => {
                      event.stopPropagation?.();
                      onRecordTouchStart?.(event.nativeEvent.pageY);
                    }}
                    onLongPress={(event) => {
                      onRecordTouchStart?.(event.nativeEvent.pageY);
                      onBeginDrag?.(dayIndex);
                    }}
                    onTouchMove={(event) => {
                      event.stopPropagation?.();
                      onUpdateDrag?.(event.nativeEvent.pageY);
                    }}
                    onTouchCancel={() => {
                      onCancelDrag?.();
                    }}
                    onTouchEnd={() => {
                      onFinishDrag?.();
                    }}
                  />
                ) : (
                  <Text style={styles.chevron}>›</Text>
                )}
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  weekList: {
    gap: 5,
  },
  weekRow: {
    paddingHorizontal: 11,
    paddingTop: 10,
    paddingBottom: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  weekRowPast: {
    borderColor: C.border,
  },
  weekRowCurrentOrExpanded: {
    backgroundColor: C.surface,
    borderColor: `${C.clay}59`,
  },
  weekPressable: {
    width: '100%',
  },
  weekMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  weekLeft: {
    width: 38,
  },
  weekNumber: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    color: C.muted,
  },
  weekNumberEmphasis: {
    color: C.clay,
  },
  phaseMini: {
    marginTop: 1,
    fontFamily: FONTS.sans,
    fontSize: 8,
    color: C.muted,
    textTransform: 'uppercase',
  },
  runDots: {
    flex: 1,
    flexDirection: 'row',
    gap: 3.5,
    alignItems: 'center',
  },
  runDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  weekRight: {
    width: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  weekKm: {
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    color: C.ink,
  },
  weekBar: {
    height: 2,
    marginTop: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(229, 221, 208, 0.72)',
  },
  weekBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  helperLabel: {
    marginBottom: 6,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.muted,
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
  dayRowEditable: {
    borderRadius: 8,
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
  dayRowDragging: {
    shadowColor: C.clay,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dayRowPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  dayDotRest: {
    backgroundColor: C.slate,
  },
  dayCopy: {
    flex: 1,
    minWidth: 0,
  },
  sessionTitle: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: C.ink,
  },
  sessionTitleRest: {
    fontFamily: FONTS.sansMedium,
    color: C.ink,
  },
  sessionMeta: {
    marginTop: 1,
    fontFamily: FONTS.sans,
    fontSize: 10.5,
    color: C.muted,
  },
  sessionMetaRest: {
    color: C.muted,
  },
  dayRight: {
    minWidth: 34,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 2,
  },
  chevron: {
    width: 28,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 17,
    color: C.muted,
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.72,
  },
});
