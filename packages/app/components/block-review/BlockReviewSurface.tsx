import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import {
  addDaysIso,
  BLOCK_REVIEW_PHASE_ORDER,
  type BlockReviewModel,
  type BlockReviewTab,
  type BlockReviewWeekModel,
  type PhaseName,
} from '@steady/types';
import { C } from '../../constants/colours';
import { PHASE_COLOR } from '../../constants/phase-meta';
import { FONTS } from '../../constants/typography';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { triggerSelectionChangeHaptic } from '../../lib/haptics';
import { BlockWeekList } from '../block/BlockWeekList';

const TAB_ITEMS: { key: BlockReviewTab; label: string }[] = [
  { key: 'structure', label: 'Structure' },
  { key: 'weeks', label: 'Weeks' },
];

const CHART_HEIGHT = 150;
const CHART_WIDTH_FALLBACK = 300;
const CHART_Y_AXIS_WIDTH = 24;
const CHART_TOP = 22;
const CHART_BOTTOM = 122;
const CHART_LINE_WIDTH = 2.8;
const CHART_CURVE_SMOOTHING = 0.18;
const CHART_PHASE_MARKER_SIZE = 8;
const CHART_SELECTED_MARKER_SIZE = 12;
const CHART_X_AXIS_LABEL_WIDTH = 40;
const CHART_TOOLTIP_WIDTH = 132;
const CHART_CURRENT_GUIDE_POINT_GAP = 9;
const CHART_CURRENT_GUIDE_EDGE_INSET = 7;
const CHART_CURRENT_GUIDE_DOT_SIZE = 2;
const CHART_CURRENT_GUIDE_DOT_SPACING = 4;
const CHART_SCRUB_TOP = CHART_TOP - 16;
const CHART_SCRUB_BOTTOM = CHART_BOTTOM + 30;
const TAB_PRESS_EXPANSION = typeof document !== 'undefined'
  ? {}
  : {
      hitSlop: { top: 10, right: 10, bottom: 10, left: 10 },
      pressRetentionOffset: { top: 12, right: 12, bottom: 12, left: 12 },
    };
const ACTION_PRESS_EXPANSION = typeof document !== 'undefined'
  ? {}
  : {
      hitSlop: { top: 8, right: 8, bottom: 8, left: 8 },
      pressRetentionOffset: { top: 10, right: 10, bottom: 10, left: 10 },
    };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const COMPACT_PHASE_LABEL: Record<PhaseName, string> = {
  BASE: 'B',
  BUILD: 'BLD',
  RECOVERY: 'REC',
  PEAK: 'PK',
  TAPER: 'TP',
};

type FormatDistance = (km: number) => string;

export interface BlockReviewOverloadControl {
  progressionPct: number | null;
  progressionEveryWeeks?: number;
  isCustomising?: boolean;
  customPct?: string;
  customEveryWeeks?: string;
  customOptions?: number[];
  onSelectProgression: (pct: number, everyWeeks?: number) => void;
  onStartCustom?: () => void;
  onCustomPctChange?: (pct: string) => void;
  onCustomEveryWeeksChange?: (everyWeeks: string) => void;
  onChangeProgression?: () => void;
}

export interface BlockReviewSurfaceProps {
  model: BlockReviewModel;
  activeTab: BlockReviewTab;
  onTabChange: (tab: BlockReviewTab) => void;
  overload?: BlockReviewOverloadControl | null;
  expandedWeekIndex?: number | null;
  raceDate?: string;
  onScrubActiveChange?: (active: boolean) => void;
  onWeekPress?: (week: BlockReviewWeekModel) => void;
  onDayPress?: (week: BlockReviewWeekModel, dayIndex: number) => void;
  onMoveSession?: (
    week: BlockReviewWeekModel,
    fromDayIndex: number,
    toDayIndex: number,
  ) => void;
  onWeekDragActiveChange?: (active: boolean) => void;
  rescheduleResetKey?: number;
  onEditStructure?: () => void;
  formatDistance?: FormatDistance;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function defaultFormatDistance(km: number): string {
  return `${Math.round(km)}km`;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeWholeNumber(value: string, maxLength = 2): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function progressionPercent(value: string): number {
  return clampNumber(Number(value) || 7, 0, 30);
}

function progressionEveryWeeks(value: string): number {
  return clampNumber(Number(value) || 2, 1, 12);
}

function formatProgressionSummary(pct: number, everyWeeks: number): string {
  if (pct === 0) {
    return 'Flat plan.';
  }

  return everyWeeks === 1
    ? `+${pct}% progression every week.`
    : `+${pct}% progression every ${everyWeeks} weeks.`;
}

function phaseLabel(phase: PhaseName): string {
  return `${phase.slice(0, 1)}${phase.slice(1).toLowerCase()}`;
}

function phaseStripLabel(phase: PhaseName, weekCount: number, totalWeeks: number): string {
  const charsPerWeek = totalWeeks >= 20 ? 2.2 : totalWeeks >= 14 ? 3 : 4.5;
  const maxFullLabelChars = Math.max(1, Math.floor(weekCount * charsPerWeek));

  return phase.length > maxFullLabelChars ? COMPACT_PHASE_LABEL[phase] : phase;
}

interface ChartPoint {
  weekIndex: number;
  weekNumber: number;
  phase: PhaseName;
  km: number;
  x: number;
  y: number;
}

interface ChartTick {
  value: number;
  y: number;
}

interface ChartPhaseMarker {
  weekIndex: number;
  weekNumber: number;
  phase: PhaseName;
  x: number;
  y: number;
}

interface ChartGradientStop {
  key: string;
  offset: string;
  color: string;
}

interface ReviewVolumeChartModel {
  points: ChartPoint[];
  pathD: string;
  gradientStops: ChartGradientStop[];
  phaseMarkers: ChartPhaseMarker[];
  ticks: ChartTick[];
  axisMax: number;
}

function niceCeil(rawValue: number): number {
  const value = Math.max(rawValue, 1);
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const steps = [1, 1.5, 2, 3, 5, 10];
  const step = steps.find((candidate) => normalized <= candidate) ?? 10;

  return step * magnitude;
}

function axisTicks(axisMax: number): number[] {
  const step = niceCeil(axisMax / 3);
  const ticks: number[] = [];

  for (let tick = axisMax; tick > 0; tick -= step) {
    ticks.push(Math.max(0, tick));
  }

  return [...ticks, 0];
}

function formatSvgNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatAxisTickLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildContinuousPath(points: ChartPoint[]): string {
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    return `M ${formatSvgNumber(points[0].x)} ${formatSvgNumber(points[0].y)}`;
  }

  const commands = [`M ${formatSvgNumber(points[0].x)} ${formatSvgNumber(points[0].y)}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const point = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] ?? next;
    const control1 = {
      x: point.x + ((next.x - previous.x) * CHART_CURVE_SMOOTHING),
      y: point.y + ((next.y - previous.y) * CHART_CURVE_SMOOTHING),
    };
    const control2 = {
      x: next.x - ((afterNext.x - point.x) * CHART_CURVE_SMOOTHING),
      y: next.y - ((afterNext.y - point.y) * CHART_CURVE_SMOOTHING),
    };

    commands.push([
      'C',
      formatSvgNumber(control1.x),
      formatSvgNumber(control1.y),
      formatSvgNumber(control2.x),
      formatSvgNumber(control2.y),
      formatSvgNumber(next.x),
      formatSvgNumber(next.y),
    ].join(' '));
  }

  return commands.join(' ');
}

function gradientOffset(x: number, chartWidth: number): string {
  return `${(clampNumber(x / Math.max(chartWidth, 1), 0, 1) * 100).toFixed(2)}%`;
}

function buildGradientStops(
  model: BlockReviewModel,
  points: ChartPoint[],
  chartWidth: number,
): ChartGradientStop[] {
  if (points.length === 0) {
    return [];
  }

  return model.phaseSegments.flatMap((segment, index) => {
    const startPoint = points.find((point) => point.weekNumber === segment.startWeekNumber) ?? points[0];
    const nextSegment = model.phaseSegments[index + 1];
    const endPoint = nextSegment
      ? points.find((point) => point.weekNumber === nextSegment.startWeekNumber) ?? points[points.length - 1]
      : points[points.length - 1];
    const color = PHASE_COLOR[segment.phase];

    return [
      {
        key: `${segment.phase}-${segment.startWeekNumber}-start`,
        offset: gradientOffset(startPoint.x, chartWidth),
        color,
      },
      {
        key: `${segment.phase}-${segment.startWeekNumber}-end`,
        offset: gradientOffset(endPoint.x, chartWidth),
        color,
      },
    ];
  });
}

export function buildReviewVolumeChartModel(
  model: BlockReviewModel,
  chartWidth = CHART_WIDTH_FALLBACK,
): ReviewVolumeChartModel {
  const width = Math.max(chartWidth, 1);
  const weeks = model.weeks;

  if (weeks.length === 0) {
    return { points: [], pathD: '', gradientStops: [], phaseMarkers: [], ticks: [], axisMax: 1 };
  }

  const axisMax = niceCeil(model.volume.stats.maxKm * 1.12);
  const ySpan = CHART_BOTTOM - CHART_TOP;
  const denominator = Math.max(weeks.length - 1, 1);
  const points = weeks.map<ChartPoint>((week, weekIndex) => ({
    weekIndex,
    weekNumber: week.weekNumber,
    phase: week.phase,
    km: week.plannedKm,
    x: (width * weekIndex) / denominator,
    y: CHART_BOTTOM - (clampNumber(week.plannedKm / axisMax, 0, 1) * ySpan),
  }));

  const phaseMarkers = model.phaseSegments
    .map((segment) => points.find((point) => point.weekNumber === segment.startWeekNumber))
    .filter((point): point is ChartPoint => Boolean(point))
    .map((point) => ({
      weekIndex: point.weekIndex,
      weekNumber: point.weekNumber,
      phase: point.phase,
      x: point.x,
      y: point.y,
    }));

  return {
    points,
    pathD: buildContinuousPath(points),
    gradientStops: buildGradientStops(model, points, width),
    phaseMarkers,
    ticks: axisTicks(axisMax).map((value) => ({
      value,
      y: CHART_BOTTOM - (clampNumber(value / axisMax, 0, 1) * ySpan),
    })),
    axisMax,
  };
}

function eventLocation(event: GestureResponderEvent, axis: 'X' | 'Y'): number {
  const native = event.nativeEvent as GestureResponderEvent['nativeEvent'] & {
    clientX?: number;
    clientY?: number;
    offsetX?: number;
    offsetY?: number;
  };
  const location = axis === 'X' ? native.locationX : native.locationY;
  const offset = axis === 'X' ? native.offsetX : native.offsetY;
  const client = axis === 'X' ? native.clientX : native.clientY;

  return location ?? offset ?? client ?? 0;
}

function weekIndexFromX(x: number, chartWidth: number, totalWeeks: number): number {
  if (totalWeeks <= 1) {
    return 0;
  }

  const ratio = clampNumber(x, 0, chartWidth) / Math.max(chartWidth, 1);
  return clampNumber(Math.round(ratio * (totalWeeks - 1)), 0, totalWeeks - 1);
}

function currentGuideDotIndexes(height: number): number[] {
  if (height <= 0) {
    return [];
  }

  return Array.from(
    { length: Math.max(1, Math.floor(height / CHART_CURRENT_GUIDE_DOT_SPACING)) },
    (_, index) => index,
  );
}

function isoFromDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function weekStartFromRaceDate(raceDate: string | undefined, totalWeeks: number, weekIndex: number): string | null {
  if (!raceDate) {
    return null;
  }

  const race = new Date(`${raceDate}T00:00:00Z`);
  if (Number.isNaN(race.getTime())) {
    return null;
  }

  const raceDow = race.getUTCDay();
  const lastSunday = new Date(race);
  if (raceDow !== 0) {
    lastSunday.setUTCDate(race.getUTCDate() + (7 - raceDow));
  }

  const weekStart = new Date(lastSunday);
  weekStart.setUTCDate(lastSunday.getUTCDate() - 6 - ((totalWeeks - 1 - weekIndex) * 7));
  return isoFromDate(weekStart);
}

function inferReviewWeekStartDate(
  week: BlockReviewWeekModel,
  fallbackStart?: string | null,
): string | null {
  const datedSessionIndex = week.sessions.findIndex((session) => Boolean(session?.date));
  const datedSession = datedSessionIndex >= 0 ? week.sessions[datedSessionIndex] : null;

  if (datedSession?.date) {
    return addDaysIso(datedSession.date, -datedSessionIndex);
  }

  return fallbackStart ?? null;
}

export function formatReviewWeekDateRange(
  week: BlockReviewWeekModel,
  totalWeeks: number,
  raceDate?: string,
): string {
  const fallbackStart = weekStartFromRaceDate(raceDate, totalWeeks, week.weekIndex);
  const startIso = inferReviewWeekStartDate(week, fallbackStart);

  if (!startIso) {
    return `Week ${week.weekNumber}`;
  }

  const start = new Date(`${startIso}T00:00:00Z`);
  const endIso = addDaysIso(startIso, 7);
  const end = new Date(`${endIso}T00:00:00Z`);
  const startMonth = MONTHS[start.getUTCMonth()];
  const endMonth = MONTHS[end.getUTCMonth()];
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();

  return startMonth === endMonth
    ? `${startMonth} ${startDay} - ${endDay}`
    : `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

export function getBlockReviewTabMotionDuration(reducedMotion: boolean): number {
  return reducedMotion ? 0 : 220;
}

export function BlockReviewSurface({
  model,
  activeTab,
  onTabChange,
  overload,
  expandedWeekIndex,
  raceDate,
  onScrubActiveChange,
  onWeekPress,
  onDayPress,
  onMoveSession,
  onWeekDragActiveChange,
  rescheduleResetKey,
  onEditStructure,
  formatDistance = defaultFormatDistance,
  style,
  testID = 'block-review-surface',
}: BlockReviewSurfaceProps) {
  return (
    <View style={[styles.surface, style]} testID={testID}>
      <BlockReviewTabControl activeTab={activeTab} onTabChange={onTabChange} />

      {activeTab === 'structure' ? (
        <BlockReviewStructure
          model={model}
          formatDistance={formatDistance}
          raceDate={raceDate}
          onScrubActiveChange={onScrubActiveChange}
          overload={overload}
          onEditStructure={onEditStructure}
        />
      ) : null}
      {activeTab === 'weeks' ? (
        <BlockReviewWeeks
          model={model}
          raceDate={raceDate}
          formatDistance={formatDistance}
          expandedWeekIndex={expandedWeekIndex}
          onWeekPress={onWeekPress}
          onDayPress={onDayPress}
          onMoveSession={onMoveSession}
          onDragActiveChange={onWeekDragActiveChange}
          rescheduleResetKey={rescheduleResetKey}
        />
      ) : null}
    </View>
  );
}

interface BlockReviewTabControlProps {
  activeTab: BlockReviewTab;
  onTabChange: (tab: BlockReviewTab) => void;
}

export function BlockReviewTabControl({ activeTab, onTabChange }: BlockReviewTabControlProps) {
  const reducedMotion = useReducedMotion();
  const activeIndex = Math.max(0, TAB_ITEMS.findIndex((tab) => tab.key === activeTab));
  const animatedIndex = useRef(new Animated.Value(activeIndex)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    Animated.timing(animatedIndex, {
      toValue: activeIndex,
      duration: getBlockReviewTabMotionDuration(reducedMotion),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, animatedIndex, reducedMotion]);

  const tabWidth = trackWidth > 0 ? (trackWidth - 8) / TAB_ITEMS.length : 0;
  const translateX = useMemo(
    () => animatedIndex.interpolate({
      inputRange: TAB_ITEMS.map((_, index) => index),
      outputRange: TAB_ITEMS.map((_, index) => (tabWidth + 4) * index),
      extrapolate: 'clamp',
    }),
    [animatedIndex, tabWidth],
  );

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setTrackWidth(nextWidth);
    }
  }

  return (
    <View
      style={styles.tabs}
      onLayout={handleLayout}
      testID="block-review-tabs"
    >
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tabIndicator,
            {
              width: tabWidth,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}

      {TAB_ITEMS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            {...TAB_PRESS_EXPANSION}
            onPress={() => onTabChange(tab.key)}
            style={styles.tabButton}
            testID={`block-review-tab-${tab.key}`}
          >
            {!tabWidth && isActive ? <View pointerEvents="none" style={styles.tabFallbackIndicator} /> : null}
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface BlockVolumeChartProps {
  model: BlockReviewModel;
  formatDistance: FormatDistance;
  title?: string;
  raceDate?: string;
  onScrubActiveChange?: (active: boolean) => void;
  showPhaseStrip?: boolean;
}

export function BlockVolumeChart({
  model,
  formatDistance,
  title = 'Weekly volume',
  raceDate,
  onScrubActiveChange,
  showPhaseStrip = true,
}: BlockVolumeChartProps) {
  const [chartWidth, setChartWidth] = useState(CHART_WIDTH_FALLBACK);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  const [scrubX, setScrubX] = useState<number | null>(null);
  const selectedWeekIndexRef = useRef<number | null>(null);
  const scrubActiveRef = useRef(false);
  const plotWidth = Math.max(chartWidth - CHART_Y_AXIS_WIDTH, 1);
  const chartModel = useMemo(
    () => buildReviewVolumeChartModel(model, plotWidth),
    [model, plotWidth],
  );
  const selectedPoint = selectedWeekIndex == null ? null : chartModel.points[selectedWeekIndex] ?? null;
  const selectedWeek = selectedWeekIndex == null ? null : model.weeks[selectedWeekIndex] ?? null;
  const currentWeek = model.weeks.find((week) => week.isCurrentWeek) ?? null;
  const currentPoint = currentWeek ? chartModel.points[currentWeek.weekIndex] ?? null : null;
  const shouldShowCurrentGuide = Boolean(currentPoint && currentWeek && currentWeek.weekIndex > 0);
  const selectedX = scrubX ?? selectedPoint?.x ?? 0;
  const currentGuideInset = Math.min(CHART_CURRENT_GUIDE_EDGE_INSET, plotWidth / 2);
  const currentGuidePlotX = currentPoint
    ? clampNumber(
        currentPoint.x,
        currentGuideInset,
        Math.max(plotWidth - currentGuideInset, currentGuideInset),
      )
    : 0;
  const currentGuideLeft = currentPoint
    ? CHART_Y_AXIS_WIDTH + currentGuidePlotX - CHART_CURRENT_GUIDE_DOT_SIZE / 2
    : 0;
  const currentGuideTopHeight = currentPoint
    ? Math.max(currentPoint.y - CHART_CURRENT_GUIDE_POINT_GAP - CHART_TOP, 0)
    : 0;
  const currentGuideBottomTop = currentPoint
    ? currentPoint.y + CHART_CURRENT_GUIDE_POINT_GAP
    : 0;
  const currentGuideBottomHeight = currentPoint
    ? Math.max(CHART_BOTTOM - currentGuideBottomTop, 0)
    : 0;
  const currentGuideTopDots = currentGuideDotIndexes(currentGuideTopHeight);
  const currentGuideBottomDots = currentGuideDotIndexes(currentGuideBottomHeight);
  const tooltipLeft = clampNumber(
    CHART_Y_AXIS_WIDTH + selectedX - CHART_TOOLTIP_WIDTH / 2,
    0,
    Math.max(chartWidth - CHART_TOOLTIP_WIDTH, 0),
  );
  const tooltipTop = selectedPoint
    ? clampNumber(selectedPoint.y - 67, 0, CHART_BOTTOM - 58)
    : 0;
  useEffect(() => {
    return () => {
      onScrubActiveChange?.(false);
    };
  }, [onScrubActiveChange]);

  function handleChartLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setChartWidth(nextWidth);
    }
  }

  function selectWeekFromX(x: number) {
    const clampedX = clampNumber(x - CHART_Y_AXIS_WIDTH, 0, plotWidth);
    const nextWeekIndex = weekIndexFromX(clampedX, plotWidth, model.weeks.length);

    setScrubX(clampedX);
    if (selectedWeekIndexRef.current !== nextWeekIndex) {
      selectedWeekIndexRef.current = nextWeekIndex;
      setSelectedWeekIndex(nextWeekIndex);
      triggerSelectionChangeHaptic();
    }
  }

  function selectWeekFromEvent(event: GestureResponderEvent) {
    selectWeekFromX(eventLocation(event, 'X'));
  }

  function setScrubActive(active: boolean) {
    if (scrubActiveRef.current === active) {
      return;
    }

    scrubActiveRef.current = active;
    onScrubActiveChange?.(active);
  }

  function clearScrubSelection() {
    if (!scrubActiveRef.current) {
      return;
    }

    setScrubActive(false);
    selectedWeekIndexRef.current = null;
    setSelectedWeekIndex(null);
    setScrubX(null);
  }

  function shouldScrubFromEvent(event: GestureResponderEvent) {
    const y = eventLocation(event, 'Y');
    return y >= CHART_SCRUB_TOP && y <= CHART_SCRUB_BOTTOM;
  }

  return (
    <View style={[styles.card, styles.chartCard]} testID="block-review-volume-chart">
      <View style={styles.chartHead}>
        <View style={styles.chartTitleGroup}>
          <Text style={styles.chartTitle}>{title}</Text>
        </View>
      </View>

      <View
        style={[styles.chartFrame, styles.chartFrameCompact]}
        onLayout={handleChartLayout}
        onStartShouldSetResponder={shouldScrubFromEvent}
        onMoveShouldSetResponder={shouldScrubFromEvent}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          setScrubActive(true);
          selectWeekFromEvent(event);
        }}
        onResponderMove={selectWeekFromEvent}
        onResponderRelease={clearScrubSelection}
        onResponderTerminate={clearScrubSelection}
        testID="block-review-volume-scrub-surface"
      >
        <View pointerEvents="none" style={styles.chartYAxis} testID="block-review-volume-y-axis">
          <Text style={styles.chartAxisLabel}>km</Text>
          {chartModel.ticks.map((tick) => (
            <Text
              key={`tick-label-${tick.value}`}
              style={[
                styles.chartTickLabel,
                { top: clampNumber(tick.y - 7, CHART_TOP - 8, CHART_BOTTOM - 8) },
              ]}
              testID="block-review-volume-y-tick"
            >
              {formatAxisTickLabel(tick.value)}
            </Text>
          ))}
        </View>
        <View pointerEvents="none" style={styles.chartYAxisLine} />

        {chartModel.ticks.map((tick) => (
          <View
            key={`grid-${tick.value}`}
            pointerEvents="none"
            style={[
              styles.chartGridLine,
              { top: tick.y },
            ]}
            testID="block-review-volume-grid-line"
          />
        ))}

        {shouldShowCurrentGuide ? (
          <View
            pointerEvents="none"
            testID="block-review-volume-current-guide"
            style={[
              styles.chartCurrentWeekGuide,
              { left: currentGuideLeft },
            ]}
          >
            <View
              pointerEvents="none"
              testID="block-review-volume-current-guide-segment"
              style={[
                styles.chartCurrentWeekGuideSegment,
                {
                  top: CHART_TOP,
                  height: currentGuideTopHeight,
                },
              ]}
            >
              {currentGuideTopDots.map((dotIndex) => (
                <View
                  key={`top-${dotIndex}`}
                  testID="block-review-volume-current-guide-dot"
                  style={styles.chartCurrentWeekGuideDot}
                />
              ))}
            </View>
            <View
              pointerEvents="none"
              testID="block-review-volume-current-guide-segment"
              style={[
                styles.chartCurrentWeekGuideSegment,
                {
                  top: currentGuideBottomTop,
                  height: currentGuideBottomHeight,
                },
              ]}
            >
              {currentGuideBottomDots.map((dotIndex) => (
                <View
                  key={`bottom-${dotIndex}`}
                  testID="block-review-volume-current-guide-dot"
                  style={styles.chartCurrentWeekGuideDot}
                />
              ))}
            </View>
          </View>
        ) : null}

        {chartModel.pathD ? (
          <Svg
            pointerEvents="none"
            width={plotWidth}
            height={CHART_HEIGHT}
            viewBox={`0 0 ${plotWidth} ${CHART_HEIGHT}`}
            style={styles.chartSvgPlotLayer}
          >
            <Defs>
              <LinearGradient
                id="block-review-volume-gradient"
                x1="0"
                y1="0"
                x2={plotWidth}
                y2="0"
                gradientUnits="userSpaceOnUse"
              >
                {chartModel.gradientStops.map((stop) => (
                  <Stop key={stop.key} offset={stop.offset} stopColor={stop.color} />
                ))}
              </LinearGradient>
            </Defs>
            <Path
              d={chartModel.pathD}
              fill="none"
              stroke="url(#block-review-volume-gradient)"
              strokeWidth={CHART_LINE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              testID="block-review-volume-line"
            />
          </Svg>
        ) : null}

        {chartModel.phaseMarkers.map((marker) => (
          <View
            key={`${marker.phase}-${marker.weekNumber}`}
            pointerEvents="none"
            testID="block-review-volume-phase-marker"
            style={[
              styles.chartPhaseMarker,
              {
                left: CHART_Y_AXIS_WIDTH + marker.x - CHART_PHASE_MARKER_SIZE / 2,
                top: marker.y - CHART_PHASE_MARKER_SIZE / 2,
                backgroundColor: PHASE_COLOR[marker.phase],
              },
            ]}
          />
        ))}

        {selectedPoint ? (
          <View pointerEvents="none" style={styles.chartSelectionLayer}>
            <View style={[styles.chartSelectedGuide, { left: CHART_Y_AXIS_WIDTH + selectedPoint.x }]} />
            <View
              style={[
                styles.chartSelectedMarker,
                {
                  left: CHART_Y_AXIS_WIDTH + selectedPoint.x - CHART_SELECTED_MARKER_SIZE / 2,
                  top: selectedPoint.y - CHART_SELECTED_MARKER_SIZE / 2,
                  backgroundColor: PHASE_COLOR[selectedPoint.phase],
                },
              ]}
            />
          </View>
        ) : null}

        {chartModel.phaseMarkers.map((marker) => (
          <Text
            key={`label-${marker.phase}-${marker.weekNumber}`}
            style={[
              styles.chartMarker,
              {
                left: CHART_Y_AXIS_WIDTH
                  + clampNumber(
                    marker.x - CHART_X_AXIS_LABEL_WIDTH / 2,
                    -CHART_X_AXIS_LABEL_WIDTH / 2,
                    Math.max(plotWidth - CHART_X_AXIS_LABEL_WIDTH / 2, 0),
                  ),
              },
            ]}
          >
            W{marker.weekNumber}
          </Text>
        ))}
        {selectedWeek && selectedPoint ? (
          <View
            pointerEvents="none"
            style={[
              styles.chartTooltipLayer,
              {
                left: tooltipLeft,
                top: tooltipTop,
              },
            ]}
          >
            <View style={styles.chartTooltip} testID="block-review-volume-tooltip">
              <Text style={styles.chartTooltipTitle}>
                <Text>W{selectedWeek.weekNumber} </Text>
                <Text style={[styles.chartTooltipPhase, { color: PHASE_COLOR[selectedWeek.phase] }]}>
                  {phaseLabel(selectedWeek.phase)}
                </Text>
              </Text>
              <Text style={styles.chartTooltipLine}>
                {formatReviewWeekDateRange(selectedWeek, model.totalWeeks, raceDate)}
              </Text>
              <Text style={styles.chartTooltipValue}>{formatDistance(selectedWeek.plannedKm)} total</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.statsGrid}>
        <VolumeStat label="Start" value={formatDistance(model.volume.stats.startKm)} />
        <VolumeStat label="Peak" value={formatDistance(model.volume.stats.peakKm)} />
        <VolumeStat label="Race" value={formatDistance(model.volume.stats.raceKm)} />
      </View>

      {showPhaseStrip ? <BlockReviewPhaseStrip model={model} /> : null}
    </View>
  );
}

function VolumeStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function BlockReviewPhaseStrip({ model }: { model: BlockReviewModel }) {
  if (model.phaseSegments.length === 0) {
    return null;
  }

  return (
    <View style={styles.phaseStrip} testID="block-review-phase-strip">
      {model.phaseSegments.map((segment, index) => (
        <View
          key={`${segment.phase}-${segment.startWeekNumber}-${index}`}
          style={[
            styles.phaseStripSegment,
            index === 0 && styles.phaseStripFirst,
            index === model.phaseSegments.length - 1 && styles.phaseStripLast,
            {
              flex: segment.weekCount,
              backgroundColor: PHASE_COLOR[segment.phase],
              opacity: segment.isCurrent ? 1 : 0.92,
            },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.phaseStripLabel,
              phaseStripLabel(segment.phase, segment.weekCount, model.totalWeeks) !== segment.phase
                && styles.phaseStripLabelCompact,
            ]}
          >
            {phaseStripLabel(segment.phase, segment.weekCount, model.totalWeeks)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BlockReviewStructure({
  model,
  formatDistance,
  raceDate,
  onScrubActiveChange,
  overload,
  onEditStructure,
}: {
  model: BlockReviewModel;
  formatDistance: FormatDistance;
  raceDate?: string;
  onScrubActiveChange?: (active: boolean) => void;
  overload?: BlockReviewOverloadControl | null;
  onEditStructure?: () => void;
}) {
  return (
    <View style={styles.tabPanel} testID="block-review-structure">
      <BlockVolumeChart
        model={model}
        formatDistance={formatDistance}
        raceDate={raceDate}
        onScrubActiveChange={onScrubActiveChange}
      />
      {overload ? <BlockReviewOverloadCard control={overload} /> : null}
      <BlockReviewPhaseSummaryCard model={model} onEditStructure={onEditStructure} />
    </View>
  );
}

function BlockReviewPhaseSummaryCard({
  model,
  onEditStructure,
}: {
  model: BlockReviewModel;
  onEditStructure?: () => void;
}) {
  if (!model.structureLabel) {
    return null;
  }

  return (
    <View style={styles.structureCard} testID="block-review-phase-summary">
      <View style={styles.structureCopy}>
        <View style={styles.structureTitleRow}>
          <Text style={styles.structureTitle}>Phase structure</Text>
          {onEditStructure ? (
            <Pressable
              {...ACTION_PRESS_EXPANSION}
              onPress={onEditStructure}
              style={styles.structureEditButton}
              testID="block-review-edit-structure"
            >
              <Text style={styles.structureEdit}>Edit</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.structureValue}>{model.structureLabel}</Text>
      </View>
      <View style={styles.structureAction}>
        <BlockReviewMiniPhaseStrip model={model} />
      </View>
    </View>
  );
}

function BlockReviewMiniPhaseStrip({ model }: { model: BlockReviewModel }) {
  if (model.phaseSegments.length === 0) {
    return null;
  }

  return (
    <View style={styles.miniPhaseStrip} testID="block-review-mini-phase-strip">
      {model.phaseSegments.map((segment, index) => (
        <View
          key={`${segment.phase}-${segment.startWeekNumber}-${index}`}
          style={[
            styles.miniPhaseStripSegment,
            {
              flex: segment.weekCount,
              backgroundColor: PHASE_COLOR[segment.phase],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function BlockReviewOverloadCard({ control }: { control: BlockReviewOverloadControl }) {
  const customOptions = control.customOptions ?? [5, 7, 10, 12, 15];
  const customPct = control.customPct ?? '7';
  const customEveryWeeks = control.customEveryWeeks ?? '2';
  const selectedPct = progressionPercent(customPct);
  const selectedEveryWeeks = progressionEveryWeeks(customEveryWeeks);

  if (control.progressionPct !== null && !control.isCustomising) {
    return (
      <View style={[styles.card, styles.overloadConfirmed]} testID="block-review-overload-confirmed">
        <View style={styles.overloadConfirmedLeft}>
          <Text style={styles.overloadCheck}>✓</Text>
          <Text style={styles.overloadConfirmedText}>
            {formatProgressionSummary(control.progressionPct, control.progressionEveryWeeks ?? 2)}
          </Text>
        </View>
        {control.onChangeProgression ? (
          <Pressable
            {...ACTION_PRESS_EXPANSION}
            onPress={control.onChangeProgression}
            style={styles.overloadChangeButton}
            testID="block-review-overload-change"
          >
            <Text style={styles.overloadChange}>change</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.overloadCard]} testID="block-review-overload-card">
      <View>
        <Text style={styles.overloadTitle}>Progression</Text>
        <Text style={styles.overloadCopy}>Volume change applied before race-week taper.</Text>
      </View>

      {control.isCustomising ? (
        <View style={styles.customOverload}>
          <View style={styles.customPctRow}>
            {customOptions.map((option) => {
              const value = String(option);
              const isSelected = customPct === value;
              return (
                <Pressable
                  key={option}
                  onPress={() => control.onCustomPctChange?.(value)}
                  style={[
                    styles.pctChip,
                    isSelected && styles.pctChipSelected,
                  ]}
                  testID={`block-review-overload-${option}`}
                >
                  <Text style={[styles.pctChipText, isSelected && styles.pctChipTextSelected]}>
                    {option}%
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.customFields}>
            <View style={styles.customField}>
              <Text style={styles.customLabel}>Progression</Text>
              <View style={styles.customInputWrap}>
                <TextInput
                  testID="progression-pct-input"
                  value={customPct}
                  onChangeText={(value) => control.onCustomPctChange?.(sanitizeWholeNumber(value))}
                  keyboardType="number-pad"
                  style={styles.customInput}
                />
                <Text style={styles.customSuffix}>%</Text>
              </View>
            </View>
            <View style={styles.customField}>
              <Text style={styles.customLabel}>Every</Text>
              <View style={styles.customInputWrap}>
                <TextInput
                  testID="progression-every-weeks-input"
                  value={customEveryWeeks}
                  onChangeText={(value) => control.onCustomEveryWeeksChange?.(sanitizeWholeNumber(value))}
                  keyboardType="number-pad"
                  style={styles.customInput}
                />
                <Text style={styles.customSuffix}>weeks</Text>
              </View>
            </View>
          </View>
          <Pressable
            onPress={() => control.onSelectProgression(selectedPct, selectedEveryWeeks)}
            style={styles.overloadPrimary}
            testID="block-review-overload-apply-custom"
          >
            <Text style={styles.overloadPrimaryText}>Apply +{selectedPct}% / {selectedEveryWeeks}w</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.overloadButtons}>
          <Pressable
            onPress={() => control.onSelectProgression(7)}
            style={styles.overloadPrimary}
            testID="block-review-overload-accept"
          >
            <Text style={styles.overloadPrimaryText}>+7% / 2w</Text>
          </Pressable>
          <Pressable
            onPress={control.onStartCustom}
            style={styles.overloadSecondary}
            testID="block-review-overload-custom"
          >
            <Text style={styles.overloadSecondaryText}>Custom</Text>
          </Pressable>
          <Pressable
            onPress={() => control.onSelectProgression(0)}
            style={styles.overloadSecondary}
            testID="block-review-overload-flat"
          >
            <Text style={[styles.overloadSecondaryText, styles.overloadMutedText]}>Flat</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function BlockReviewWeeks({
  model,
  raceDate,
  formatDistance,
  expandedWeekIndex,
  onWeekPress,
  onDayPress,
  onMoveSession,
  onDragActiveChange,
  rescheduleResetKey,
}: {
  model: BlockReviewModel;
  raceDate?: string;
  formatDistance: FormatDistance;
  expandedWeekIndex?: number | null;
  onWeekPress?: (week: BlockReviewWeekModel) => void;
  onDayPress?: (week: BlockReviewWeekModel, dayIndex: number) => void;
  onMoveSession?: (
    week: BlockReviewWeekModel,
    fromDayIndex: number,
    toDayIndex: number,
  ) => void;
  onDragActiveChange?: (active: boolean) => void;
  rescheduleResetKey?: number;
}) {
  return (
    <BlockWeekList
      testID="block-review-weeks"
      weeks={model.weeks.map((week) => ({
        id: week.id,
        weekIndex: week.weekIndex,
        weekNumber: week.weekNumber,
        phase: week.phase,
        weekStartDate: weekStartFromRaceDate(raceDate, model.totalWeeks, week.weekIndex),
        plannedKm: week.plannedKm,
        volumeRatio: week.volumeRatio,
        sessions: week.sessions,
        isCurrent: week.isCurrentWeek,
        isExpanded: expandedWeekIndex === week.weekIndex,
      }))}
      expandedWeekIndex={expandedWeekIndex}
      formatVolume={(km) => formatDistance(km)}
      onToggleWeek={(weekIndex) => {
        const week = model.weeks[weekIndex];
        if (week) {
          onWeekPress?.(week);
        }
      }}
      onDayPress={(weekIndex, dayIndex) => {
        const week = model.weeks[weekIndex];
        if (week) {
          onDayPress?.(week, dayIndex);
        }
      }}
      onMoveSession={(weekIndex, fromDayIndex, toDayIndex) => {
        const week = model.weeks[weekIndex];
        if (week) {
          onMoveSession?.(week, fromDayIndex, toDayIndex);
        }
      }}
      onDragActiveChange={onDragActiveChange}
      rescheduleResetKey={rescheduleResetKey}
      style={styles.weekList}
    />
  );
}

export function BlockReviewPhaseOrderLegend() {
  return (
    <View style={styles.phaseLegend}>
      {BLOCK_REVIEW_PHASE_ORDER.map((phase) => (
        <View key={phase} style={styles.phaseLegendItem}>
          <View style={[styles.phaseLegendDot, { backgroundColor: PHASE_COLOR[phase] }]} />
          <Text style={styles.phaseLegendText}>{phaseLabel(phase)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {},
  tabPanel: {
    gap: 10,
    marginTop: 10,
  },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
  },
  chartCard: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 13,
  },
  chartHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  chartTitleGroup: {
    flex: 1,
  },
  chartTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 18,
    color: C.ink,
  },
  chartFrame: {
    height: CHART_HEIGHT,
    marginTop: 10,
    marginBottom: 2,
    position: 'relative',
  },
  chartFrameCompact: {
    marginTop: 6,
  },
  chartGridLine: {
    position: 'absolute',
    left: CHART_Y_AXIS_WIDTH,
    right: 0,
    height: 1,
    borderTopWidth: 1,
    borderTopColor: `${C.border}D8`,
  },
  chartYAxis: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: CHART_Y_AXIS_WIDTH - 2,
  },
  chartAxisLabel: {
    position: 'absolute',
    top: 0,
    right: 4,
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: C.muted,
  },
  chartTickLabel: {
    position: 'absolute',
    right: 4,
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    lineHeight: 12,
    color: C.muted,
    textAlign: 'right',
  },
  chartYAxisLine: {
    position: 'absolute',
    top: CHART_TOP,
    bottom: CHART_HEIGHT - CHART_BOTTOM,
    left: CHART_Y_AXIS_WIDTH,
    width: 1,
    backgroundColor: `${C.border}D8`,
  },
  chartSvgLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  chartSvgPlotLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: CHART_Y_AXIS_WIDTH,
  },
  chartPhaseMarker: {
    position: 'absolute',
    width: CHART_PHASE_MARKER_SIZE,
    height: CHART_PHASE_MARKER_SIZE,
    borderRadius: CHART_PHASE_MARKER_SIZE / 2,
    borderWidth: 1.5,
    borderColor: C.surface,
  },
  chartMarker: {
    position: 'absolute',
    top: CHART_BOTTOM + 8,
    width: CHART_X_AXIS_LABEL_WIDTH,
    fontFamily: FONTS.mono,
    fontSize: 9,
    lineHeight: 12,
    color: C.muted,
    textAlign: 'center',
  },
  chartSelectionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  chartSelectedGuide: {
    position: 'absolute',
    top: CHART_TOP,
    bottom: CHART_HEIGHT - CHART_BOTTOM,
    width: 1,
    backgroundColor: `${C.ink2}24`,
  },
  chartSelectedMarker: {
    position: 'absolute',
    width: CHART_SELECTED_MARKER_SIZE,
    height: CHART_SELECTED_MARKER_SIZE,
    borderRadius: CHART_SELECTED_MARKER_SIZE / 2,
    borderWidth: 2,
    borderColor: C.surface,
  },
  chartCurrentWeekGuide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: CHART_CURRENT_GUIDE_DOT_SIZE,
  },
  chartCurrentWeekGuideSegment: {
    position: 'absolute',
    left: 0,
    width: CHART_CURRENT_GUIDE_DOT_SIZE,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartCurrentWeekGuideDot: {
    width: CHART_CURRENT_GUIDE_DOT_SIZE,
    height: CHART_CURRENT_GUIDE_DOT_SIZE,
    borderRadius: CHART_CURRENT_GUIDE_DOT_SIZE / 2,
    backgroundColor: `${C.forest}78`,
  },
  chartTooltipLayer: {
    position: 'absolute',
    width: CHART_TOOLTIP_WIDTH,
  },
  chartTooltip: {
    width: CHART_TOOLTIP_WIDTH,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chartTooltipTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.ink,
    marginBottom: 2,
  },
  chartTooltipPhase: {
    fontFamily: FONTS.sansSemiBold,
  },
  chartTooltipLine: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    lineHeight: 14,
    color: C.muted,
  },
  chartTooltipValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    lineHeight: 15,
    color: C.ink2,
    marginTop: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 9,
  },
  statBox: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  statLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    color: C.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 14,
    color: C.ink,
    marginTop: 5,
  },
  phaseStrip: {
    flexDirection: 'row',
    gap: 2,
    height: 24,
    marginTop: 12,
    borderRadius: 7,
    overflow: 'hidden',
  },
  phaseStripSegment: {
    height: '100%',
    minWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  phaseStripFirst: {
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
  },
  phaseStripLast: {
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
  },
  phaseStripLabel: {
    maxWidth: '100%',
    fontFamily: FONTS.sansSemiBold,
    fontSize: 8.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: `${C.cream}D6`,
    includeFontPadding: false,
  },
  phaseStripLabelCompact: {
    fontSize: 8,
    letterSpacing: 0.6,
  },
  overloadCard: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: C.amberBg,
    borderColor: `${C.amber}57`,
  },
  overloadTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: C.ink,
  },
  overloadCopy: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 14,
    color: C.muted,
    marginTop: 2,
  },
  overloadButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 11,
  },
  overloadPrimary: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.amber,
    backgroundColor: C.amber,
  },
  overloadPrimaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.surface,
  },
  overloadSecondary: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  overloadSecondaryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.ink2,
  },
  overloadMutedText: {
    color: C.muted,
  },
  overloadConfirmed: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderColor: `${C.forest}25`,
    backgroundColor: C.forestBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  overloadConfirmedLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overloadCheck: {
    color: C.forest,
    fontSize: 14,
  },
  overloadConfirmedText: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 12.5,
    color: C.forest,
  },
  overloadChange: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: C.muted,
  },
  overloadChangeButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  customOverload: {
    marginTop: 12,
    gap: 10,
  },
  customPctRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  customFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 8,
  },
  customField: {
    minWidth: 96,
  },
  customLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 5,
  },
  customInputWrap: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customInput: {
    minWidth: 24,
    paddingVertical: 0,
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.ink,
  },
  customSuffix: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11.5,
    color: C.muted,
  },
  pctChip: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  pctChipSelected: {
    borderColor: C.amber,
    backgroundColor: `${C.amber}18`,
  },
  pctChipText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: C.muted,
  },
  pctChipTextSelected: {
    fontFamily: FONTS.monoBold,
    color: C.amber,
  },
  tabs: {
    position: 'relative',
    height: 44,
    padding: 4,
    flexDirection: 'row',
    gap: 4,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 24,
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 20,
    backgroundColor: C.surface,
  },
  tabButton: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    overflow: 'hidden',
  },
  tabFallbackIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: C.surface,
    borderRadius: 20,
  },
  tabText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.muted,
  },
  tabTextActive: {
    color: C.ink,
  },
  structureCard: {
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
  },
  structureCopy: {
    flex: 1,
    minWidth: 0,
  },
  structureTitleRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  structureTitle: {
    flexShrink: 1,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: C.ink,
  },
  structureValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    lineHeight: 16,
    color: C.muted,
    marginTop: 6,
  },
  structureAction: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  structureEditButton: {
    minHeight: 32,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  structureEdit: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: C.clay,
  },
  miniPhaseStrip: {
    width: 78,
    height: 11,
    flexDirection: 'row',
    gap: 2,
    borderRadius: 7,
    overflow: 'hidden',
  },
  miniPhaseStripSegment: {
    height: '100%',
  },
  weekList: {
    gap: 8,
    marginTop: 10,
  },
  weekRow: {
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 16,
  },
  weekRowCurrent: {
    borderColor: `${C.clay}45`,
    backgroundColor: C.clayBg,
  },
  weekRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weekNumber: {
    width: 32,
    fontFamily: FONTS.monoBold,
    fontSize: 13,
    color: C.muted,
  },
  weekNumberCurrent: {
    color: C.clay,
  },
  runDots: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  runDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  weekRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekKm: {
    fontFamily: FONTS.monoBold,
    fontSize: 14,
    color: C.ink,
  },
  phaseTag: {
    minHeight: 25,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseTagText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  weekBar: {
    height: 3,
    marginTop: 10,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: C.border,
  },
  weekBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  phaseLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  phaseLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  phaseLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseLegendText: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: C.muted,
  },
  pressed: {
    opacity: 0.78,
  },
});
