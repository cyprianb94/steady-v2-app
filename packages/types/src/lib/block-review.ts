import type { PhaseConfig, PhaseName, PlanWeek } from '../plan';
import type { PlannedSession, SessionType } from '../session';

export const BLOCK_REVIEW_PHASE_ORDER: PhaseName[] = ['BASE', 'BUILD', 'RECOVERY', 'PEAK', 'TAPER'];

export type BlockReviewTab = 'structure' | 'weeks';

export interface BuildBlockReviewModelInput {
  weeks: readonly PlanWeek[];
  phases?: Partial<PhaseConfig> | null;
  progressionPct?: number | null;
  progressionEveryWeeks?: number | null;
  currentWeekIndex?: number | null;
}

export interface BlockReviewWeekModel {
  id: string;
  weekIndex: number;
  weekNumber: number;
  phase: PhaseName;
  plannedKm: number;
  volumeRatio: number;
  sessions: readonly (PlannedSession | null)[];
  sessionTypes: SessionType[];
  title: string;
  detail: string;
  isStartWeek: boolean;
  isPeakWeek: boolean;
  isRaceWeek: boolean;
  isCurrentWeek: boolean;
}

export interface BlockReviewPhaseModel {
  phase: PhaseName;
  weekCount: number;
  weekNumbers: number[];
  startWeekNumber: number;
  endWeekNumber: number;
  rangeLabel: string;
  startKm: number;
  endKm: number;
  peakKm: number;
  averageKm: number;
  sessionTypes: SessionType[];
  summary: string;
}

export interface BlockReviewPhaseSegment {
  phase: PhaseName;
  weekCount: number;
  startWeekNumber: number;
  endWeekNumber: number;
  isCurrent: boolean;
}

export interface BlockReviewVolumePoint {
  weekNumber: number;
  phase: PhaseName;
  plannedKm: number;
  x: number;
  y: number;
  isStart: boolean;
  isPeak: boolean;
  isRace: boolean;
}

export interface BlockReviewVolumeStats {
  totalWeeks: number;
  startKm: number;
  peakKm: number;
  peakWeekNumber: number;
  raceKm: number;
  averageKm: number;
  maxKm: number;
}

export interface BlockReviewOverloadModel {
  progressionPct: number;
  progressionEveryWeeks: number;
  hasProgression: boolean;
  label: string;
}

export interface BlockReviewVolumeModel {
  points: BlockReviewVolumePoint[];
  stats: BlockReviewVolumeStats;
}

export interface BlockReviewModel {
  totalWeeks: number;
  progressionPct: number;
  progressionEveryWeeks: number;
  overload: BlockReviewOverloadModel;
  weeks: BlockReviewWeekModel[];
  phases: BlockReviewPhaseModel[];
  phaseSegments: BlockReviewPhaseSegment[];
  volume: BlockReviewVolumeModel;
  keyWeeks: BlockReviewWeekModel[];
  structureLabel: string;
}

const PHASE_LABEL: Record<PhaseName, string> = {
  BASE: 'Base',
  BUILD: 'Build',
  RECOVERY: 'Recovery',
  PEAK: 'Peak',
  TAPER: 'Taper',
};

function formatKm(value: number): string {
  return `${Math.round(value)}km`;
}

function roundKm(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizeProgressionEveryWeeks(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return 2;
  }

  return Math.max(1, Math.min(12, Math.round(value as number)));
}

function formatOverloadLabel(progressionPct: number, progressionEveryWeeks: number): string {
  if (progressionPct <= 0) {
    return 'Flat plan';
  }

  return progressionEveryWeeks === 1
    ? `+${progressionPct}% every week`
    : `+${progressionPct}% every ${progressionEveryWeeks} weeks`;
}

function safePlannedKm(week: PlanWeek): number {
  return Number.isFinite(week.plannedKm) && week.plannedKm > 0 ? roundKm(week.plannedKm) : 0;
}

function getSessionTypes(week: PlanWeek): SessionType[] {
  return Array.from({ length: 7 }, (_, index) => week.sessions[index]?.type ?? 'REST');
}

function formatWeekRange(weekNumbers: number[]): string {
  if (weekNumbers.length === 0) return '';

  const ranges: string[] = [];
  let start = weekNumbers[0];
  let previous = weekNumbers[0];

  for (let i = 1; i <= weekNumbers.length; i += 1) {
    const current = weekNumbers[i];
    if (current === previous + 1) {
      previous = current;
      continue;
    }

    ranges.push(start === previous ? `W${start}` : `W${start}-W${previous}`);
    start = current;
    previous = current;
  }

  return ranges.join(', ');
}

function getWeekTitle(week: PlanWeek, flags: {
  isStartWeek: boolean;
  isPeakWeek: boolean;
  isRaceWeek: boolean;
}): string {
  if (flags.isStartWeek) return 'Settle into rhythm';
  if (flags.isPeakWeek) return 'Peak week';
  if (flags.isRaceWeek) return 'Race week';

  switch (week.phase) {
    case 'BASE':
      return 'Base week';
    case 'BUILD':
      return 'Build week';
    case 'RECOVERY':
      return 'Recovery week';
    case 'PEAK':
      return 'Peak work';
    case 'TAPER':
      return 'Taper week';
    default:
      return 'Plan week';
  }
}

function getWeekDetail(week: PlanWeek, plannedKm: number, flags: {
  isPeakWeek: boolean;
}): string {
  if (flags.isPeakWeek) {
    return `${formatKm(plannedKm)} · Highest load`;
  }

  return `${formatKm(plannedKm)} · ${PHASE_LABEL[week.phase]}`;
}

function phaseSummary(phase: PhaseName, startKm: number, endKm: number): string {
  switch (phase) {
    case 'BASE':
      return 'Hold the template steady while the routine settles.';
    case 'BUILD':
      return `Main progression. Volume moves from ${formatKm(startKm)} to ${formatKm(endKm)} before peak.`;
    case 'RECOVERY':
      return 'Absorb the work and keep the week deliberately lighter.';
    case 'PEAK':
      return 'Highest load. Long run and tempo work sit here.';
    case 'TAPER':
      return 'Reduce volume and keep rhythm into race day.';
    default:
      return '';
  }
}

function buildPhaseSegments(
  weeks: readonly PlanWeek[],
  currentWeekIndex: number | null,
): BlockReviewPhaseSegment[] {
  const segments: BlockReviewPhaseSegment[] = [];

  weeks.forEach((week, index) => {
    const last = segments[segments.length - 1];
    if (last && last.phase === week.phase) {
      last.weekCount += 1;
      last.endWeekNumber = week.weekNumber;
      last.isCurrent = last.isCurrent || index === currentWeekIndex;
      return;
    }

    segments.push({
      phase: week.phase,
      weekCount: 1,
      startWeekNumber: week.weekNumber,
      endWeekNumber: week.weekNumber,
      isCurrent: index === currentWeekIndex,
    });
  });

  return segments;
}

function configuredPhaseCount(
  phase: PhaseName,
  phases: Partial<PhaseConfig> | null | undefined,
  fallback: number,
): number {
  const configured = phases?.[phase];
  return typeof configured === 'number' && Number.isFinite(configured) ? configured : fallback;
}

function buildStructureLabel(
  weeksByPhase: Map<PhaseName, BlockReviewWeekModel[]>,
  phases: Partial<PhaseConfig> | null | undefined,
): string {
  return BLOCK_REVIEW_PHASE_ORDER
    .map((phase) => {
      const count = configuredPhaseCount(phase, phases, weeksByPhase.get(phase)?.length ?? 0);
      if (count > 0 || phases?.[phase] === 0) {
        return `${count}w ${PHASE_LABEL[phase].toLowerCase()}`;
      }

      return null;
    })
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

function buildPhaseModels(
  weeksByPhase: Map<PhaseName, BlockReviewWeekModel[]>,
): BlockReviewPhaseModel[] {
  return BLOCK_REVIEW_PHASE_ORDER.flatMap((phase) => {
    const phaseWeeks = weeksByPhase.get(phase) ?? [];
    if (phaseWeeks.length === 0) return [];

    const startWeek = phaseWeeks[0];
    const endWeek = phaseWeeks[phaseWeeks.length - 1];
    const peakKm = Math.max(...phaseWeeks.map((week) => week.plannedKm));
    const averageKm = roundKm(
      phaseWeeks.reduce((sum, week) => sum + week.plannedKm, 0) / phaseWeeks.length,
    );

    return [{
      phase,
      weekCount: phaseWeeks.length,
      weekNumbers: phaseWeeks.map((week) => week.weekNumber),
      startWeekNumber: startWeek.weekNumber,
      endWeekNumber: endWeek.weekNumber,
      rangeLabel: formatWeekRange(phaseWeeks.map((week) => week.weekNumber)),
      startKm: startWeek.plannedKm,
      endKm: endWeek.plannedKm,
      peakKm,
      averageKm,
      sessionTypes: startWeek.sessionTypes,
      summary: phaseSummary(phase, startWeek.plannedKm, endWeek.plannedKm),
    }];
  });
}

function buildVolumePoints(
  weeks: BlockReviewWeekModel[],
  stats: BlockReviewVolumeStats,
): BlockReviewVolumePoint[] {
  const minKm = Math.min(...weeks.map((week) => week.plannedKm), stats.maxKm);
  const span = stats.maxKm - minKm;

  return weeks.map((week, index) => {
    const x = weeks.length <= 1 ? 0.5 : index / (weeks.length - 1);
    const y = span <= 0
      ? 0.5
      : 0.14 + ((1 - ((week.plannedKm - minKm) / span)) * 0.72);

    return {
      weekNumber: week.weekNumber,
      phase: week.phase,
      plannedKm: week.plannedKm,
      x: roundRatio(x),
      y: roundRatio(y),
      isStart: week.isStartWeek,
      isPeak: week.isPeakWeek,
      isRace: week.isRaceWeek,
    };
  });
}

function buildKeyWeeks(weeks: BlockReviewWeekModel[]): BlockReviewWeekModel[] {
  const selected = new Map<number, BlockReviewWeekModel>();
  const start = weeks[0];
  const peak = weeks.find((week) => week.isPeakWeek);
  const race = weeks[weeks.length - 1];

  [start, peak, race].forEach((week) => {
    if (week) {
      selected.set(week.weekNumber, week);
    }
  });

  return Array.from(selected.values()).sort((a, b) => a.weekNumber - b.weekNumber);
}

export function buildBlockReviewModel(input: BuildBlockReviewModelInput): BlockReviewModel {
  const sourceWeeks = [...input.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const totalWeeks = sourceWeeks.length;
  const maxKm = Math.max(...sourceWeeks.map(safePlannedKm), 0);
  const peakIndex = sourceWeeks.findIndex((week) => safePlannedKm(week) === maxKm);
  const currentWeekIndex =
    input.currentWeekIndex != null && input.currentWeekIndex >= 0 && input.currentWeekIndex < totalWeeks
      ? input.currentWeekIndex
      : null;

  const weeks = sourceWeeks.map((week, weekIndex) => {
    const plannedKm = safePlannedKm(week);
    const flags = {
      isStartWeek: weekIndex === 0,
      isPeakWeek: weekIndex === peakIndex,
      isRaceWeek: weekIndex === totalWeeks - 1,
    };

    return {
      id: `week-${week.weekNumber}`,
      weekIndex,
      weekNumber: week.weekNumber,
      phase: week.phase,
      plannedKm,
      volumeRatio: maxKm > 0 ? plannedKm / maxKm : 0,
      sessions: week.sessions,
      sessionTypes: getSessionTypes(week),
      title: getWeekTitle(week, flags),
      detail: getWeekDetail(week, plannedKm, flags),
      isStartWeek: flags.isStartWeek,
      isPeakWeek: flags.isPeakWeek,
      isRaceWeek: flags.isRaceWeek,
      isCurrentWeek: weekIndex === currentWeekIndex,
    };
  });

  const weeksByPhase = weeks.reduce((acc, week) => {
    const existing = acc.get(week.phase) ?? [];
    existing.push(week);
    acc.set(week.phase, existing);
    return acc;
  }, new Map<PhaseName, BlockReviewWeekModel[]>());

  const startKm = weeks[0]?.plannedKm ?? 0;
  const raceKm = weeks[weeks.length - 1]?.plannedKm ?? 0;
  const averageKm = totalWeeks > 0
    ? roundKm(weeks.reduce((sum, week) => sum + week.plannedKm, 0) / totalWeeks)
    : 0;
  const peakWeekNumber = weeks.find((week) => week.isPeakWeek)?.weekNumber ?? 0;
  const stats: BlockReviewVolumeStats = {
    totalWeeks,
    startKm,
    peakKm: maxKm,
    peakWeekNumber,
    raceKm,
    averageKm,
    maxKm,
  };
  const progressionPct = input.progressionPct ?? 0;
  const progressionEveryWeeks = normalizeProgressionEveryWeeks(input.progressionEveryWeeks);

  return {
    totalWeeks,
    progressionPct,
    progressionEveryWeeks,
    overload: {
      progressionPct,
      progressionEveryWeeks,
      hasProgression: progressionPct > 0,
      label: formatOverloadLabel(progressionPct, progressionEveryWeeks),
    },
    weeks,
    phases: buildPhaseModels(weeksByPhase),
    phaseSegments: buildPhaseSegments(sourceWeeks, currentWeekIndex),
    volume: {
      points: buildVolumePoints(weeks, stats),
      stats,
    },
    keyWeeks: buildKeyWeeks(weeks),
    structureLabel: buildStructureLabel(weeksByPhase, input.phases),
  };
}
