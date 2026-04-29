import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type DimensionValue,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  SessionType,
  WeeklyVolumeDay,
  WeeklyVolumeMetric,
  WeeklyVolumeSummary,
} from '@steady/types';
import { getWeeklyVolumeDayMetric } from '@steady/types';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { triggerSelectionChangeHaptic } from '../../lib/haptics';
import {
  formatDistance,
  formatDurationAccessible,
} from '../../lib/units';
import { usePreferences } from '../../providers/preferences-context';
import { AnimatedProgressFill } from '../ui/AnimatedProgressFill';

const WEEKLY_VOLUME_BORDER = C.border;
const WEEKLY_VOLUME_SURFACE = C.surface;
const CARD_HORIZONTAL_PADDING = 18;
const COLLAPSED_HEIGHT = 92;
const EXPANDED_HEIGHT = 268;
const EXPAND_DURATION_MS = 290;
const COLLAPSE_DURATION_MS = 620;
const CHART_PLOT_HEIGHT = 150;
const BUCKET_MAX_HEIGHT = CHART_PLOT_HEIGHT;
const BUCKET_MIN_HEIGHT = 12;
const CHART_TOUCH_HEIGHT = CHART_PLOT_HEIGHT + 30;
const PLANNED_TARGET_TICK_HEIGHT = 2;
const DISTANCE_AXIS_MAX_FILL_RATIO = 0.96;
const TOOLTIP_WIDTH = 132;
const PLOT_FALLBACK_WIDTH = 280;
const STATUS_EXPANDED_TOP = 23;
const STATUS_COLLAPSED_TOP = 43;
const TRANSITION_TRACK_COLLAPSED_TOP = 30;
const TRANSITION_TRACK_EXPANDED_TOP = 202;
const TRANSITION_TRACK_EXPANDED_LEFT = 34;
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const TYPE_LABELS: Record<SessionType, string> = {
  EASY: 'easy',
  INTERVAL: 'intervals',
  TEMPO: 'tempo',
  LONG: 'long run',
  REST: 'rest',
};

const TYPE_COLOURS: Record<SessionType, { solid: string; pale: string }> = {
  EASY: { solid: C.forest, pale: C.forestBg },
  INTERVAL: { solid: C.clay, pale: C.clayBg },
  TEMPO: { solid: C.amber, pale: C.amberBg },
  LONG: { solid: C.navy, pale: C.navyBg },
  REST: { solid: C.slate, pale: C.border },
};

interface WeeklyVolumeCardProps {
  summary: WeeklyVolumeSummary;
  focused?: boolean;
  onScrubActiveChange?: (active: boolean) => void;
}

interface WeeklyLoadCardProps {
  actualKm: number;
  plannedKm: number;
}

function oppositeMetric(metric: WeeklyVolumeMetric): WeeklyVolumeMetric {
  return metric === 'distance' ? 'time' : 'distance';
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - ((-2 * value + 2) ** 3) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function metricLabel(metric: WeeklyVolumeMetric): string {
  return metric === 'distance' ? 'km' : 'time';
}

function metricAccessibleLabel(metric: WeeklyVolumeMetric): string {
  return metric === 'distance' ? 'distance' : 'time';
}

function metricAccent(metric: WeeklyVolumeMetric): string {
  return metric === 'distance' ? C.metricDistance : C.metricTime;
}

function formatDurationMetricValue(totalSeconds: number): string {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}min`;
  }

  return minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, '0')}`;
}

function summaryMetricValues(summary: WeeklyVolumeSummary, metric: WeeklyVolumeMetric) {
  return metric === 'distance'
    ? { actual: summary.actualDistanceKm, planned: summary.plannedDistanceKm }
    : { actual: summary.actualSeconds, planned: summary.plannedSeconds };
}

function formatMetricValue(value: number, metric: WeeklyVolumeMetric, units: 'metric' | 'imperial'): string {
  return metric === 'distance'
    ? formatDistance(value, units)
    : formatDurationMetricValue(value);
}

function formatMetricAccessible(value: number, metric: WeeklyVolumeMetric, units: 'metric' | 'imperial'): string {
  return metric === 'distance'
    ? formatDistance(value, units, { spaced: true })
    : formatDurationAccessible(value);
}

function niceCeil(rawValue: number, options: { allowFraction?: boolean } = {}): number {
  const value = Math.max(rawValue, options.allowFraction ? Number.EPSILON : 1);
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const steps = [1, 1.5, 2, 3, 5, 10];
  const step = steps.find((candidate) => normalized <= candidate) ?? 10;

  return step * magnitude;
}

function nextNiceCeil(axisMax: number): number {
  return niceCeil(axisMax * 1.001);
}

type TimeAxisUnit = 'minutes' | 'hours';

function timeAxisUnitForSummary(summary: WeeklyVolumeSummary): TimeAxisUnit {
  return summary.days.some((day) => (
    day.plannedSeconds > 60 * 60 || day.actualSeconds > 60 * 60
  ))
    ? 'hours'
    : 'minutes';
}

function axisMaxForMetric(
  maxValue: number,
  metric: WeeklyVolumeMetric,
  timeAxisUnit: TimeAxisUnit,
): number {
  if (metric === 'time' && timeAxisUnit === 'hours') {
    return niceCeil(Math.max(1 / 60, maxValue / 3600) * 1.12) * 3600;
  }

  if (metric === 'distance') {
    const displayValue = Math.max(1, maxValue);
    const axisMax = niceCeil(displayValue);

    return displayValue / axisMax > DISTANCE_AXIS_MAX_FILL_RATIO
      ? nextNiceCeil(axisMax)
      : axisMax;
  }

  const displayValue = metric === 'time'
    ? Math.max(1, Math.ceil(maxValue / 60))
    : Math.max(1, maxValue);
  const axisMax = niceCeil(displayValue * 1.12);

  return metric === 'time' ? axisMax * 60 : axisMax;
}

function axisTicks(axisMax: number, metric: WeeklyVolumeMetric, timeAxisUnit: TimeAxisUnit): number[] {
  const displayAxisMax = metric === 'time'
    ? axisMax / (timeAxisUnit === 'hours' ? 3600 : 60)
    : axisMax;
  const step = niceCeil(displayAxisMax / 3, { allowFraction: metric === 'time' && timeAxisUnit === 'hours' });
  const tickStep = metric === 'time'
    ? step * (timeAxisUnit === 'hours' ? 3600 : 60)
    : step;
  const ticks: number[] = [];

  for (let tick = axisMax; tick > 0; tick -= tickStep) {
    ticks.push(Math.max(0, tick));
  }

  return [...ticks, 0];
}

function formatAxisHourValue(value: number): string {
  const hours = Math.max(0, value / 3600);
  const roundedHours = Math.round(hours * 10) / 10;
  const label = Number.isInteger(roundedHours)
    ? String(roundedHours)
    : roundedHours.toFixed(1);

  return `${label}h`;
}

function formatAxisMetricValue(
  value: number,
  metric: WeeklyVolumeMetric,
  units: 'metric' | 'imperial',
  timeAxisUnit: TimeAxisUnit,
): string {
  if (metric === 'distance') {
    return formatDistance(value, units);
  }

  return timeAxisUnit === 'hours'
    ? formatAxisHourValue(value)
    : `${Math.max(0, Math.round(value / 60))}min`;
}

function hasDisplayableOverrun(value: number, metric: WeeklyVolumeMetric): boolean {
  return metric === 'distance' ? value > 0 : Math.round(value / 60) > 0;
}

function metricNoun(metric: WeeklyVolumeMetric): string {
  return metric === 'distance' ? 'mileage' : 'training';
}

function dayHasComeDue(day: WeeklyVolumeDay): boolean {
  return day.status === 'completed'
    || day.status === 'over'
    || day.status === 'varied'
    || day.status === 'missed';
}

function dayMetricValue(day: WeeklyVolumeDay, metric: WeeklyVolumeMetric, field: 'planned' | 'actual'): number {
  if (metric === 'distance') {
    return field === 'planned' ? day.plannedDistanceKm : day.actualDistanceKm;
  }

  return field === 'planned' ? day.plannedSeconds : day.actualSeconds;
}

function weeklyStatus(summary: WeeklyVolumeSummary, metric: WeeklyVolumeMetric): string {
  const noun = metricNoun(metric);
  const totals = summaryMetricValues(summary, metric);
  const hasActual = totals.actual > 0;
  const missedRun = summary.days.find((day) => day.status === 'missed' && day.plannedType !== 'REST');

  if (!hasActual && !missedRun && totals.planned > 0) {
    const hasComeDueRun = summary.days.some((day) => day.plannedType !== 'REST' && dayHasComeDue(day));
    return hasComeDueRun ? 'No training logged yet' : 'Start of the week. Nothing logged yet.';
  }

  if (missedRun?.plannedType === 'EASY') {
    return 'Easy run missed so far';
  }
  if (missedRun) {
    return `${DAY_NAMES[missedRun.dayIndex]} run not logged yet`;
  }

  if (totals.planned > 0 && totals.actual > totals.planned * 1.15) {
    return `Well over planned ${noun}`;
  }

  const weekComplete = summary.days.every((day) => (
    day.plannedType === 'REST'
    || day.status === 'completed'
    || day.status === 'over'
    || day.status === 'varied'
  ));
  const weekRatio = totals.planned > 0 ? totals.actual / totals.planned : 0;

  if (weekComplete && weekRatio >= 0.95 && weekRatio <= 1.05) {
    return 'Week landed close to plan';
  }

  if (totals.planned > 0 && totals.actual >= totals.planned) {
    return `Weekly ${noun} already covered`;
  }

  const due = summary.days.reduce(
    (acc, day) => {
      if (!dayHasComeDue(day)) return acc;

      return {
        planned: acc.planned + dayMetricValue(day, metric, 'planned'),
        actual: acc.actual + dayMetricValue(day, metric, 'actual'),
      };
    },
    { planned: 0, actual: 0 },
  );

  if (due.planned > 0) {
    const dueRatio = due.actual / due.planned;
    if (dueRatio < 0.85) {
      return `A little behind planned ${noun}`;
    }
    if (dueRatio > 1.05) {
      return `A little over planned ${noun}`;
    }
  }

  return 'On track so far';
}

function dayCenterX(dayIndex: number, width: number, dayCount: number): number {
  if (dayCount <= 0) return 0;
  return ((dayIndex + 0.5) / dayCount) * width;
}

function dayIndexFromX(x: number, width: number, dayCount: number): number {
  if (dayCount <= 0 || width <= 0) return 0;
  const clampedX = clamp(x, 0, width);
  return clamp(Math.floor((clampedX / width) * dayCount), 0, dayCount - 1);
}

function WeeklyVolumeTitle({
  expanded,
  chevronTestID,
}: {
  expanded: boolean;
  chevronTestID?: string;
}) {
  return (
    <View style={styles.labelWithChevron}>
      <Text style={styles.label}>WEEKLY VOLUME</Text>
      <View
        style={[styles.chevron, expanded ? styles.chevronExpanded : null]}
        testID={chevronTestID}
      />
    </View>
  );
}

function WeeklyVolumeTooltip({
  day,
  metric,
  units,
}: {
  day: WeeklyVolumeDay;
  metric: WeeklyVolumeMetric;
  units: 'metric' | 'imperial';
}) {
  const values = getWeeklyVolumeDayMetric(day, metric);
  const title = `${DAY_NAMES[day.dayIndex]} ${TYPE_LABELS[day.plannedType]}`;

  return (
    <View
      style={styles.tooltip}
      testID="weekly-volume-tooltip"
    >
      <Text style={styles.tooltipTitle}>{title}</Text>
      <Text style={styles.tooltipLine}>
        planned {formatMetricValue(values.planned, metric, units)}
      </Text>
      <Text style={styles.tooltipLine}>
        done {formatMetricValue(values.actual, metric, units)}
      </Text>
      {hasDisplayableOverrun(values.over, metric) ? (
        <Text style={styles.tooltipOver}>
          +{formatMetricValue(values.over, metric, units)} over
        </Text>
      ) : null}
    </View>
  );
}

function WeeklyVolumeBucket({
  day,
  metric,
  units,
  axisMax,
  selected,
  onPress,
}: {
  day: WeeklyVolumeDay;
  metric: WeeklyVolumeMetric;
  units: 'metric' | 'imperial';
  axisMax: number;
  selected: boolean;
  onPress: () => void;
}) {
  const values = getWeeklyVolumeDayMetric(day, metric);
  const plannedColour = TYPE_COLOURS[day.plannedType];
  const actualColour = TYPE_COLOURS[day.actualType ?? day.plannedType];
  const plannedHeight = values.planned > 0
    ? Math.max(BUCKET_MIN_HEIGHT, (values.planned / axisMax) * BUCKET_MAX_HEIGHT)
    : 0;
  const fillHeight = values.planned > 0
    ? Math.min(plannedHeight, (values.actual / values.planned) * plannedHeight)
    : 0;
  const hasOverrun = values.over > 0;
  const actualHeight = hasOverrun
    ? Math.max(plannedHeight, (values.actual / axisMax) * BUCKET_MAX_HEIGHT)
    : 0;
  const plannedTargetBottom = Math.max(
    0,
    Math.min(
      actualHeight - PLANNED_TARGET_TICK_HEIGHT,
      plannedHeight - (PLANNED_TARGET_TICK_HEIGHT / 2),
    ),
  );
  const isRest = day.plannedType === 'REST' || values.planned <= 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${DAY_NAMES[day.dayIndex]} weekly volume, planned ${formatMetricAccessible(values.planned, metric, units)}, done ${formatMetricAccessible(values.actual, metric, units)}`}
      onPress={onPress}
      style={styles.bucketButton}
      testID={`weekly-volume-bucket-${day.dayIndex}`}
    >
      <View style={styles.bucketStack}>
        {isRest ? (
          <View style={styles.restDot} />
        ) : (
          <>
            {hasOverrun ? (
              <View
                style={[
                  styles.overrunBucket,
                  {
                    height: actualHeight,
                    backgroundColor: actualColour.solid,
                  },
                ]}
                testID={`weekly-volume-overrun-${day.dayIndex}`}
              >
                <View
                  style={[styles.plannedTargetTick, { bottom: plannedTargetBottom }]}
                  testID={`weekly-volume-planned-target-${day.dayIndex}`}
                />
              </View>
            ) : (
              <View
                style={[
                  styles.bucketShell,
                  {
                    height: plannedHeight,
                    backgroundColor: plannedColour.pale,
                    borderColor: `${plannedColour.solid}35`,
                  },
                ]}
                testID={`weekly-volume-bucket-shell-${day.dayIndex}`}
              >
                <View
                  style={[
                    styles.bucketFill,
                    {
                      height: fillHeight,
                      backgroundColor: actualColour.solid,
                    },
                  ]}
                />
              </View>
            )}
          </>
        )}
      </View>
      <Text style={[styles.dayLabel, selected ? styles.dayLabelSelected : null]}>
        {DAY_LABELS[day.dayIndex]}
      </Text>
      <View style={[styles.selectedTick, selected ? styles.selectedTickActive : null]} />
    </Pressable>
  );
}

function WeeklyVolumeBucketChart({
  summary,
  metric,
  units,
  selectedDayIndex,
  onSelectDay,
  onMetricHold,
  onMetricRelease,
  onScrubActiveChange,
}: {
  summary: WeeklyVolumeSummary;
  metric: WeeklyVolumeMetric;
  units: 'metric' | 'imperial';
  selectedDayIndex: number | null;
  onSelectDay: (dayIndex: number | null) => void;
  onMetricHold: () => void;
  onMetricRelease: () => void;
  onScrubActiveChange?: (active: boolean) => void;
}) {
  const plotRef = useRef<View>(null);
  const plotFrameRef = useRef({ x: 0, width: 0, measured: false });
  const selectedDayIndexRef = useRef(selectedDayIndex);
  const scrubActiveRef = useRef(false);
  const onScrubActiveChangeRef = useRef(onScrubActiveChange);
  const [plotWidth, setPlotWidth] = useState(0);
  const [scrubX, setScrubX] = useState<number | null>(null);
  const maxChartValue = Math.max(
    1,
    ...summary.days.map((day) => {
      const values = getWeeklyVolumeDayMetric(day, metric);
      return Math.max(values.planned, values.actual);
    }),
  );
  const timeAxisUnit = timeAxisUnitForSummary(summary);
  const chartAxisMax = axisMaxForMetric(maxChartValue, metric, timeAxisUnit);
  const ticks = axisTicks(chartAxisMax, metric, timeAxisUnit);
  const selectedDay = selectedDayIndex == null ? null : summary.days[selectedDayIndex] ?? null;
  const usablePlotWidth = plotWidth > 0 ? plotWidth : PLOT_FALLBACK_WIDTH;
  const selectedX = selectedDayIndex == null
    ? 0
    : scrubX ?? dayCenterX(selectedDayIndex, usablePlotWidth, summary.days.length);
  const tooltipLeft = clamp(
    selectedX - (TOOLTIP_WIDTH / 2),
    0,
    Math.max(0, usablePlotWidth - TOOLTIP_WIDTH),
  );
  const selectedGuideLeft = clamp(selectedX, 0, Math.max(0, usablePlotWidth - 1));

  useEffect(() => {
    onScrubActiveChangeRef.current = onScrubActiveChange;
  }, [onScrubActiveChange]);

  useEffect(() => () => {
    if (scrubActiveRef.current) {
      onScrubActiveChangeRef.current?.(false);
    }
  }, []);

  useEffect(() => {
    selectedDayIndexRef.current = selectedDayIndex;
    if (selectedDayIndex == null) {
      setScrubX(null);
    }
  }, [selectedDayIndex]);

  const setScrubActive = (active: boolean) => {
    if (scrubActiveRef.current === active) return;
    scrubActiveRef.current = active;
    onScrubActiveChangeRef.current?.(active);
  };

  const measurePlot = () => {
    plotRef.current?.measureInWindow?.((x, _y, width) => {
      plotFrameRef.current = { x, width, measured: true };
      if (width) setPlotWidth(width);
    });
  };

  const selectDayFromX = (x: number, width = usablePlotWidth) => {
    if (!summary.days.length || width <= 0) return;
    const clampedX = clamp(x, 0, width);
    const nextDayIndex = dayIndexFromX(clampedX, width, summary.days.length);

    setScrubX(clampedX);
    if (selectedDayIndexRef.current !== nextDayIndex) {
      selectedDayIndexRef.current = nextDayIndex;
      onSelectDay(nextDayIndex);
    }
  };

  const selectDayFromEvent = (event: GestureResponderEvent) => {
    const frame = plotFrameRef.current;
    const pageX = event.nativeEvent.pageX;
    if (frame.measured && Number.isFinite(pageX)) {
      selectDayFromX(pageX - frame.x, frame.width);
      return;
    }

    selectDayFromX(event.nativeEvent.locationX);
  };
  const clearScrubSelection = () => {
    if (!scrubActiveRef.current) return;
    setScrubActive(false);
    selectedDayIndexRef.current = null;
    setScrubX(null);
    onSelectDay(null);
  };
  const shouldScrubFromEvent = (event: GestureResponderEvent) => (
    event.nativeEvent.locationY < CHART_PLOT_HEIGHT
  );

  return (
    <View style={styles.chartWrap} testID="weekly-volume-chart">
      <View style={styles.chartBody}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hold to show the other weekly volume metric"
          delayLongPress={250}
          onLongPress={onMetricHold}
          onPressOut={onMetricRelease}
          onTouchEnd={onMetricRelease}
          style={styles.yAxis}
          testID="weekly-volume-y-axis"
        >
          {ticks.map((tick) => (
            <Text key={`${tick}`} style={styles.yAxisLabel}>
              {formatAxisMetricValue(tick, metric, units, timeAxisUnit)}
            </Text>
          ))}
        </Pressable>
        <View
          ref={plotRef}
          style={styles.plotArea}
          onLayout={(event: LayoutChangeEvent) => {
            setPlotWidth(event.nativeEvent.layout.width);
            requestAnimationFrame(measurePlot);
          }}
          onStartShouldSetResponder={shouldScrubFromEvent}
          onMoveShouldSetResponder={shouldScrubFromEvent}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(event) => {
            setScrubActive(true);
            measurePlot();
            selectDayFromEvent(event);
          }}
          onResponderMove={selectDayFromEvent}
          onResponderRelease={clearScrubSelection}
          onResponderTerminate={clearScrubSelection}
          testID="weekly-volume-plot-scrub-surface"
        >
          <View pointerEvents="none" style={styles.gridLayer}>
            {ticks.map((tick) => (
              <View
                key={`${tick}`}
                style={[
                  styles.gridLine,
                  { top: (1 - (tick / chartAxisMax)) * CHART_PLOT_HEIGHT },
                ]}
              />
            ))}
          </View>
          {selectedDay ? (
            <View pointerEvents="none" style={styles.selectionLayer}>
              <View style={[styles.selectedGuide, { left: selectedGuideLeft }]} />
            </View>
          ) : null}
          <View pointerEvents="box-none" style={styles.bucketRow}>
            {summary.days.map((day) => (
              <WeeklyVolumeBucket
                key={day.dayIndex}
                day={day}
                metric={metric}
                units={units}
                axisMax={chartAxisMax}
                selected={selectedDayIndex === day.dayIndex}
                onPress={() => {
                  setScrubX(null);
                  onSelectDay(day.dayIndex);
                }}
              />
            ))}
          </View>
          {selectedDay ? (
            <View
              pointerEvents="none"
              style={[styles.tooltipLayer, { left: tooltipLeft }]}
            >
              <WeeklyVolumeTooltip day={selectedDay} metric={metric} units={units} />
            </View>
          ) : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hold to show the other weekly volume metric"
        delayLongPress={250}
        onLongPress={onMetricHold}
        onPressOut={onMetricRelease}
        onTouchEnd={onMetricRelease}
        style={styles.lowerMetricHoldSurface}
        testID="weekly-volume-lower-hold-surface"
      />
    </View>
  );
}

function WeeklyVolumeCollapsedContent({
  values,
  metric,
  units,
  status,
  isHolding,
  activeColor,
  chevronTestID,
  showTrack = true,
  showStatus = true,
}: {
  values: { actual: number; planned: number };
  metric: WeeklyVolumeMetric;
  units: 'metric' | 'imperial';
  status: string;
  isHolding: boolean;
  activeColor: string;
  chevronTestID?: string;
  showTrack?: boolean;
  showStatus?: boolean;
}) {
  const progress = values.planned > 0
    ? Math.max(0, Math.min(1, values.actual / values.planned))
    : 0;

  return (
    <>
      <View style={styles.labelRow}>
        <WeeklyVolumeTitle expanded={false} chevronTestID={chevronTestID} />
        <View style={styles.valueRow}>
          <Text style={[styles.actual, { color: activeColor }]}>
            {formatMetricValue(values.actual, metric, units)}
          </Text>
          <Text style={styles.planned}>
            / {formatMetricValue(values.planned, metric, units)}
          </Text>
        </View>
      </View>
      {showTrack ? (
        <View style={styles.track}>
          <AnimatedProgressFill progress={progress} fillStyle={[styles.fill, { backgroundColor: activeColor }]} />
        </View>
      ) : null}
      {showStatus ? (
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>{status}</Text>
          {isHolding ? (
            <Text style={styles.holdPill}>{metricLabel(metric)} view</Text>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

export function WeeklyVolumeCard({
  summary,
  focused = true,
  onScrubActiveChange,
}: WeeklyVolumeCardProps) {
  const { units, weeklyVolumeMetric } = usePreferences();
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [showExpandedContent, setShowExpandedContent] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const didLongPressRef = useRef(false);
  const expansion = useRef(new Animated.Value(0)).current;
  const activeMetric = isHolding ? oppositeMetric(weeklyVolumeMetric) : weeklyVolumeMetric;
  const activeMetricColor = metricAccent(activeMetric);
  const collapsedValues = summaryMetricValues(summary, activeMetric);
  const status = weeklyStatus(summary, activeMetric);
  const transitionTrackProgress = collapsedValues.planned > 0
    ? Math.max(0, Math.min(1, collapsedValues.actual / collapsedValues.planned))
    : 0;
  const targetHeight = expanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
  const animatedHeight = useMemo(
    () => expansion.interpolate({
      inputRange: [0, 1],
      outputRange: [COLLAPSED_HEIGHT, targetHeight],
      extrapolate: 'clamp',
    }),
    [expansion, targetHeight],
  );
  const expandedContentOpacity = useMemo(
    () => expansion.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    [expansion],
  );
  const collapsedContentOpacity = useMemo(
    () => expansion.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
    [expansion],
  );
  const chartOpacity = useMemo(
    () => expansion.interpolate({
      inputRange: [0, 0.18, 1],
      outputRange: [0, 0, 1],
      extrapolate: 'clamp',
    }),
    [expansion],
  );
  const chartTranslateY = useMemo(
    () => expansion.interpolate({
      inputRange: [0, 1],
      outputRange: [8, 0],
      extrapolate: 'clamp',
    }),
    [expansion],
  );
  const statusTop = useMemo(
    () => expansion.interpolate({
      inputRange: [0, 1],
      outputRange: [STATUS_COLLAPSED_TOP, STATUS_EXPANDED_TOP],
      extrapolate: 'clamp',
    }),
    [expansion],
  );
  const transitionTrackTop = useMemo(
    () => expansion.interpolate({
      inputRange: [0, 1],
      outputRange: [TRANSITION_TRACK_COLLAPSED_TOP, TRANSITION_TRACK_EXPANDED_TOP],
      extrapolate: 'clamp',
    }),
    [expansion],
  );
  const transitionTrackLeft = useMemo(
    () => expansion.interpolate({
      inputRange: [0, 1],
      outputRange: [0, TRANSITION_TRACK_EXPANDED_LEFT],
      extrapolate: 'clamp',
    }),
    [expansion],
  );
  const transitionTrackHeight = useMemo(
    () => expansion.interpolate({
      inputRange: [0, 1],
      outputRange: [5, 1],
      extrapolate: 'clamp',
    }),
    [expansion],
  );
  const transitionTrackOpacity = useMemo(
    () => expansion.interpolate({
      inputRange: [0, 0.72, 1],
      outputRange: [1, 0.45, 0],
      extrapolate: 'clamp',
    }),
    [expansion],
  );
  const transitionTrackFillOpacity = useMemo(
    () => expansion.interpolate({
      inputRange: [0, 0.48, 0.86],
      outputRange: [1, 0.55, 0],
      extrapolate: 'clamp',
    }),
    [expansion],
  );
  const accessibilityLabel = `Weekly volume, ${formatMetricAccessible(
    collapsedValues.actual,
    activeMetric,
    units,
  )} of ${formatMetricAccessible(collapsedValues.planned, activeMetric, units)}, ${status}. ${
    expanded ? `Expanded. Touch the chart to inspect days. Hold the header or axis to show ${metricAccessibleLabel(oppositeMetric(weeklyVolumeMetric))}.` : `Double tap to inspect week shape. Hold to show ${metricAccessibleLabel(oppositeMetric(weeklyVolumeMetric))}.`
  }`;

  useEffect(() => {
    if (focused) return;

    didLongPressRef.current = false;
    expansion.stopAnimation?.();
    expansion.setValue(0);
    setExpanded(false);
    setShowExpandedContent(false);
    setIsHolding(false);
    setSelectedDayIndex(null);
  }, [focused, expansion]);

  useEffect(() => {
    const toValue = expanded ? 1 : 0;
    if (expanded) {
      setShowExpandedContent(true);
    }

    if (reducedMotion) {
      expansion.setValue(toValue);
      if (!expanded) {
        setShowExpandedContent(false);
        setSelectedDayIndex(null);
      }
      return;
    }

    const animation = Animated.timing(expansion, {
      toValue,
      duration: expanded ? EXPAND_DURATION_MS : COLLAPSE_DURATION_MS,
      easing: expanded ? Easing.out(Easing.cubic) : easeInOutCubic,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished && !expanded) {
        setShowExpandedContent(false);
        setSelectedDayIndex(null);
      }
    });

    return () => {
      animation.stop?.();
    };
  }, [expanded, expansion, reducedMotion]);

  function handleCollapsedPress() {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }

    setSelectedDayIndex(null);
    setShowExpandedContent(true);
    setExpanded(true);
  }

  function handleExpandedHeaderPress() {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }

    collapse();
  }

  function handleLongPress() {
    if (isHolding) return;
    didLongPressRef.current = true;
    setIsHolding(true);
    triggerSelectionChangeHaptic();
  }

  function handlePressOut() {
    setIsHolding(false);
    setTimeout(() => {
      didLongPressRef.current = false;
    }, 0);
  }

  function collapse() {
    setExpanded(false);
  }

  return (
    <Animated.View
      style={[styles.card, { height: animatedHeight }]}
      testID="weekly-volume-card"
    >
      {showExpandedContent ? (
        <View style={styles.transitionContent}>
          <Animated.View
            pointerEvents={expanded ? 'auto' : 'none'}
            style={styles.expandedContent}
          >
            <Animated.View style={[styles.expandedHeader, { opacity: expandedContentOpacity }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                delayLongPress={250}
                onLongPress={handleLongPress}
                onPress={handleExpandedHeaderPress}
                onPressOut={handlePressOut}
                onTouchEnd={handlePressOut}
                style={styles.expandedHeaderCopy}
                testID="weekly-volume-expanded-header"
              >
                <View style={[styles.labelRow, styles.expandedLabelRow]}>
                  <View style={styles.titleAndHold}>
                    <WeeklyVolumeTitle expanded={expanded} />
                  </View>
                  <View style={styles.valueRow}>
                    <Text style={[styles.actual, { color: activeMetricColor }]}>
                      {formatMetricValue(collapsedValues.actual, activeMetric, units)}
                    </Text>
                    <Text style={styles.planned}>
                      / {formatMetricValue(collapsedValues.planned, activeMetric, units)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
            <Animated.View
              style={[
                styles.animatedChart,
                {
                  opacity: chartOpacity,
                  transform: [{ translateY: chartTranslateY }],
                },
              ]}
            >
              <WeeklyVolumeBucketChart
                summary={summary}
                metric={activeMetric}
                units={units}
                selectedDayIndex={selectedDayIndex}
                onSelectDay={setSelectedDayIndex}
                onMetricHold={handleLongPress}
                onMetricRelease={handlePressOut}
                onScrubActiveChange={onScrubActiveChange}
              />
            </Animated.View>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[styles.collapsedOverlay, { opacity: collapsedContentOpacity }]}
          >
            <WeeklyVolumeCollapsedContent
              values={collapsedValues}
              metric={activeMetric}
              units={units}
              status={status}
              isHolding={false}
              activeColor={activeMetricColor}
              showTrack={false}
              showStatus={false}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.transitionTrack,
              {
                top: transitionTrackTop,
                left: transitionTrackLeft,
                height: transitionTrackHeight,
                opacity: transitionTrackOpacity,
              },
            ]}
            testID="weekly-volume-transition-track"
          >
            <Animated.View
              style={[
                styles.transitionTrackFill,
                {
                  width: `${transitionTrackProgress * 100}%` as DimensionValue,
                  opacity: transitionTrackFillOpacity,
                  backgroundColor: activeMetricColor,
                },
              ]}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[styles.movingStatusCopy, { top: statusTop }]}
            testID="weekly-volume-status-copy"
          >
            <View style={styles.statusCopyRow}>
              <Text style={styles.statusText}>{status}</Text>
              {isHolding ? (
                <Text style={styles.holdPill}>{metricLabel(activeMetric)} view</Text>
              ) : null}
            </View>
          </Animated.View>
        </View>
      ) : (
        <View style={styles.transitionContent}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            delayLongPress={250}
            onLongPress={handleLongPress}
            onPress={handleCollapsedPress}
            onPressOut={handlePressOut}
            onTouchEnd={handlePressOut}
            style={styles.collapsedPressable}
            testID="weekly-volume-collapsed"
          >
            <WeeklyVolumeCollapsedContent
              values={collapsedValues}
              metric={activeMetric}
              units={units}
              status={status}
              isHolding={isHolding}
              activeColor={activeMetricColor}
              chevronTestID="weekly-volume-chevron"
              showStatus={false}
            />
          </Pressable>
          <View
            pointerEvents="none"
            style={[styles.movingStatusCopy, { top: STATUS_COLLAPSED_TOP }]}
            testID="weekly-volume-status-copy"
          >
            <View style={styles.statusCopyRow}>
              <Text style={styles.statusText}>{status}</Text>
              {isHolding ? (
                <Text style={styles.holdPill}>{metricLabel(activeMetric)} view</Text>
              ) : null}
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

export function WeeklyLoadCard({ actualKm, plannedKm }: WeeklyLoadCardProps) {
  const summary: WeeklyVolumeSummary = {
    plannedDistanceKm: plannedKm,
    actualDistanceKm: actualKm,
    plannedSeconds: 0,
    actualSeconds: 0,
    days: Array.from({ length: 7 }, (_, dayIndex) => ({
      dayIndex,
      date: '',
      plannedDistanceKm: 0,
      actualDistanceKm: 0,
      plannedSeconds: 0,
      actualSeconds: 0,
      plannedType: 'REST',
      status: 'rest',
    })),
  };

  return <WeeklyVolumeCard summary={summary} />;
}

const styles = StyleSheet.create({
  card: {
    marginTop: 4,
    marginBottom: 16,
    backgroundColor: WEEKLY_VOLUME_SURFACE,
    borderColor: WEEKLY_VOLUME_BORDER,
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  collapsedPressable: {
    flex: 1,
  },
  transitionContent: {
    flex: 1,
    position: 'relative',
  },
  expandedContent: {
    flex: 1,
  },
  collapsedOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  expandedLabelRow: {
    marginBottom: 0,
  },
  titleAndHold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flexShrink: 1,
  },
  expandedHeader: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  expandedHeaderCopy: {
    flex: 1,
  },
  movingStatusCopy: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  statusCopyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  transitionTrack: {
    position: 'absolute',
    right: 0,
    backgroundColor: C.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  transitionTrackFill: {
    height: '100%',
    borderRadius: 999,
  },
  labelWithChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.muted,
    flexShrink: 0,
  },
  chevron: {
    width: 6,
    height: 6,
    borderRightWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: C.muted,
    transform: [{ rotate: '45deg' }],
    marginTop: -3,
  },
  chevronExpanded: {
    transform: [{ rotate: '225deg' }],
    marginTop: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    flexShrink: 1,
    minWidth: 0,
  },
  actual: {
    fontFamily: FONTS.monoBold,
    fontSize: 15,
    flexShrink: 1,
  },
  planned: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    color: C.muted,
    marginLeft: 2,
    flexShrink: 1,
  },
  track: {
    height: 5,
    backgroundColor: C.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  statusRow: {
    minHeight: 16,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
    color: C.ink2,
    flex: 1,
  },
  holdPill: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.clay,
    backgroundColor: C.clayBg,
    borderColor: `${C.clay}25`,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  animatedChart: {
    flex: 1,
  },
  chartWrap: {
    paddingTop: 0,
    marginLeft: -4,
    marginTop: 28,
    position: 'relative',
  },
  chartBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  yAxis: {
    width: 36,
    height: CHART_PLOT_HEIGHT,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  yAxisLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    lineHeight: 11,
    color: C.ink2,
  },
  plotArea: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    height: CHART_TOUCH_HEIGHT,
  },
  gridLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: CHART_PLOT_HEIGHT,
  },
  selectionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: CHART_PLOT_HEIGHT,
  },
  selectedGuide: {
    position: 'absolute',
    top: 2,
    bottom: 0,
    width: 1,
    backgroundColor: `${C.clay}35`,
  },
  gridLine: {
    position: 'absolute',
    right: 0,
    left: 0,
    height: 1,
    borderTopWidth: 1,
    borderTopColor: `${C.border}78`,
  },
  bucketRow: {
    height: CHART_TOUCH_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  lowerMetricHoldSurface: {
    position: 'absolute',
    top: CHART_PLOT_HEIGHT,
    right: -CARD_HORIZONTAL_PADDING,
    left: -CARD_HORIZONTAL_PADDING,
    height: CHART_TOUCH_HEIGHT - CHART_PLOT_HEIGHT,
  },
  bucketButton: {
    width: 28,
    alignItems: 'center',
  },
  bucketStack: {
    height: CHART_PLOT_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bucketShell: {
    width: 24,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bucketFill: {
    width: '100%',
    borderRadius: 7,
  },
  overrunBucket: {
    width: 24,
    borderRadius: 8,
    overflow: 'hidden',
  },
  plannedTargetTick: {
    position: 'absolute',
    left: 5,
    right: 5,
    height: PLANNED_TARGET_TICK_HEIGHT,
    borderRadius: 999,
    backgroundColor: WEEKLY_VOLUME_SURFACE,
  },
  restDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: C.border,
    marginBottom: 2,
  },
  dayLabel: {
    marginTop: 4,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
  },
  dayLabelSelected: {
    color: C.clay,
  },
  selectedTick: {
    marginTop: 4,
    width: 14,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  selectedTickActive: {
    backgroundColor: C.clay,
  },
  tooltipLayer: {
    position: 'absolute',
    top: 10,
    width: TOOLTIP_WIDTH,
  },
  tooltip: {
    width: TOOLTIP_WIDTH,
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: WEEKLY_VOLUME_SURFACE,
  },
  tooltipTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    color: C.ink,
    marginBottom: 2,
  },
  tooltipLine: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    lineHeight: 14,
    color: C.ink2,
  },
  tooltipOver: {
    marginTop: 1,
    fontFamily: FONTS.monoBold,
    fontSize: 9.5,
    color: C.clay,
  },
});
