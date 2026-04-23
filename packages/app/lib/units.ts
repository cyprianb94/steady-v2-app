import { normalizeSessionDuration, type PlannedSession, type SessionDurationSpec, type User } from '@steady/types';

export type DistanceUnits = User['units'];

const KM_PER_MILE = 1.609344;

interface DistanceFormatOptions {
  decimals?: number;
  spaced?: boolean;
  compactMetric?: boolean;
  trimTrailingZero?: boolean;
}

interface PaceFormatOptions {
  withUnit?: boolean;
}

function formatRounded(value: number, decimals: number, trimTrailingZero: boolean): string {
  const fixed = value.toFixed(decimals);
  return trimTrailingZero ? Number(fixed).toString() : fixed;
}

function paceToSeconds(pace: string): number | null {
  const [minutes, seconds] = pace.split(':').map(Number);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
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

  return `${base} /${units === 'imperial' ? 'mi' : 'km'}`;
}

export function formatStoredPace(
  pace: string | null | undefined,
  units: DistanceUnits,
  options: PaceFormatOptions = {},
): string {
  if (!pace) return '—';
  const seconds = paceToSeconds(pace);
  if (seconds == null) return pace;
  return formatPace(seconds, units, options);
}

export function formatSessionLabel(
  session: Partial<PlannedSession> | null,
  units: DistanceUnits,
): string {
  if (!session || session.type === 'REST') return 'Rest';
  if (session.type === 'INTERVAL') {
    return `${session.reps ?? 6}×${session.repDist ?? 800}m @ ${formatStoredPace(session.pace, units)}`;
  }

  const distanceLabel = session.distance != null ? formatDistance(session.distance, units) : '?';
  return `${distanceLabel} @ ${formatStoredPace(session.pace, units)}`;
}

export function formatCompactSessionLabel(
  session: PlannedSession | null,
  units: DistanceUnits,
): string {
  if (!session || session.type === 'REST') return 'Rest';

  switch (session.type) {
    case 'INTERVAL':
      return session.reps && session.repDist
        ? `${session.reps}×${session.repDist}m Intervals`
        : 'Intervals';
    case 'TEMPO':
      return `Tempo ${formatDistance(session.distance ?? 0, units, { compactMetric: true })}`;
    case 'LONG':
      return `Long ${formatDistance(session.distance ?? 0, units, { compactMetric: true })}`;
    case 'EASY':
    default:
      return `Easy ${formatDistance(session.distance ?? 0, units, { compactMetric: true })}`;
  }
}

export function formatSessionTitle(
  session: PlannedSession,
  units: DistanceUnits,
): string {
  if (session.type === 'INTERVAL') {
    return `${session.reps}×${session.repDist}m Intervals`;
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

export function formatSplitLabel(
  split: { km: number; label?: string; distance?: number },
  units: DistanceUnits,
): string {
  if (split.label && units === 'metric') {
    return split.label;
  }

  if (split.label) {
    const kmMatch = split.label.match(/^(\d+(?:\.\d+)?)\s*km$/i);
    if (kmMatch) {
      const parsedDistance = Number(kmMatch[1]);
      return formatDistance(parsedDistance, units, {
        decimals: parsedDistance >= 1 ? 1 : 2,
        spaced: true,
      });
    }

    return split.label;
  }

  if (typeof split.distance === 'number' && split.distance > 0) {
    return formatDistance(split.distance, units, {
      decimals: split.distance >= 1 ? 1 : 2,
      spaced: true,
    });
  }

  return `Split ${split.km}`;
}
