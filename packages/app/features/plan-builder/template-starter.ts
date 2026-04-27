import type { PlannedSession } from '@steady/types';

export type TemplateStarterMode = 'template' | 'clean';
export type TemplateRunCount = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type TemplateDay = Partial<PlannedSession> | null;

export const TEMPLATE_RUN_COUNTS: readonly TemplateRunCount[] = [1, 2, 3, 4, 5, 6, 7];
export const DEFAULT_TEMPLATE_RUN_COUNT: TemplateRunCount = 6;

export interface TemplateStarterSelection {
  mode: TemplateStarterMode;
  runCount: TemplateRunCount;
}

const EASY_6: TemplateDay = { type: 'EASY', distance: 6, pace: '5:30' };
const EASY_8: TemplateDay = { type: 'EASY', distance: 8, pace: '5:25' };
const EASY_10: TemplateDay = { type: 'EASY', distance: 10, pace: '5:20' };
const RECOVERY_5: TemplateDay = { type: 'EASY', distance: 5, pace: '5:45' };
const LONG_10: TemplateDay = { type: 'LONG', distance: 10, pace: '5:20' };
const LONG_12: TemplateDay = { type: 'LONG', distance: 12, pace: '5:15' };
const LONG_14: TemplateDay = { type: 'LONG', distance: 14, pace: '5:15' };
const LONG_16: TemplateDay = { type: 'LONG', distance: 16, pace: '5:10' };
const LONG_18: TemplateDay = { type: 'LONG', distance: 18, pace: '5:10' };
const LONG_20: TemplateDay = { type: 'LONG', distance: 20, pace: '5:10' };
const INTERVAL_6X800: TemplateDay = {
  type: 'INTERVAL',
  reps: 6,
  repDist: 800,
  pace: '3:50',
  recovery: '90s',
  warmup: { unit: 'km', value: 1.5 },
  cooldown: { unit: 'km', value: 1 },
};
const TEMPO_8: TemplateDay = {
  type: 'TEMPO',
  distance: 8,
  pace: '4:25',
  warmup: { unit: 'km', value: 1.5 },
  cooldown: { unit: 'km', value: 1 },
};
const TEMPO_10: TemplateDay = {
  type: 'TEMPO',
  distance: 10,
  pace: '4:20',
  warmup: { unit: 'km', value: 2 },
  cooldown: { unit: 'km', value: 1.5 },
};

export const STEADY_TEMPLATE: ReadonlyArray<TemplateDay> = [
  { type: 'EASY', distance: 8, pace: '5:20' },
  INTERVAL_6X800,
  { type: 'EASY', distance: 8, pace: '5:30' },
  TEMPO_10,
  null,
  { type: 'EASY', distance: 12, pace: '5:20' },
  LONG_20,
];

export const CLEAN_TEMPLATE: ReadonlyArray<TemplateDay> = Array.from({ length: 7 }, () => null);

function cloneTemplateDay(session: TemplateDay): TemplateDay {
  return session ? JSON.parse(JSON.stringify(session)) : null;
}

function stripTemplateDay(session: TemplateDay): TemplateDay {
  if (!session || session.type === 'REST') return null;

  const {
    id: _id,
    date: _date,
    actualActivityId: _actualActivityId,
    subjectiveInput: _subjectiveInput,
    subjectiveInputDismissed: _subjectiveInputDismissed,
    ...templateSession
  } = session;

  return templateSession;
}

export function coerceTemplateRunCount(value: unknown): TemplateRunCount {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return TEMPLATE_RUN_COUNTS.includes(parsed as TemplateRunCount)
    ? (parsed as TemplateRunCount)
    : DEFAULT_TEMPLATE_RUN_COUNT;
}

export function createRunCountTemplate(runCount: TemplateRunCount): TemplateDay[] {
  switch (runCount) {
    case 1:
      return [null, null, null, null, null, null, LONG_10].map(cloneTemplateDay);
    case 2:
      return [null, EASY_6, null, null, null, null, LONG_12].map(cloneTemplateDay);
    case 3:
      return [null, EASY_6, null, TEMPO_8, null, null, LONG_14].map(cloneTemplateDay);
    case 4:
      return [EASY_6, INTERVAL_6X800, null, EASY_8, null, null, LONG_16].map(cloneTemplateDay);
    case 5:
      return [EASY_6, INTERVAL_6X800, null, TEMPO_8, null, EASY_10, LONG_18].map(cloneTemplateDay);
    case 7:
      return [
        STEADY_TEMPLATE[0],
        STEADY_TEMPLATE[1],
        STEADY_TEMPLATE[2],
        STEADY_TEMPLATE[3],
        RECOVERY_5,
        STEADY_TEMPLATE[5],
        STEADY_TEMPLATE[6],
      ].map(cloneTemplateDay);
    case 6:
    default:
      return STEADY_TEMPLATE.map(cloneTemplateDay);
  }
}

export function createStarterTemplate(
  mode: TemplateStarterMode,
  runCount: TemplateRunCount = DEFAULT_TEMPLATE_RUN_COUNT,
): TemplateDay[] {
  const seed = mode === 'template' ? createRunCountTemplate(runCount) : CLEAN_TEMPLATE;
  return seed.map(cloneTemplateDay);
}

export function resolveTemplateForStepPlan(template: TemplateDay[]): TemplateDay[] {
  return template.map(stripTemplateDay);
}

export function countScheduledSessions(template: TemplateDay[]): number {
  return template.filter((session) => session && session.type !== 'REST').length;
}

export function canGenerateTemplate(template: TemplateDay[]): boolean {
  return countScheduledSessions(template) > 0;
}

export function canRearrangeTemplate(template: TemplateDay[]): boolean {
  return countScheduledSessions(template) > 1;
}

export function hasStarterTemplateEdits(
  template: TemplateDay[],
  mode: TemplateStarterMode,
  runCount: TemplateRunCount = DEFAULT_TEMPLATE_RUN_COUNT,
): boolean {
  return (
    JSON.stringify(resolveTemplateForStepPlan(template)) !==
    JSON.stringify(resolveTemplateForStepPlan(createStarterTemplate(mode, runCount)))
  );
}

export function toRearrangeSessions(template: TemplateDay[]): (PlannedSession | null)[] {
  return resolveTemplateForStepPlan(template).map((session, index) => {
    if (!session) return null;

    return {
      id: `template-${index}`,
      date: 'template',
      type: session.type ?? 'EASY',
      ...session,
    } as PlannedSession;
  });
}

export function toTemplateSessions(sessions: (PlannedSession | null)[]): TemplateDay[] {
  return sessions.map(stripTemplateDay);
}
