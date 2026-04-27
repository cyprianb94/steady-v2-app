import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
  formatDurationCompact,
} from '../../lib/units';
import { usePreferences } from '../../providers/preferences-context';
import { AnimatedProgressFill } from '../ui/AnimatedProgressFill';

const WEEKLY_VOLUME_ACCENT = C.forest;
const WEEKLY_VOLUME_BORDER = C.border;
const WEEKLY_VOLUME_SURFACE = C.surface;
const COLLAPSED_HEIGHT = 84;
const EXPANDED_HEIGHT = 248;
const EXPANDED_WITH_TOOLTIP_HEIGHT = 272;
const BUCKET_MAX_HEIGHT = 104;
const BUCKET_MIN_HEIGHT = 14;
const OVERFLOW_CAP_MAX_HEIGHT = 18;
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
}

interface WeeklyLoadCardProps {
  actualKm: number;
  plannedKm: number;
}

function oppositeMetric(metric: WeeklyVolumeMetric): WeeklyVolumeMetric {
  return metric === 'distance' ? 'time' : 'distance';
}

function metricLabel(metric: WeeklyVolumeMetric): string {
  return metric === 'distance' ? 'km' : 'time';
}

function metricAccessibleLabel(metric: WeeklyVolumeMetric): string {
  return metric === 'distance' ? 'distance' : 'time';
}

function summaryMetricValues(summary: WeeklyVolumeSummary, metric: WeeklyVolumeMetric) {
  return metric === 'distance'
    ? { actual: summary.actualDistanceKm, planned: summary.plannedDistanceKm }
    : { actual: summary.actualSeconds, planned: summary.plannedSeconds };
}

function formatMetricValue(value: number, metric: WeeklyVolumeMetric, units: 'metric' | 'imperial'): string {
  return metric === 'distance'
    ? formatDistance(value, units)
    : formatDurationCompact(value);
}

function formatMetricAccessible(value: number, metric: WeeklyVolumeMetric, units: 'metric' | 'imperial'): string {
  return metric === 'distance'
    ? formatDistance(value, units, { spaced: true })
    : formatDurationAccessible(value);
}

function hasDisplayableOverrun(value: number, metric: WeeklyVolumeMetric): boolean {
  return metric === 'distance' ? value > 0 : Math.round(value / 60) > 0;
}

function weeklyStatus(summary: WeeklyVolumeSummary): string {
  const missedRun = summary.days.find((day) => day.status === 'missed' && day.plannedType !== 'REST');
  if (missedRun?.plannedType === 'EASY') {
    return 'Easy volume short so far';
  }
  if (missedRun) {
    return `${DAY_NAMES[missedRun.dayIndex]} not logged yet`;
  }

  const hasLongRunAhead = summary.days.some((day) => day.status === 'upcoming' && day.plannedType === 'LONG');
  if (summary.actualDistanceKm === 0 && hasLongRunAhead) {
    return 'Long run still ahead';
  }

  if (
    (summary.plannedDistanceKm > 0 && summary.actualDistanceKm > summary.plannedDistanceKm)
    || (summary.plannedSeconds > 0 && summary.actualSeconds > summary.plannedSeconds)
  ) {
    return 'Slightly over planned so far';
  }

  return 'On track so far';
}

function tooltipAlignment(dayIndex: number) {
  if (dayIndex <= 1) return styles.tooltipStart;
  if (dayIndex >= 5) return styles.tooltipEnd;
  return styles.tooltipCenter;
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
      style={[styles.tooltip, tooltipAlignment(day.dayIndex)]}
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
  maxPlanned,
  selected,
  onPress,
}: {
  day: WeeklyVolumeDay;
  metric: WeeklyVolumeMetric;
  units: 'metric' | 'imperial';
  maxPlanned: number;
  selected: boolean;
  onPress: () => void;
}) {
  const values = getWeeklyVolumeDayMetric(day, metric);
  const plannedColour = TYPE_COLOURS[day.plannedType];
  const actualColour = TYPE_COLOURS[day.actualType ?? day.plannedType];
  const plannedHeight = values.planned > 0
    ? Math.max(BUCKET_MIN_HEIGHT, (values.planned / maxPlanned) * BUCKET_MAX_HEIGHT)
    : 0;
  const fillHeight = values.planned > 0
    ? Math.min(plannedHeight, (values.actual / values.planned) * plannedHeight)
    : 0;
  const overCapHeight = values.over > 0
    ? Math.min(OVERFLOW_CAP_MAX_HEIGHT, (values.over / maxPlanned) * BUCKET_MAX_HEIGHT)
    : 0;
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
            {overCapHeight > 0 ? (
              <View
                style={[
                  styles.overCap,
                  {
                    height: overCapHeight,
                    backgroundColor: actualColour.solid,
                  },
                ]}
                testID={`weekly-volume-overrun-${day.dayIndex}`}
              />
            ) : null}
            <View
              style={[
                styles.bucketShell,
                {
                  height: plannedHeight,
                  backgroundColor: plannedColour.pale,
                  borderColor: `${plannedColour.solid}35`,
                },
              ]}
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
}: {
  summary: WeeklyVolumeSummary;
  metric: WeeklyVolumeMetric;
  units: 'metric' | 'imperial';
  selectedDayIndex: number | null;
  onSelectDay: (dayIndex: number) => void;
}) {
  const maxPlanned = Math.max(
    1,
    ...summary.days.map((day) => getWeeklyVolumeDayMetric(day, metric).planned),
  );
  const selectedDay = selectedDayIndex == null ? null : summary.days[selectedDayIndex] ?? null;

  return (
    <View style={styles.chartWrap} testID="weekly-volume-chart">
      <View style={styles.bucketRow}>
        {summary.days.map((day) => (
          <WeeklyVolumeBucket
            key={day.dayIndex}
            day={day}
            metric={metric}
            units={units}
            maxPlanned={maxPlanned}
            selected={selectedDayIndex === day.dayIndex}
            onPress={() => onSelectDay(day.dayIndex)}
          />
        ))}
      </View>
      {selectedDay ? (
        <WeeklyVolumeTooltip day={selectedDay} metric={metric} units={units} />
      ) : null}
    </View>
  );
}

export function WeeklyVolumeCard({ summary }: WeeklyVolumeCardProps) {
  const { units, weeklyVolumeMetric } = usePreferences();
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [chartMetric, setChartMetric] = useState<WeeklyVolumeMetric>(weeklyVolumeMetric);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const didLongPressRef = useRef(false);
  const expansion = useRef(new Animated.Value(0)).current;
  const activeMetric = isHolding ? oppositeMetric(weeklyVolumeMetric) : weeklyVolumeMetric;
  const collapsedValues = summaryMetricValues(summary, activeMetric);
  const collapsedProgress = collapsedValues.planned > 0
    ? Math.max(0, Math.min(1, collapsedValues.actual / collapsedValues.planned))
    : 0;
  const status = weeklyStatus(summary);
  const targetHeight = expanded
    ? selectedDayIndex == null
      ? EXPANDED_HEIGHT
      : EXPANDED_WITH_TOOLTIP_HEIGHT
    : COLLAPSED_HEIGHT;
  const animatedHeight = useMemo(
    () => expansion.interpolate({
      inputRange: [0, 1],
      outputRange: [COLLAPSED_HEIGHT, targetHeight],
      extrapolate: 'clamp',
    }),
    [expansion, targetHeight],
  );
  const chartOpacity = useMemo(
    () => expansion.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: [0, 0, 1],
      extrapolate: 'clamp',
    }),
    [expansion],
  );
  const accessibilityLabel = `Weekly volume, ${formatMetricAccessible(
    collapsedValues.actual,
    activeMetric,
    units,
  )} of ${formatMetricAccessible(collapsedValues.planned, activeMetric, units)}, ${status}. ${
    expanded ? 'Expanded.' : `Double tap to inspect week shape. Hold to show ${metricAccessibleLabel(oppositeMetric(weeklyVolumeMetric))}.`
  }`;

  useEffect(() => {
    setChartMetric(weeklyVolumeMetric);
  }, [weeklyVolumeMetric]);

  useEffect(() => {
    const toValue = expanded ? 1 : 0;

    if (reducedMotion) {
      expansion.setValue(toValue);
      return;
    }

    Animated.timing(expansion, {
      toValue,
      duration: expanded ? 290 : 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [expanded, expansion, reducedMotion]);

  function handleCollapsedPress() {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }

    setChartMetric(weeklyVolumeMetric);
    setSelectedDayIndex(null);
    setExpanded(true);
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
    setSelectedDayIndex(null);
  }

  return (
    <Animated.View
      style={[styles.card, { minHeight: animatedHeight }]}
      testID="weekly-volume-card"
    >
      {expanded ? (
        <>
          <View style={styles.expandedHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              onPress={collapse}
              style={styles.expandedHeaderCopy}
              testID="weekly-volume-expanded-header"
            >
              <Text style={styles.label}>WEEKLY VOLUME</Text>
              <View style={styles.valueRow}>
                <Text style={styles.actual}>
                  {formatMetricValue(summaryMetricValues(summary, chartMetric).actual, chartMetric, units)}
                </Text>
                <Text style={styles.planned}>
                  / {formatMetricValue(summaryMetricValues(summary, chartMetric).planned, chartMetric, units)}
                </Text>
              </View>
            </Pressable>
            <View style={styles.metricToggle}>
              {(['time', 'distance'] as const).map((metric) => (
                <Pressable
                  key={metric}
                  accessibilityRole="button"
                  accessibilityState={{ selected: chartMetric === metric }}
                  accessibilityLabel={`${metricLabel(metric)} weekly volume view`}
                  onPress={() => setChartMetric(metric)}
                  style={[
                    styles.metricToggleItem,
                    chartMetric === metric ? styles.metricToggleItemActive : null,
                  ]}
                  testID={`weekly-volume-metric-${metric}`}
                >
                  <Text
                    style={[
                      styles.metricToggleText,
                      chartMetric === metric ? styles.metricToggleTextActive : null,
                    ]}
                  >
                    {metricLabel(metric)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Animated.View style={[styles.animatedChart, { opacity: chartOpacity }]}>
            <WeeklyVolumeBucketChart
              summary={summary}
              metric={chartMetric}
              units={units}
              selectedDayIndex={selectedDayIndex}
              onSelectDay={setSelectedDayIndex}
            />
          </Animated.View>
        </>
      ) : (
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
          <View style={styles.labelRow}>
            <Text style={styles.label}>WEEKLY VOLUME</Text>
            <View style={styles.valueRow}>
              <Text style={styles.actual}>
                {formatMetricValue(collapsedValues.actual, activeMetric, units)}
              </Text>
              <Text style={styles.planned}>
                / {formatMetricValue(collapsedValues.planned, activeMetric, units)}
              </Text>
            </View>
          </View>
          <View style={styles.track}>
            <AnimatedProgressFill progress={collapsedProgress} fillStyle={styles.fill} />
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>{status}</Text>
            {isHolding ? (
              <Text style={styles.holdPill}>{metricLabel(activeMetric)} view</Text>
            ) : null}
          </View>
        </Pressable>
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  collapsedPressable: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
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
    gap: 6,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.muted,
    flexShrink: 0,
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
    color: WEEKLY_VOLUME_ACCENT,
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
    backgroundColor: WEEKLY_VOLUME_ACCENT,
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
  metricToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cream,
    padding: 2,
  },
  metricToggleItem: {
    minWidth: 36,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  metricToggleItemActive: {
    backgroundColor: C.surface,
    borderColor: `${C.clay}25`,
    borderWidth: 1,
  },
  metricToggleText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    color: C.muted,
  },
  metricToggleTextActive: {
    color: C.clay,
  },
  animatedChart: {
    flex: 1,
  },
  chartWrap: {
    paddingTop: 16,
  },
  bucketRow: {
    height: 140,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  bucketButton: {
    width: 28,
    alignItems: 'center',
  },
  bucketStack: {
    height: 126,
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
  overCap: {
    width: 24,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginBottom: 2,
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
  tooltip: {
    maxWidth: 148,
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  tooltipStart: {
    alignSelf: 'flex-start',
  },
  tooltipCenter: {
    alignSelf: 'center',
  },
  tooltipEnd: {
    alignSelf: 'flex-end',
  },
  tooltipTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: C.ink,
    marginBottom: 3,
  },
  tooltipLine: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    lineHeight: 15,
    color: C.ink2,
  },
  tooltipOver: {
    marginTop: 2,
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    color: C.clay,
  },
});
