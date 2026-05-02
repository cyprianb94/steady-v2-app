import type {
  BlockReviewModel,
  PhaseName,
} from '@steady/types';
import { PHASE_COLOR } from '../../constants/phase-meta';

export const CHART_HEIGHT = 150;
export const CHART_WIDTH_FALLBACK = 300;
export const CHART_Y_AXIS_WIDTH = 24;
export const CHART_TOP = 22;
export const CHART_BOTTOM = 122;
export const CHART_LINE_WIDTH = 2.8;
export const CHART_CURVE_SMOOTHING = 0.18;
export const CHART_PHASE_MARKER_SIZE = 8;
export const CHART_SELECTED_MARKER_SIZE = 12;
export const CHART_X_AXIS_LABEL_WIDTH = 40;
export const CHART_TOOLTIP_WIDTH = 132;
export const CHART_CURRENT_GUIDE_POINT_GAP = 9;
export const CHART_CURRENT_GUIDE_EDGE_INSET = 7;
export const CHART_CURRENT_GUIDE_DOT_SIZE = 2;
export const CHART_CURRENT_GUIDE_DOT_SPACING = 4;
export const CHART_SCRUB_TOP = CHART_TOP - 16;
export const CHART_SCRUB_BOTTOM = CHART_BOTTOM + 30;

export interface ReviewVolumeChartPoint {
  weekIndex: number;
  weekNumber: number;
  phase: PhaseName;
  km: number;
  x: number;
  y: number;
}

export interface ReviewVolumeChartTick {
  value: number;
  y: number;
}

export interface ReviewVolumeChartPhaseMarker {
  weekIndex: number;
  weekNumber: number;
  phase: PhaseName;
  x: number;
  y: number;
}

export interface ReviewVolumeChartGradientStop {
  key: string;
  offset: string;
  color: string;
}

export interface ReviewVolumeChartModel {
  points: ReviewVolumeChartPoint[];
  pathD: string;
  gradientStops: ReviewVolumeChartGradientStop[];
  phaseMarkers: ReviewVolumeChartPhaseMarker[];
  ticks: ReviewVolumeChartTick[];
  axisMax: number;
}

export function clampNumber(value: number, min: number, max: number): number {
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

function formatSvgNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatAxisTickLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildContinuousPath(points: ReviewVolumeChartPoint[]): string {
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
  points: ReviewVolumeChartPoint[],
  chartWidth: number,
): ReviewVolumeChartGradientStop[] {
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
  const points = weeks.map<ReviewVolumeChartPoint>((week, weekIndex) => ({
    weekIndex,
    weekNumber: week.weekNumber,
    phase: week.phase,
    km: week.plannedKm,
    x: (width * weekIndex) / denominator,
    y: CHART_BOTTOM - (clampNumber(week.plannedKm / axisMax, 0, 1) * ySpan),
  }));

  const phaseMarkers = model.phaseSegments
    .map((segment) => points.find((point) => point.weekNumber === segment.startWeekNumber))
    .filter((point): point is ReviewVolumeChartPoint => Boolean(point))
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

export function weekIndexFromX(x: number, chartWidth: number, totalWeeks: number): number {
  if (totalWeeks <= 1) {
    return 0;
  }

  const ratio = clampNumber(x, 0, chartWidth) / Math.max(chartWidth, 1);
  return clampNumber(Math.round(ratio * (totalWeeks - 1)), 0, totalWeeks - 1);
}
