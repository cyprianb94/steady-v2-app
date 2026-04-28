import type { StructuredQualitySummary, StructuredQualityTargetPaceRange } from '@steady/types';
import { formatDistance, formatPace, type DistanceUnits } from '../../lib/units';
import type {
  QualitySummaryCardProps,
  QualitySummaryMetric,
  QualitySummaryStatusTone,
} from '../../components/run/QualitySummaryCard';

function sessionType(summary: StructuredQualitySummary): QualitySummaryCardProps['sessionType'] | null {
  if (summary.sessionType === 'INTERVAL') {
    return 'interval';
  }

  if (summary.sessionType === 'TEMPO') {
    return 'tempo';
  }

  return null;
}

function targetLabel(range: StructuredQualityTargetPaceRange | null, units: DistanceUnits): string | null {
  if (!range) {
    return null;
  }

  if (range.minSecondsPerKm === range.maxSecondsPerKm) {
    return `Target ${formatPace(range.minSecondsPerKm, units, { withUnit: true, compactUnit: true })}`;
  }

  return `Target ${formatPace(range.minSecondsPerKm, units)}-${formatPace(range.maxSecondsPerKm, units, {
    withUnit: true,
    compactUnit: true,
  })}`;
}

function intervalStatusTone(summary: StructuredQualitySummary): QualitySummaryStatusTone {
  if (summary.status !== 'available' || summary.sessionType !== 'INTERVAL') {
    return 'neutral';
  }

  const reps = summary.intervalReps;
  if (!reps || reps.inTargetRange == null) {
    return 'neutral';
  }

  if (reps.inTargetRange === reps.planned) {
    return 'completed';
  }

  return reps.inTargetRange > 0 ? 'varied' : 'caution';
}

function metrics(summary: StructuredQualitySummary, units: DistanceUnits): QualitySummaryMetric[] {
  if (summary.status !== 'available') {
    return [];
  }

  if (summary.sessionType === 'INTERVAL') {
    const reps = summary.intervalReps;
    const hasTarget = reps?.inTargetRange != null;

    return [
      {
        kind: hasTarget ? 'status' : 'count',
        label: hasTarget ? 'in range' : 'reps found',
        value: reps ? `${hasTarget ? reps.inTargetRange : reps.found} / ${reps.planned}` : null,
        statusTone: intervalStatusTone(summary),
      },
      {
        kind: 'pace',
        label: 'rep avg',
        value: formatPace(summary.averagePaceSecondsPerKm, units, { withUnit: true }),
      },
      {
        kind: 'heartRate',
        label: 'interval bpm',
        value: summary.averageHeartRateBpm == null ? null : String(summary.averageHeartRateBpm),
      },
    ];
  }

  return [
    {
      kind: 'distance',
      label: 'tempo block',
      value: formatDistance(summary.qualityDistanceKm, units, { spaced: true }),
    },
    {
      kind: 'pace',
      label: 'tempo avg',
      value: formatPace(summary.averagePaceSecondsPerKm, units, { withUnit: true }),
    },
    {
      kind: 'heartRate',
      label: 'tempo bpm',
      value: summary.averageHeartRateBpm == null ? null : String(summary.averageHeartRateBpm),
    },
  ];
}

export function qualitySummaryCardProps(
  summary: StructuredQualitySummary | null,
  units: DistanceUnits,
): QualitySummaryCardProps | null {
  if (!summary) {
    return null;
  }

  const resolvedSessionType = sessionType(summary);
  if (!resolvedSessionType) {
    return null;
  }

  return {
    sessionType: resolvedSessionType,
    metrics: metrics(summary, units),
    targetLabel: summary.status === 'available' ? targetLabel(summary.targetPaceRange, units) : null,
    note: 'Whole-run average pace is context only for this session.',
    available: summary.status === 'available',
    unavailableMessage: 'This run is missing structured lap data, so Steady cannot summarise the quality section without guessing.',
  };
}
