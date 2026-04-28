import {
  normalizeIntensityTarget,
  normalizeSessionDuration,
  parsePaceSeconds,
  type IntensityTarget,
  type PlannedSession,
  type SessionDurationSpec,
  type User,
} from '@steady/types';

export type DistanceUnits = User['units'];

const KM_PER_MILE = 1.609344;

interface DistanceFormatOptions {
  decimals?: number;
  spaced?: boolean;
  compactMetric?: boolean;
  trimTrailingZero?: boolean;
}

export interface PaceFormatOptions {
  withUnit?: boolean;
  compactUnit?: boolean;
}

export interface IntensityTargetDisplayOptions {
  withUnit?: boolean;
  separator?: string;
  fallbackToLegacyPace?: boolean;
  includeEffort?: boolean;
  hideCompatibilityPace?: boolean;
}

export type SplitLabelMode = 'position' | 'segment';

interface SplitLabelOptions {
  mode?: SplitLabelMode;
}

type SplitLabelInput = { km: number; label?: string; distance?: number };

type SessionLike = Partial<PlannedSession>;
type IntensityTargetDisplayInput = IntensityTarget | SessionLike | null | undefined;

export interface IntensityTargetDisplayParts {
  pace: string | null;
  effort: string | null;
  label: string | null;
}

function formatRounded(value: number, decimals: number, trimTrailingZero: boolean): string {
  const fixed = value.toFixed(decimals);
  return trimTrailingZero ? Number(fixed).toString() : fixed;
}

function parseDistanceLabelKm(label: string): number | null {
  const trimmed = label.trim();
  const kmMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*km$/i);
  if (kmMatch) {
    return Number(kmMatch[1]);
  }

  const metreMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*m$/i);
  if (metreMatch) {
    return Number(metreMatch[1]) / 1000;
  }

  return null;
}

function isPositionLabel(label: string, splitKm: number): boolean {
  return new RegExp(`^km\\s*${splitKm}$`, 'i').test(label.trim());
}

function isFullKmDistance(distanceKm: number): boolean {
  return distanceKm >= 0.95 && distanceKm <= 1.05;
}

function formatSplitDistance(distanceKm: number, units: DistanceUnits): string {
  return formatDistance(distanceKm, units, {
    decimals: distanceKm >= 1 ? 1 : 2,
    spaced: true,
  });
}

function formatSegmentSplitDistance(distanceKm: number, units: DistanceUnits): string {
  if (units === 'metric' && distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }

  const displayDistance = toDisplayDistance(distanceKm, units);
  const roundedToTwo = Number(displayDistance.toFixed(2));
  const decimals = Number.isInteger(roundedToTwo) ? 0 : 2;
  const unitLabel = units === 'imperial' ? 'mi' : 'km';
  return `${formatRounded(displayDistance, decimals, true)} ${unitLabel}`;
}

function formatExplicitDistanceLabel(label: string, units: DistanceUnits): string | null {
  const parsedDistance = parseDistanceLabelKm(label);
  if (parsedDistance != null) {
    return formatSegmentSplitDistance(parsedDistance, units);
  }

  return null;
}

function formatPartialSplitDistance(distanceKm: number, units: DistanceUnits): string {
  const displayDistance = toDisplayDistance(distanceKm, units);
  return `+${formatRounded(displayDistance, displayDistance >= 1 ? 1 : 2, true)}`;
}

function splitDistanceKm(split: SplitLabelInput): number | null {
  if (typeof split.distance === 'number' && split.distance > 0) {
    return split.distance;
  }

  if (split.label && !isPositionLabel(split.label, split.km)) {
    return parseDistanceLabelKm(split.label);
  }

  return null;
}

export function toDisplayDistance(distanceKm: number, units: DistanceUnits): number {
  return units === 'imperial' ? distanceKm / KM_PER_MILE : distanceKm;
}

export function formatDistance(
  distanceKm: number,
  units: DistanceUnits,
  options: DistanceFormatOptions = {},
): string {
  const {
    decimals = 1,
    spaced = false,
    compactMetric = false,
    trimTrailingZero = true,
  } = options;
  const value = toDisplayDistance(distanceKm, units);
  const unitLabel = units === 'imperial' ? 'mi' : compactMetric ? 'k' : 'km';
  return `${formatRounded(value, decimals, trimTrailingZero)}${spaced ? ' ' : ''}${unitLabel}`;
}

export function formatDurationCompact(totalSeconds: number): string {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, '0')}`;
}

export function formatDurationAccessible(totalSeconds: number): string {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }

  return parts.join(' ');
}

export function formatPace(
  secondsPerKm: number,
  units: DistanceUnits,
  options: PaceFormatOptions = {},
): string {
  const totalSeconds = units === 'imperial'
    ? Math.round(secondsPerKm * KM_PER_MILE)
    : Math.round(secondsPerKm);
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const base = `${mins}:${String(secs).padStart(2, '0')}`;

  if (!options.withUnit) {
    return base;
  }

  const spacer = options.compactUnit ? '' : ' ';
  return `${base}${spacer}/${units === 'imperial' ? 'mi' : 'km'}`;
}

export function formatStoredPace(
  pace: string | null | undefined,
  units: DistanceUnits,
  options: PaceFormatOptions = {},
): string {
  if (!pace) return '—';
  const seconds = parsePaceSeconds(pace);
  if (seconds == null) return pace;
  return formatPace(seconds, units, options);
}

function formatStoredPaceNullable(
  pace: string | null | undefined,
  units: DistanceUnits,
  options: PaceFormatOptions = {},
): string | null {
  if (!pace) return null;
  const seconds = parsePaceSeconds(pace);
  if (seconds == null) return pace;
  return formatPace(seconds, units, options);
}

function unitSuffix(units: DistanceUnits): string {
  return `/${units === 'imperial' ? 'mi' : 'km'}`;
}

function isSessionLike(value: IntensityTargetDisplayInput): value is SessionLike {
  return typeof value === 'object'
    && value !== null
    && 'type' in value;
}

function isCompatibilityPaceTarget(session: SessionLike, target: IntensityTarget): boolean {
  if (
    target.source !== 'manual'
    || target.mode !== 'pace'
    || !target.pace
    || target.paceRange
    || target.effortCue
    || target.profileKey
  ) {
    return false;
  }

  const targetSeconds = parsePaceSeconds(target.pace);
  const legacySeconds = parsePaceSeconds(session.pace);
  return targetSeconds != null && legacySeconds != null && targetSeconds === legacySeconds;
}

function targetForDisplay(
  value: IntensityTargetDisplayInput,
  options: IntensityTargetDisplayOptions,
): IntensityTarget | undefined {
  if (!value) {
    return undefined;
  }

  if (isSessionLike(value)) {
    if (!value.intensityTarget && !options.fallbackToLegacyPace) {
      return undefined;
    }

    const target = normalizeIntensityTarget(value.intensityTarget, {
      fallbackPace: options.fallbackToLegacyPace ? value.pace : undefined,
    });

    if (target && options.hideCompatibilityPace && isCompatibilityPaceTarget(value, target)) {
      return undefined;
    }

    return target;
  }

  return normalizeIntensityTarget(value);
}

function formatTargetPace(
  target: IntensityTarget,
  units: DistanceUnits,
  options: IntensityTargetDisplayOptions,
): string | null {
  if (target.paceRange) {
    const min = formatStoredPaceNullable(target.paceRange.min, units);
    const max = formatStoredPaceNullable(target.paceRange.max, units);
    if (!min || !max) {
      return null;
    }

    const range = min === max ? min : `${min}-${max}`;
    return options.withUnit ? `${range}${unitSuffix(units)}` : range;
  }

  if (target.pace) {
    return formatStoredPaceNullable(target.pace, units, {
      withUnit: options.withUnit,
      compactUnit: true,
    });
  }

  return null;
}

export function formatIntensityTargetParts(
  value: IntensityTargetDisplayInput,
  units: DistanceUnits,
  options: IntensityTargetDisplayOptions = {},
): IntensityTargetDisplayParts {
  const target = targetForDisplay(value, options);
  if (!target) {
    return { pace: null, effort: null, label: null };
  }

  const pace = formatTargetPace(target, units, options);
  const effort = options.includeEffort === false ? null : target.effortCue ?? null;
  const parts = [pace, effort].filter((part): part is string => Boolean(part));

  return {
    pace,
    effort,
    label: parts.length ? parts.join(options.separator ?? ' · ') : null,
  };
}

export function formatIntensityTargetDisplay(
  value: IntensityTargetDisplayInput,
  units: DistanceUnits,
  options: IntensityTargetDisplayOptions = {},
): string | null {
  return formatIntensityTargetParts(value, units, options).label;
}

function lowercaseSessionType(type: PlannedSession['type'] | undefined): string {
  switch (type) {
    case 'TEMPO':
      return 'tempo';
    case 'LONG':
      return 'long';
    case 'INTERVAL':
      return 'interval';
    case 'EASY':
    default:
      return 'easy';
  }
}

function formattedIntervalTarget(
  session: SessionLike,
  units: DistanceUnits,
  options: IntensityTargetDisplayOptions = {},
): string | null {
  const target = formatIntensityTargetParts(session, units, {
    hideCompatibilityPace: true,
    ...options,
  });
  if (target.pace) {
    return ` · ${target.pace}${target.effort ? ` · ${target.effort}` : ''}`;
  }

  if (target.effort) {
    return ` · ${target.effort}`;
  }

  return null;
}

export function formatIntervalRepLength(session: Partial<PlannedSession>): string {
  if (session.repDuration) {
    if (session.repDuration.unit === 'km') {
      const metres = session.repDuration.value * 1000;
      return Number.isInteger(metres) && metres < 1000
        ? `${metres}m`
        : `${formatRounded(session.repDuration.value, 1, true)}km`;
    }

    return `${formatRounded(session.repDuration.value, 2, true)}min`;
  }

  return `${session.repDist ?? 800}m`;
}

export function formatSessionLabel(
  session: SessionLike | null,
  units: DistanceUnits,
): string {
  if (!session || session.type === 'REST') return 'Rest';
  if (session.type === 'INTERVAL') {
    const target = formattedIntervalTarget(session, units);
    if (target) {
      return `${session.reps ?? 6}×${formatIntervalRepLength(session)}${target}`;
    }

    return `${session.reps ?? 6}×${formatIntervalRepLength(session)} · ${formatStoredPace(session.pace, units)}`;
  }

  const distanceLabel = session.distance != null ? formatDistance(session.distance, units) : '?';
  const target = formatIntensityTargetDisplay(session, units, { hideCompatibilityPace: true });
  if (target) {
    return `${distanceLabel} ${lowercaseSessionType(session.type)} · ${target}`;
  }

  return `${distanceLabel} ${lowercaseSessionType(session.type)} · ${formatStoredPace(session.pace, units)}`;
}

export function formatCompactSessionLabel(
  session: PlannedSession | null,
  units: DistanceUnits,
): string {
  if (!session || session.type === 'REST') return 'Rest';

  switch (session.type) {
    case 'INTERVAL': {
      const base = session.reps && (session.repDist || session.repDuration)
        ? `${session.reps}×${formatIntervalRepLength(session)}`
        : 'Intervals';
      const target = formattedIntervalTarget(session, units, { includeEffort: false });
      return target ? `${base}${target}` : `${base} Intervals`;
    }
    case 'TEMPO': {
      const distance = formatDistance(session.distance ?? 0, units, { compactMetric: true });
      const target = formatIntensityTargetDisplay(session, units, {
        hideCompatibilityPace: true,
        includeEffort: true,
      });
      return target ? `Tempo ${distance} · ${target}` : `Tempo ${distance}`;
    }
    case 'LONG': {
      const distance = formatDistance(session.distance ?? 0, units, { compactMetric: true });
      const target = formatIntensityTargetDisplay(session, units, {
        hideCompatibilityPace: true,
        includeEffort: true,
      });
      return target ? `Long ${distance} · ${target}` : `Long ${distance}`;
    }
    case 'EASY':
    default: {
      const distance = formatDistance(session.distance ?? 0, units, { compactMetric: true });
      const target = formatIntensityTargetDisplay(session, units, {
        hideCompatibilityPace: true,
        includeEffort: true,
      });
      return target ? `Easy ${distance} · ${target}` : `Easy ${distance}`;
    }
  }
}

export function formatSessionTitle(
  session: PlannedSession,
  units: DistanceUnits,
): string {
  if (session.type === 'INTERVAL') {
    return `${session.reps}×${formatIntervalRepLength(session)} Intervals`;
  }

  const typeTitle = session.type === 'TEMPO'
    ? 'Tempo'
    : session.type === 'LONG'
      ? 'Long Run'
      : 'Easy Run';

  return `${formatDistance(session.distance ?? 0, units)} ${typeTitle}`;
}

export function formatWarmupCooldown(
  duration: SessionDurationSpec | number | null | undefined,
  units: DistanceUnits,
  label: 'warmup' | 'cooldown',
): string {
  const normalized = normalizeSessionDuration(duration);
  if (!normalized) {
    return label;
  }

  if (normalized.unit === 'min') {
    return `${normalized.value} min ${label}`;
  }

  return `${formatDistance(normalized.value, units)} ${label}`;
}

export function inferSplitLabelMode(
  session: Pick<PlannedSession, 'type'> | null | undefined,
  splits: SplitLabelInput[],
): SplitLabelMode {
  const lastIndex = splits.length - 1;
  const hasStructuredSplit = splits.some((split, index) => {
    const labelDistance = split.label && !isPositionLabel(split.label, split.km)
      ? parseDistanceLabelKm(split.label)
      : null;
    const distanceKm = splitDistanceKm(split);

    if (split.label && !isPositionLabel(split.label, split.km) && labelDistance == null) {
      return true;
    }

    if (typeof distanceKm !== 'number' || distanceKm <= 0) {
      return false;
    }

    const finalPartial = index === lastIndex && distanceKm < 0.95;
    return !isFullKmDistance(distanceKm) && !finalPartial;
  });

  if (session?.type === 'INTERVAL') {
    return hasStructuredSplit ? 'segment' : 'position';
  }

  return hasStructuredSplit ? 'segment' : 'position';
}

export function formatSplitLabel(
  split: SplitLabelInput,
  units: DistanceUnits,
  options: SplitLabelOptions = {},
): string {
  if (options.mode === 'position') {
    const distanceKm = splitDistanceKm(split);
    if (typeof distanceKm === 'number' && distanceKm > 0 && distanceKm < 0.95) {
      return formatPartialSplitDistance(distanceKm, units);
    }

    return String(split.km);
  }

  if (options.mode === 'segment' && typeof split.distance === 'number' && split.distance > 0) {
    return formatSegmentSplitDistance(split.distance, units);
  }

  if (split.label) {
    const distanceLabel = formatExplicitDistanceLabel(split.label, units);
    if (distanceLabel) {
      return distanceLabel;
    }

    return split.label;
  }

  if (typeof split.distance === 'number' && split.distance > 0) {
    return formatSplitDistance(split.distance, units);
  }

  return `Split ${split.km}`;
}
