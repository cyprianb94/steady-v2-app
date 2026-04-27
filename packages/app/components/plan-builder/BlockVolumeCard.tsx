import React, { useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import { addDaysIso, inferWeekStartDate, type PhaseName, type PlanWeek } from '@steady/types';
import { C } from '../../constants/colours';
import { PHASE_COLOR } from '../../constants/phase-meta';
import { FONTS } from '../../constants/typography';
import { triggerSelectionChangeHaptic } from '../../lib/haptics';
import { formatDistance, type DistanceUnits } from '../../lib/units';

const CHART_WIDTH = 312;
const CHART_HEIGHT = 158;
const PLOT_LEFT = 42;
const PLOT_RIGHT = 302;
const PLOT_TOP = 26;
const PLOT_BOTTOM = 112;
const LINE_WIDTH = 2.2;
const LINE_OVERLAP = 1.5;
const MARKER_SIZE = 8;
const SELECTED_MARKER_SIZE = 11;
const TOOLTIP_WIDTH = 138;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const PHASE_LABEL: Record<PhaseName, string> = {
  BASE: 'Base',
  BUILD: 'Build',
  RECOVERY: 'Recovery',
  PEAK: 'Peak',
  TAPER: 'Taper',
};

interface ChartPoint {
  index: number;
  phase: PhaseName;
  km: number;
  x: number;
  y: number;
}

export interface VolumeCurveSegment {
  key: string;
  phase: PhaseName;
  color: string;
  x: number;
  y: number;
  width: number;
  angle: number;
}

export interface VolumeCurveMarker {
  index: number;
  phase: PhaseName;
  label: string;
  x: number;
  y: number;
}

interface VolumeCurveModel {
  points: ChartPoint[];
  segments: VolumeCurveSegment[];
  markers: VolumeCurveMarker[];
  phaseRuns: Array<{ phase: PhaseName; start: number; end: number; count: number }>;
  axisMax: number;
  ticks: number[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function weekIndexFromX(x: number, totalWeeks: number) {
  if (totalWeeks <= 1) {
    return 0;
  }

  const ratio = (clamp(x, PLOT_LEFT, PLOT_RIGHT) - PLOT_LEFT) / (PLOT_RIGHT - PLOT_LEFT);
  return clamp(Math.round(ratio * (totalWeeks - 1)), 0, totalWeeks - 1);
}

function getPhaseRuns(plan: PlanWeek[]): VolumeCurveModel['phaseRuns'] {
  return plan.reduce<VolumeCurveModel['phaseRuns']>((runs, week, index) => {
    const previous = runs[runs.length - 1];
    if (previous && previous.phase === week.phase) {
      previous.end = index;
      previous.count += 1;
      return runs;
    }

    runs.push({ phase: week.phase, start: index, end: index, count: 1 });
    return runs;
  }, []);
}

export function buildVolumeCurveModel(plan: PlanWeek[]): VolumeCurveModel {
  if (plan.length === 0) {
    return { points: [], segments: [], markers: [], phaseRuns: [], axisMax: 1, ticks: [1, 0] };
  }

  const maxKm = Math.max(...plan.map((week) => week.plannedKm), 1);
  const axisMax = niceCeil(maxKm * 1.12);
  const ticks = axisTicks(axisMax);
  const xSpan = PLOT_RIGHT - PLOT_LEFT;
  const ySpan = PLOT_BOTTOM - PLOT_TOP;
  const denominator = Math.max(plan.length - 1, 1);

  const points = plan.map<ChartPoint>((week, index) => ({
    index,
    phase: week.phase,
    km: week.plannedKm,
    x: PLOT_LEFT + (xSpan * index) / denominator,
    y: PLOT_BOTTOM - (clamp(week.plannedKm / axisMax, 0, 1) * ySpan),
  }));

  const markers = points
    .filter((point, index) => index === 0 || point.phase !== points[index - 1]?.phase)
    .map((point) => ({
      index: point.index,
      phase: point.phase,
      label: `W${point.index + 1}`,
      x: point.x,
      y: point.y,
    }));

  const segments: VolumeCurveSegment[] = [];
  if (points.length > 1) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const width = Math.hypot(dx, dy);

      if (width < 0.5) {
        continue;
      }

      segments.push({
        key: `${i}`,
        phase: p1.phase,
        color: PHASE_COLOR[p1.phase],
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
        width,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      });
    }
  }

  return {
    points,
    segments,
    markers,
    phaseRuns: getPhaseRuns(plan),
    axisMax,
    ticks,
  };
}

function getPeakWeekIndex(plan: PlanWeek[]) {
  return plan.reduce((peakIndex, week, index) => {
    return week.plannedKm > plan[peakIndex].plannedKm ? index : peakIndex;
  }, 0);
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

function formatDateRange(startIso: string): string {
  const start = new Date(`${startIso}T00:00:00Z`);
  const endIso = addDaysIso(startIso, 6);
  const end = new Date(`${endIso}T00:00:00Z`);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = MONTHS[start.getUTCMonth()];
  const endMonth = MONTHS[end.getUTCMonth()];

  return startMonth === endMonth
    ? `${startDay} - ${endDay} ${startMonth}`
    : `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}

function weekDateLabel(week: PlanWeek, weekIndex: number, totalWeeks: number, raceDate?: string): string {
  const fallbackStart = weekStartFromRaceDate(raceDate, totalWeeks, weekIndex);
  const hasDatedSession = week.sessions.some((session) => Boolean(session?.date));
  const startIso = hasDatedSession
    ? inferWeekStartDate(week, fallbackStart ?? raceDate)
    : fallbackStart;

  return startIso ? formatDateRange(startIso) : `Week ${weekIndex + 1}`;
}

function VolumeTooltip({
  week,
  weekIndex,
  totalWeeks,
  raceDate,
  units,
}: {
  week: PlanWeek;
  weekIndex: number;
  totalWeeks: number;
  raceDate?: string;
  units: DistanceUnits;
}) {
  return (
    <View style={styles.tooltip} testID="block-volume-tooltip">
      <Text style={styles.tooltipTitle}>W{weekIndex + 1} · {PHASE_LABEL[week.phase]}</Text>
      <Text style={styles.tooltipLine}>{weekDateLabel(week, weekIndex, totalWeeks, raceDate)}</Text>
      <Text style={styles.tooltipValue}>
        {formatDistance(week.plannedKm, units, { decimals: 0 })} total
      </Text>
    </View>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function BlockVolumeCard({
  plan,
  units,
  raceDate,
}: {
  plan: PlanWeek[];
  units: DistanceUnits;
  raceDate?: string;
}) {
  const model = useMemo(() => buildVolumeCurveModel(plan), [plan]);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  const [scrubX, setScrubX] = useState<number | null>(null);
  const selectedWeekIndexRef = useRef<number | null>(null);
  const scrubActiveRef = useRef(false);

  if (plan.length === 0) {
    return null;
  }

  const peakIndex = getPeakWeekIndex(plan);
  const startWeek = plan[0];
  const peakWeek = plan[peakIndex];
  const raceWeek = plan[plan.length - 1];
  const peakLabel = formatDistance(peakWeek.plannedKm, units, { decimals: 0 });
  const unitLabel = units === 'imperial' ? 'mi' : 'km';
  const selectedPoint = selectedWeekIndex == null ? null : model.points[selectedWeekIndex] ?? null;
  const selectedWeek = selectedWeekIndex == null ? null : plan[selectedWeekIndex] ?? null;
  const selectedX = scrubX ?? selectedPoint?.x ?? PLOT_LEFT;
  const tooltipLeft = clamp(selectedX - TOOLTIP_WIDTH / 2, PLOT_LEFT, PLOT_RIGHT - TOOLTIP_WIDTH);
  const tooltipTop = selectedPoint ? clamp(selectedPoint.y - 60, 0, PLOT_BOTTOM - 56) : 0;
  const finalMarker = model.markers[model.markers.length - 1];
  const shouldStackFinalPhaseLabel = Boolean(finalMarker && PLOT_RIGHT - finalMarker.x < 44);

  function selectWeekFromX(x: number) {
    const clampedX = clamp(x, PLOT_LEFT, PLOT_RIGHT);
    const nextWeekIndex = weekIndexFromX(clampedX, plan.length);

    setScrubX(clampedX);
    if (selectedWeekIndexRef.current !== nextWeekIndex) {
      selectedWeekIndexRef.current = nextWeekIndex;
      setSelectedWeekIndex(nextWeekIndex);
      triggerSelectionChangeHaptic();
    }
  }

  function selectWeekFromEvent(event: GestureResponderEvent) {
    selectWeekFromX(event.nativeEvent.locationX);
  }

  function clearScrubSelection() {
    if (!scrubActiveRef.current) {
      return;
    }

    scrubActiveRef.current = false;
    selectedWeekIndexRef.current = null;
    setSelectedWeekIndex(null);
    setScrubX(null);
  }

  function shouldScrubFromEvent(event: GestureResponderEvent) {
    return event.nativeEvent.locationY >= PLOT_TOP - 12 && event.nativeEvent.locationY <= PLOT_BOTTOM + 28;
  }

  return (
    <View style={styles.card} testID="block-volume-card">
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Weekly volume</Text>
          <Text style={styles.subtitle}>Builds through the middle, then tapers.</Text>
        </View>
        <View style={styles.peakPill}>
          <Text style={styles.peakPillText}>{peakLabel} peak</Text>
        </View>
      </View>

      <View
        style={styles.chart}
        onStartShouldSetResponder={shouldScrubFromEvent}
        onMoveShouldSetResponder={shouldScrubFromEvent}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          scrubActiveRef.current = true;
          selectWeekFromEvent(event);
        }}
        onResponderMove={selectWeekFromEvent}
        onResponderRelease={clearScrubSelection}
        onResponderTerminate={clearScrubSelection}
        testID="block-volume-plot-scrub-surface"
      >
        <View pointerEvents="none" style={styles.yAxis}>
          {model.ticks.map((tick) => (
            <Text
              key={`${tick}`}
              style={[
                styles.yAxisLabel,
                { top: PLOT_BOTTOM - ((tick / model.axisMax) * (PLOT_BOTTOM - PLOT_TOP)) - 6 },
              ]}
            >
              {formatDistance(tick, units, { decimals: 0 })}
            </Text>
          ))}
          <Text style={styles.axisUnit}>{unitLabel}</Text>
        </View>

        {model.ticks.map((tick) => (
          <View
            key={`grid-${tick}`}
            pointerEvents="none"
            style={[
              styles.gridLine,
              { top: PLOT_BOTTOM - ((tick / model.axisMax) * (PLOT_BOTTOM - PLOT_TOP)) },
            ]}
          />
        ))}

        {model.segments.map((segment) => (
          <View
            key={segment.key}
            pointerEvents="none"
            testID={`block-volume-line-${segment.phase.toLowerCase()}`}
            style={[
              styles.curveSegment,
              {
                left: segment.x - ((segment.width + LINE_OVERLAP) / 2),
                top: segment.y - LINE_WIDTH / 2,
                width: segment.width + LINE_OVERLAP,
                backgroundColor: segment.color,
                transform: [{ rotate: `${segment.angle}deg` }],
              },
            ]}
          />
        ))}

        {model.markers.map((marker) => (
          <View
            key={`${marker.phase}-${marker.index}`}
            pointerEvents="none"
            testID="block-volume-phase-marker"
            style={[
              styles.phaseMarker,
              {
                left: marker.x - MARKER_SIZE / 2,
                top: marker.y - MARKER_SIZE / 2,
                backgroundColor: PHASE_COLOR[marker.phase],
              },
            ]}
          />
        ))}

        {selectedPoint ? (
          <View pointerEvents="none" style={styles.selectionLayer}>
            <View style={[styles.selectedGuide, { left: selectedPoint.x }]} />
            <View
              style={[
                styles.selectedMarker,
                {
                  left: selectedPoint.x - SELECTED_MARKER_SIZE / 2,
                  top: selectedPoint.y - SELECTED_MARKER_SIZE / 2,
                  backgroundColor: PHASE_COLOR[selectedPoint.phase],
                },
              ]}
            />
          </View>
        ) : null}

        {model.markers.map((marker) => (
          <Text
            key={`label-${marker.phase}-${marker.index}`}
            style={[
              styles.axisLabel,
              { left: clamp(marker.x - 17, PLOT_LEFT - 8, PLOT_RIGHT - 36) },
            ]}
          >
            {marker.label}
          </Text>
        ))}
        <Text
          style={[
            styles.axisLabel,
            styles.axisLabelRace,
            shouldStackFinalPhaseLabel && styles.axisLabelRaceStacked,
          ]}
        >
          {PHASE_LABEL[raceWeek.phase].toUpperCase()}
        </Text>

        {selectedWeek && selectedPoint ? (
          <View
            pointerEvents="none"
            style={[
              styles.tooltipLayer,
              {
                left: tooltipLeft,
                top: tooltipTop,
              },
            ]}
          >
            <VolumeTooltip
              week={selectedWeek}
              weekIndex={selectedWeekIndex ?? 0}
              totalWeeks={plan.length}
              raceDate={raceDate}
              units={units}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.stats}>
        <StatBox label="Start" value={formatDistance(startWeek.plannedKm, units, { decimals: 0 })} />
        <StatBox label="Peak" value={peakLabel} />
        <StatBox label="Race" value={formatDistance(raceWeek.plannedKm, units, { decimals: 0 })} />
      </View>

      <View style={styles.phaseStrip} testID="block-volume-phase-strip">
        {model.phaseRuns.map((run, index) => (
          <View
            key={`${run.phase}-${run.start}`}
            testID={`block-volume-phase-strip-${run.phase.toLowerCase()}`}
            accessibilityLabel={`${PHASE_LABEL[run.phase]} phase, weeks ${run.start + 1} to ${run.end + 1}`}
            style={[
              styles.phaseStripSegment,
              index === 0 && styles.phaseStripFirst,
              index === model.phaseRuns.length - 1 && styles.phaseStripLast,
              {
                flex: run.count,
                backgroundColor: PHASE_COLOR[run.phase],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: FONTS.sansMedium,
    fontSize: 20,
    color: C.ink,
    lineHeight: 24,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: C.muted,
    marginTop: 3,
  },
  peakPill: {
    backgroundColor: C.amberBg,
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  peakPillText: {
    fontFamily: FONTS.monoBold,
    fontSize: 12,
    color: C.amber,
  },
  chart: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    alignSelf: 'center',
    position: 'relative',
    marginTop: 2,
    marginBottom: 4,
  },
  yAxis: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PLOT_LEFT - 8,
    height: CHART_HEIGHT,
  },
  yAxisLabel: {
    position: 'absolute',
    left: 0,
    width: PLOT_LEFT - 12,
    textAlign: 'right',
    fontFamily: FONTS.mono,
    fontSize: 9,
    lineHeight: 11,
    color: C.muted,
  },
  gridLine: {
    position: 'absolute',
    left: PLOT_LEFT,
    right: CHART_WIDTH - PLOT_RIGHT,
    height: 1,
    borderTopWidth: 1,
    borderTopColor: `${C.border}88`,
  },
  curveSegment: {
    position: 'absolute',
    height: LINE_WIDTH,
    borderRadius: LINE_WIDTH,
  },
  phaseMarker: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 1.5,
    borderColor: C.surface,
  },
  axisUnit: {
    position: 'absolute',
    left: 0,
    top: PLOT_TOP - 22,
    width: PLOT_LEFT - 12,
    textAlign: 'right',
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.muted,
  },
  axisLabel: {
    position: 'absolute',
    top: PLOT_BOTTOM + 13,
    width: 40,
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.muted,
  },
  axisLabelRace: {
    right: 0,
    textAlign: 'right',
    width: 52,
  },
  axisLabelRaceStacked: {
    top: PLOT_BOTTOM + 28,
  },
  selectionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  selectedGuide: {
    position: 'absolute',
    top: PLOT_TOP,
    bottom: CHART_HEIGHT - PLOT_BOTTOM,
    width: 1,
    backgroundColor: `${C.ink2}28`,
  },
  selectedMarker: {
    position: 'absolute',
    width: SELECTED_MARKER_SIZE,
    height: SELECTED_MARKER_SIZE,
    borderRadius: SELECTED_MARKER_SIZE / 2,
    borderWidth: 2,
    borderColor: C.surface,
  },
  tooltipLayer: {
    position: 'absolute',
    width: TOOLTIP_WIDTH,
  },
  tooltip: {
    width: TOOLTIP_WIDTH,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tooltipTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    color: C.ink,
    marginBottom: 2,
  },
  tooltipLine: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    lineHeight: 14,
    color: C.muted,
  },
  tooltipValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 10,
    lineHeight: 14,
    color: C.ink2,
    marginTop: 1,
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  statBox: {
    flex: 1,
    minHeight: 66,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingVertical: 11,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
  },
  statLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: C.muted,
  },
  statValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 17,
    color: C.ink,
  },
  phaseStrip: {
    height: 11,
    flexDirection: 'row',
    gap: 3,
    marginTop: 13,
    overflow: 'hidden',
    borderRadius: 7,
  },
  phaseStripSegment: {
    minWidth: 6,
  },
  phaseStripFirst: {
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
  },
  phaseStripLast: {
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
  },
});
