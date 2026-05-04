import {
  defaultIntensityTargetForSessionType,
  normalizeIntensityTarget,
  normalizeRunStructure,
  resolveSessionFormat,
  sessionSupportsFormat,
  structuredSessionVolume,
  type IntensityTarget,
  type PlannedSession,
  type RunStructure,
  type RunStructureItem,
  type RunStructureSegment,
  type RunStructureSegmentKind,
  type RunStructureVolume,
  type SessionFormat,
  type SessionDurationSpec,
  type SessionType,
  type TrainingPaceProfile,
} from '@steady/types';
import { intensityTargetForTrainingPaceProfileKey } from './session-editing';

export type StructuredSessionTemplateKey =
  | 'custom'
  | 'fast-finish'
  | 'progression'
  | 'race-pace-blocks'
  | 'cruise-intervals'
  | 'short-reps'
  | 'strides'
  | 'fartlek-ladder';

export interface StructuredSessionTemplateOption {
  key: StructuredSessionTemplateKey;
  label: string;
  caption: string;
  roles: Exclude<SessionType, 'RECOVERY' | 'REST'>[];
}

interface StructureTemplate extends StructuredSessionTemplateOption {
  build: (session: Partial<PlannedSession>) => Partial<PlannedSession>;
}

type StructuredFormatSessionType = Exclude<SessionType, 'RECOVERY' | 'REST'>;

export interface StructuredSessionDraft {
  session: Partial<PlannedSession>;
  items: RunStructureItem[];
  selectedTemplate: StructuredSessionTemplateKey;
}

export interface ApplyStructuredSessionTemplateInput {
  templateKey: StructuredSessionTemplateKey;
  session: Partial<PlannedSession>;
  trainingPaceProfile?: TrainingPaceProfile | null;
}

export interface ApplyStructuredSessionTemplateResult {
  session: Partial<PlannedSession>;
  items: RunStructureItem[];
  selectedTemplate: StructuredSessionTemplateKey;
}

export interface StructuredSessionDraftInput {
  session: Partial<PlannedSession>;
  items: RunStructureItem[];
  planNote: string;
}

export interface PreviewStructuredSessionTypeChangeInput extends StructuredSessionDraftInput {
  nextType: SessionType;
  selectedTemplate?: StructuredSessionTemplateKey;
  preservedStructuredDraft?: StructuredSessionDraft | null;
}

export interface PreviewStructuredSessionTypeChangeResult {
  format: SessionFormat;
  session: Partial<PlannedSession>;
  items: RunStructureItem[];
  selectedTemplate: StructuredSessionTemplateKey;
  preservedStructuredDraft: StructuredSessionDraft | null;
  clearRunStructureOnSave: boolean;
}

export function sessionTypeSupportsStructuredFormat(
  type: SessionType | null | undefined,
): type is StructuredFormatSessionType {
  return type ? sessionSupportsFormat(type, 'structured') : false;
}

function target(
  profileKey: IntensityTarget['profileKey'],
  effortCue: IntensityTarget['effortCue'],
): IntensityTarget {
  return {
    source: 'manual',
    mode: 'effort',
    profileKey,
    effortCue,
  };
}

const EASY_TARGET = target('easy', 'conversational');
const STEADY_TARGET = target('steady', 'steady');
const MARATHON_TARGET = target('marathon', 'race pace');
const THRESHOLD_TARGET = target('threshold', 'controlled hard');
const INTERVAL_TARGET = target('interval', 'hard repeatable');

function plannedVolumeFor(session: Partial<PlannedSession>): SessionDurationSpec | undefined {
  if (session.plannedVolume?.unit === 'km' || session.plannedVolume?.unit === 'min') {
    return session.plannedVolume;
  }
  if (session.distance != null && session.distance > 0) {
    return { unit: 'km', value: session.distance };
  }
  return undefined;
}

function topLevelKm(session: Partial<PlannedSession>, fallback: number): number {
  if (session.plannedVolume?.unit === 'km') return session.plannedVolume.value;
  if (session.distance != null && session.distance > 0) return session.distance;
  return fallback;
}

function topLevelMinutes(session: Partial<PlannedSession>, fallback: number): number {
  if (session.plannedVolume?.unit === 'min') return session.plannedVolume.value;
  return fallback;
}

function progressionPart(value: number): number {
  return Math.max(1, Math.round(value));
}

function splitProgression(total: number, parts: 2 | 3): number[] {
  if (parts === 2) {
    const finish = progressionPart(total * 0.3);
    return [Math.max(1, total - finish), finish];
  }

  const easy = progressionPart(total * 0.5);
  const finish = progressionPart(total * 0.2);
  return [easy, Math.max(1, total - easy - finish), finish];
}

export function runStructureSegment(
  kind: RunStructureSegmentKind,
  volume: RunStructureVolume,
  intensityTarget?: IntensityTarget,
  extras: Partial<RunStructureSegment> = {},
): RunStructureSegment {
  return {
    kind,
    volume,
    ...(intensityTarget ? { intensityTarget } : null),
    ...extras,
  };
}

export function runStructureRepeat(
  repeats: number,
  segments: RunStructureSegment[],
): RunStructureItem {
  return {
    kind: 'REPEAT',
    repeats,
    segments,
  };
}

function simpleIntervalStructure(session: Partial<PlannedSession>): RunStructureItem[] {
  const repVolume: RunStructureVolume = session.repDuration
    ? { unit: session.repDuration.unit, value: session.repDuration.value }
    : { unit: 'km', value: (session.repDist ?? 800) / 1000 };
  const recoveryVolume: RunStructureVolume = typeof session.recovery === 'object' && session.recovery
    ? { unit: session.recovery.unit, value: session.recovery.value }
    : { unit: 'min', value: 1.5 };

  return [
    runStructureRepeat(session.reps ?? 6, [
      runStructureSegment('RUN', repVolume, session.intensityTarget ?? INTERVAL_TARGET),
      runStructureSegment('RECOVERY', recoveryVolume, EASY_TARGET),
    ]),
  ];
}

function customStructuredSession(session: Partial<PlannedSession>): Partial<PlannedSession> {
  const type = session.type ?? 'EASY';
  if (!sessionTypeSupportsStructuredFormat(type)) {
    return buildSimpleSessionForUnsupportedStructuredFormat({
      session: { ...session, type },
      planNote: session.planNote ?? '',
    });
  }

  const existing = normalizeRunStructure(session.runStructure);
  if (existing) {
    return {
      ...session,
      format: 'structured',
      runStructure: existing,
    };
  }

  if (type === 'INTERVAL') {
    return {
      ...session,
      format: 'structured',
      runStructure: { items: simpleIntervalStructure(session) },
    };
  }

  const planned = plannedVolumeFor(session);
  const volume: RunStructureVolume = planned
    ? { unit: planned.unit, value: planned.value }
    : { unit: 'km', value: 8 };

  return {
    ...session,
    format: 'structured',
    plannedVolume: planned ?? session.plannedVolume,
    runStructure: {
      items: [
        runStructureSegment('RUN', volume, session.intensityTarget ?? defaultIntensityTargetForSessionType(type)),
      ],
    },
  };
}

const STRUCTURED_SESSION_TEMPLATES: StructureTemplate[] = [
  {
    key: 'fast-finish',
    label: 'Fast finish',
    caption: 'Easy running, then a controlled finish.',
    roles: ['EASY', 'TEMPO', 'LONG'],
    build: (session) => {
      const totalKm = topLevelKm(session, session.type === 'LONG' ? 18 : 10);
      const finishKm = Math.min(5, Math.max(2, Math.round(totalKm * 0.25)));
      return {
        ...session,
        plannedVolume: { unit: 'km', value: totalKm },
        distance: totalKm,
        runStructure: {
          items: [
            runStructureSegment('RUN', { unit: 'km', value: Math.max(1, totalKm - finishKm) }, EASY_TARGET),
            runStructureSegment('RUN', { unit: 'km', value: finishKm }, MARATHON_TARGET),
          ],
        },
      };
    },
  },
  {
    key: 'progression',
    label: 'Progression',
    caption: 'One continuous run split into clear effort steps.',
    roles: ['EASY', 'TEMPO', 'LONG'],
    build: (session) => {
      const planned = plannedVolumeFor(session) ?? { unit: 'min', value: topLevelMinutes(session, 60) };
      const unit = planned.unit;
      const total = planned.value;
      const isEasy = session.type === 'EASY';
      const values = splitProgression(total, isEasy ? 2 : 3);
      const finishTarget = session.type === 'TEMPO' ? THRESHOLD_TARGET : MARATHON_TARGET;

      return {
        ...session,
        plannedVolume: { unit, value: total },
        distance: unit === 'km' ? total : undefined,
        runStructure: {
          items: isEasy
            ? [
                runStructureSegment('RUN', { unit, value: values[0] }, EASY_TARGET),
                runStructureSegment('RUN', { unit, value: values[1] }, STEADY_TARGET),
              ]
            : [
                runStructureSegment('RUN', { unit, value: values[0] }, EASY_TARGET),
                runStructureSegment('RUN', { unit, value: values[1] }, STEADY_TARGET),
                runStructureSegment('RUN', { unit, value: values[2] }, finishTarget),
              ],
        },
      };
    },
  },
  {
    key: 'race-pace-blocks',
    label: 'Race-pace blocks',
    caption: 'Marathon-pace work with float recoveries.',
    roles: ['LONG'],
    build: (session) => {
      const totalKm = topLevelKm(session, 26);
      const warmupKm = Math.min(5, Math.max(1, Math.round(totalKm * 0.2)));
      const repeatedKm = 12;
      const finishKm = Math.max(1, totalKm - warmupKm - repeatedKm);
      return {
        ...session,
        plannedVolume: { unit: 'km', value: totalKm },
        distance: totalKm,
        runStructure: {
          items: [
            runStructureSegment('WARMUP', { unit: 'km', value: warmupKm }, EASY_TARGET),
            runStructureRepeat(3, [
              runStructureSegment('RUN', { unit: 'km', value: 3 }, MARATHON_TARGET),
              runStructureSegment('FLOAT', { unit: 'km', value: 1 }, EASY_TARGET),
            ]),
            runStructureSegment('RUN', { unit: 'km', value: finishKm }, EASY_TARGET),
          ],
        },
      };
    },
  },
  {
    key: 'cruise-intervals',
    label: 'Cruise intervals',
    caption: 'Threshold blocks with jog recoveries.',
    roles: ['TEMPO', 'INTERVAL'],
    build: (session) => ({
      ...session,
      runStructure: {
        items: [
          runStructureRepeat(3, [
            runStructureSegment('RUN', { unit: 'min', value: 10 }, THRESHOLD_TARGET),
            runStructureSegment('RECOVERY', { unit: 'min', value: 2 }, EASY_TARGET),
          ]),
        ],
      },
    }),
  },
  {
    key: 'short-reps',
    label: 'Short reps',
    caption: 'Short controlled repetitions with easy recoveries.',
    roles: ['INTERVAL'],
    build: (session) => ({
      ...session,
      runStructure: {
        items: [
          runStructureRepeat(10, [
            runStructureSegment('RUN', { unit: 'sec', value: 30 }, INTERVAL_TARGET),
            runStructureSegment('RECOVERY', { unit: 'sec', value: 60 }, EASY_TARGET),
          ]),
        ],
      },
    }),
  },
  {
    key: 'strides',
    label: 'Strides',
    caption: 'Keep the parent run easy; add short relaxed strides.',
    roles: ['EASY'],
    build: (session) => {
      const totalKm = topLevelKm(session, 8);
      return {
        ...session,
        plannedVolume: { unit: 'km', value: totalKm },
        distance: totalKm,
        runStructure: {
          items: [
            runStructureSegment('RUN', { unit: 'km', value: totalKm }, EASY_TARGET),
            runStructureRepeat(6, [
              runStructureSegment('STRIDE', { unit: 'sec', value: 20 }, INTERVAL_TARGET),
            ]),
          ],
        },
      };
    },
  },
  {
    key: 'fartlek-ladder',
    label: 'Fartlek ladder',
    caption: 'Multiple repeat groups with different durations.',
    roles: ['INTERVAL'],
    build: (session) => ({
      ...session,
      runStructure: {
        items: [
          runStructureRepeat(4, [
            runStructureSegment('RUN', { unit: 'sec', value: 90 }, INTERVAL_TARGET),
            runStructureSegment('RECOVERY', { unit: 'sec', value: 90 }, EASY_TARGET),
          ]),
          runStructureRepeat(4, [
            runStructureSegment('RUN', { unit: 'min', value: 1 }, INTERVAL_TARGET),
            runStructureSegment('RECOVERY', { unit: 'min', value: 1 }, EASY_TARGET),
          ]),
          runStructureRepeat(4, [
            runStructureSegment('RUN', { unit: 'sec', value: 30 }, INTERVAL_TARGET),
            runStructureSegment('RECOVERY', { unit: 'sec', value: 30 }, EASY_TARGET),
          ]),
        ],
      },
    }),
  },
  {
    key: 'custom',
    label: 'Custom',
    caption: 'Start from the current session and adjust parts.',
    roles: ['EASY', 'INTERVAL', 'TEMPO', 'LONG'],
    build: customStructuredSession,
  },
];

function getTemplate(key: StructuredSessionTemplateKey): StructureTemplate {
  return STRUCTURED_SESSION_TEMPLATES.find((template) => template.key === key)
    ?? STRUCTURED_SESSION_TEMPLATES[STRUCTURED_SESSION_TEMPLATES.length - 1];
}

export function getStructuredSessionTemplatesForType(
  type: SessionType,
): StructuredSessionTemplateOption[] {
  if (!sessionTypeSupportsStructuredFormat(type)) {
    return [];
  }

  return STRUCTURED_SESSION_TEMPLATES
    .filter((template) => template.roles.includes(type))
    .map(({ build: _build, ...option }) => option);
}

function initialStructuredSessionTemplateKey(
  _session: Partial<PlannedSession>,
): StructuredSessionTemplateKey {
  return 'custom';
}

export function cloneRunStructureItems(items: RunStructureItem[]): RunStructureItem[] {
  return items.map((item) => (
    item.kind === 'REPEAT'
      ? {
          ...item,
          segments: item.segments.map((child) => ({
            ...child,
            volume: { ...child.volume },
            intensityTarget: child.intensityTarget ? { ...child.intensityTarget } : undefined,
            progression: child.progression
              ? {
                  from: child.progression.from ? { ...child.progression.from } : undefined,
                  to: child.progression.to ? { ...child.progression.to } : undefined,
                }
              : undefined,
          })),
        }
      : {
          ...item,
          volume: { ...item.volume },
          intensityTarget: item.intensityTarget ? { ...item.intensityTarget } : undefined,
          progression: item.progression
            ? {
                from: item.progression.from ? { ...item.progression.from } : undefined,
                to: item.progression.to ? { ...item.progression.to } : undefined,
              }
            : undefined,
        }
  ));
}

function hydrateProfileTarget(
  targetValue: IntensityTarget | undefined,
  profile: TrainingPaceProfile | null | undefined,
): IntensityTarget | undefined {
  const target = normalizeIntensityTarget(targetValue);
  if (!profile || !target?.profileKey || target.pace || target.paceRange) {
    return target;
  }

  return intensityTargetForTrainingPaceProfileKey(profile, target.profileKey) ?? target;
}

function hydrateProfileTargetsInSegment(
  segmentValue: RunStructureSegment,
  profile: TrainingPaceProfile | null | undefined,
): RunStructureSegment {
  return {
    ...segmentValue,
    intensityTarget: hydrateProfileTarget(segmentValue.intensityTarget, profile),
    progression: segmentValue.progression
      ? {
          from: hydrateProfileTarget(segmentValue.progression.from, profile),
          to: hydrateProfileTarget(segmentValue.progression.to, profile),
        }
      : undefined,
  };
}

function hydrateProfileTargetsInItems(
  items: RunStructureItem[],
  profile: TrainingPaceProfile | null | undefined,
): RunStructureItem[] {
  return items.map((item) => (
    item.kind === 'REPEAT'
      ? {
          ...item,
          segments: item.segments.map((child) => hydrateProfileTargetsInSegment(child, profile)),
        }
      : hydrateProfileTargetsInSegment(item, profile)
  ));
}

export function createStructuredSessionDraft(
  session: Partial<PlannedSession>,
): StructuredSessionDraft {
  if (!sessionTypeSupportsStructuredFormat(session.type ?? 'EASY')) {
    const simpleSession = buildSimpleSessionForUnsupportedStructuredFormat({
      session,
      planNote: session.planNote ?? '',
    });

    return {
      session: simpleSession,
      items: [],
      selectedTemplate: 'custom',
    };
  }

  const draftSession = customStructuredSession(session);
  const normalized = normalizeRunStructure(draftSession.runStructure);

  return {
    session: draftSession,
    items: cloneRunStructureItems(normalized?.items ?? []),
    selectedTemplate: initialStructuredSessionTemplateKey(session),
  };
}

export function applyStructuredSessionTemplate({
  templateKey,
  session,
  trainingPaceProfile,
}: ApplyStructuredSessionTemplateInput): ApplyStructuredSessionTemplateResult {
  const type = session.type ?? 'EASY';
  if (!sessionTypeSupportsStructuredFormat(type)) {
    return {
      selectedTemplate: 'custom',
      session: buildSimpleSessionForUnsupportedStructuredFormat({
        session: { ...session, type },
        planNote: session.planNote ?? '',
      }),
      items: [],
    };
  }

  const template = getTemplate(templateKey);
  const next = template.build(session);
  const nextStructure = normalizeRunStructure(next.runStructure);
  const nextItems = hydrateProfileTargetsInItems(nextStructure?.items ?? [], trainingPaceProfile);

  return {
    selectedTemplate: template.key,
    session: {
      ...next,
      runStructure: nextStructure ? { items: nextItems } : next.runStructure,
    },
    items: cloneRunStructureItems(nextItems),
  };
}

function roundKm(value: number): number {
  return Math.round(value * 10) / 10;
}

function structuredKm(volume: ReturnType<typeof structuredSessionVolume>): number {
  return roundKm(volume.structuredExactKm + volume.structuredEstimatedKm);
}

function cleanedPlanNote(planNote: string): string | undefined {
  const trimmed = planNote.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function simpleRecoverySession(
  session: Partial<PlannedSession>,
  planNote: string,
): Partial<PlannedSession> {
  return {
    id: session.id,
    date: session.date,
    type: 'RECOVERY',
    format: 'simple',
    plannedVolume: session.plannedVolume?.unit === 'min'
      ? { unit: 'min', value: session.plannedVolume.value }
      : { unit: 'min', value: 35 },
    intensityTarget: normalizeIntensityTarget(session.intensityTarget)
      ?? defaultIntensityTargetForSessionType('RECOVERY'),
    planNote: cleanedPlanNote(planNote),
  };
}

function simpleRestSession(
  session: Partial<PlannedSession>,
  planNote: string,
): Partial<PlannedSession> {
  return {
    id: session.id,
    date: session.date,
    type: 'REST',
    format: 'simple',
    planNote: cleanedPlanNote(planNote),
  };
}

export function buildSimpleSessionForUnsupportedStructuredFormat({
  session,
  planNote,
}: {
  session: Partial<PlannedSession>;
  planNote: string;
}): Partial<PlannedSession> {
  return session.type === 'REST'
    ? simpleRestSession(session, planNote)
    : simpleRecoverySession({ ...session, type: 'RECOVERY' }, planNote);
}

export function structuredSessionMismatchWarning(session: PlannedSession): string | null {
  const normalized = normalizeRunStructure(session.runStructure);
  if (!normalized) return null;

  const volume = structuredSessionVolume(session);
  const planned = plannedVolumeFor(session);
  const structureKm = structuredKm(volume);
  if (planned?.unit === 'km' && structureKm > 0) {
    const delta = Math.abs(planned.value - structureKm);
    return delta > 0.2
      ? `Structure adds up to ${structureKm}km. Saving will update this session from ${planned.value}km.`
      : null;
  }

  if (planned?.unit === 'min' && volume.structuredSeconds > 0) {
    const structuredMinutes = Math.round(volume.structuredSeconds / 60);
    const delta = Math.abs(planned.value - structuredMinutes);
    return delta > 2
      ? `Structure totals ${structuredMinutes}min inside a ${planned.value}min session. Save is still allowed.`
      : null;
  }

  return null;
}

export function materializeStructuredSessionDraft({
  session,
  items,
  planNote,
}: StructuredSessionDraftInput): PlannedSession {
  const normalized = normalizeRunStructure({ items });
  const type = session.type ?? 'EASY';
  if (!sessionTypeSupportsStructuredFormat(type)) {
    return {
      ...buildSimpleSessionForUnsupportedStructuredFormat({
        session: {
          ...session,
          id: session.id ?? 'run-structure-draft',
          date: session.date ?? 'draft',
          type,
        },
        planNote,
      }),
      id: session.id ?? 'run-structure-draft',
      date: session.date ?? 'draft',
    } as PlannedSession;
  }

  return {
    ...session,
    id: session.id ?? 'run-structure-draft',
    date: session.date ?? 'draft',
    type,
    format: 'structured',
    intensityTarget: session.intensityTarget ?? defaultIntensityTargetForSessionType(type),
    planNote: planNote.trim() || undefined,
    runStructure: normalized ?? { items },
  } as PlannedSession;
}

function syncParentVolumeToStructure(
  session: Partial<PlannedSession>,
  runStructure: RunStructure,
): Partial<PlannedSession> {
  const materialized = materializeStructuredSessionDraft({
    session,
    items: runStructure.items,
    planNote: session.planNote ?? '',
  });
  const volume = structuredSessionVolume({
    ...materialized,
    runStructure,
  });
  const structureKm = structuredKm(volume);
  const next: Partial<PlannedSession> = { ...session, format: 'structured' };

  if (structureKm > 0) {
    next.plannedVolume = { unit: 'km', value: structureKm };
    if (next.type !== 'INTERVAL') {
      next.distance = structureKm;
    } else {
      delete next.distance;
    }
    return next;
  }

  if (volume.structuredSeconds > 0) {
    next.plannedVolume = {
      unit: 'min',
      value: Math.round((volume.structuredSeconds / 60) * 10) / 10,
    };
    delete next.distance;
  }

  return next;
}

export function buildStructuredSessionSave({
  session,
  items,
  planNote,
}: StructuredSessionDraftInput): Partial<PlannedSession> | null {
  if (!sessionTypeSupportsStructuredFormat(session.type ?? 'EASY')) {
    return buildSimpleSessionForUnsupportedStructuredFormat({ session, planNote });
  }

  const normalizedStructure = normalizeRunStructure({ items });
  if (!normalizedStructure) {
    return null;
  }

  return syncParentVolumeToStructure({
    ...session,
    type: session.type ?? 'EASY',
    format: 'structured',
    planNote: planNote.trim() || undefined,
    runStructure: normalizedStructure,
  }, normalizedStructure);
}

export function convertStructuredSessionDraftToSimple({
  session,
  items,
  planNote,
}: StructuredSessionDraftInput): Partial<PlannedSession> {
  const type = session.type ?? 'EASY';
  if (!sessionTypeSupportsStructuredFormat(type)) {
    return buildSimpleSessionForUnsupportedStructuredFormat({
      session: { ...session, type },
      planNote,
    });
  }

  const materialized = materializeStructuredSessionDraft({ session, items, planNote });
  const volume = structuredSessionVolume(materialized);
  const structureKm = structuredKm(volume);
  const fallbackKm = session.plannedVolume?.unit === 'km'
    ? session.plannedVolume.value
    : session.distance;
  const simple: Partial<PlannedSession> = {
    ...session,
    type,
    format: 'simple',
    planNote: planNote.trim() || undefined,
  };
  delete simple.runStructure;
  delete simple.plannedVolume;

  if (type === 'INTERVAL') {
    return simple;
  }

  delete simple.reps;
  delete simple.repDist;
  delete simple.repDuration;
  delete simple.recovery;
  delete simple.warmup;
  delete simple.cooldown;

  const distance = structureKm > 0 ? structureKm : fallbackKm;
  if (distance != null && distance > 0) {
    simple.distance = distance;
  }

  return simple;
}

function structuredDraftFromInput({
  session,
  items,
  selectedTemplate = 'custom',
}: Pick<PreviewStructuredSessionTypeChangeInput, 'session' | 'items' | 'selectedTemplate'>): StructuredSessionDraft {
  return {
    session: {
      ...session,
      format: 'structured',
    },
    items: cloneRunStructureItems(items),
    selectedTemplate,
  };
}

export function previewStructuredSessionTypeChange({
  session,
  items,
  planNote,
  nextType,
  selectedTemplate = 'custom',
  preservedStructuredDraft = null,
}: PreviewStructuredSessionTypeChangeInput): PreviewStructuredSessionTypeChangeResult {
  const currentType = session.type ?? 'EASY';
  const currentDraft = structuredDraftFromInput({ session, items, selectedTemplate });

  if (!sessionTypeSupportsStructuredFormat(nextType)) {
    return {
      format: 'simple',
      session: buildSimpleSessionForUnsupportedStructuredFormat({
        session: { ...session, type: nextType },
        planNote,
      }),
      items: cloneRunStructureItems(items),
      selectedTemplate,
      preservedStructuredDraft: preservedStructuredDraft
        ?? (sessionTypeSupportsStructuredFormat(currentType) ? currentDraft : null),
      clearRunStructureOnSave: true,
    };
  }

  const restored = preservedStructuredDraft?.session.type === nextType
    ? preservedStructuredDraft
    : null;
  if (restored) {
    const restoredStructure = normalizeRunStructure({ items: restored.items });
    return {
      format: resolveSessionFormat({
        type: nextType,
        format: restored.session.format,
        runStructure: restoredStructure,
      } as PlannedSession),
      session: restored.session,
      items: cloneRunStructureItems(restored.items),
      selectedTemplate: restored.selectedTemplate,
      preservedStructuredDraft: null,
      clearRunStructureOnSave: false,
    };
  }

  return {
    format: 'structured',
    session: {
      ...session,
      type: nextType,
      format: 'structured',
      intensityTarget: session.intensityTarget ?? defaultIntensityTargetForSessionType(nextType),
    },
    items: cloneRunStructureItems(items),
    selectedTemplate,
    preservedStructuredDraft: null,
    clearRunStructureOnSave: false,
  };
}
