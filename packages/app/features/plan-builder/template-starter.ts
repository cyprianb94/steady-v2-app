import type { PlannedSession } from '@steady/types';

export type TemplateStarterMode = 'template' | 'clean';
export type TemplateDay = Partial<PlannedSession> | null;

export const STEADY_TEMPLATE: ReadonlyArray<TemplateDay> = [
  { type: 'EASY', distance: 8, pace: '5:20' },
  {
    type: 'INTERVAL',
    reps: 6,
    repDist: 800,
    pace: '3:50',
    recovery: '90s',
    warmup: { unit: 'km', value: 1.5 },
    cooldown: { unit: 'km', value: 1 },
  },
  { type: 'EASY', distance: 8, pace: '5:30' },
  {
    type: 'TEMPO',
    distance: 10,
    pace: '4:20',
    warmup: { unit: 'km', value: 2 },
    cooldown: { unit: 'km', value: 1.5 },
  },
  null,
  { type: 'EASY', distance: 12, pace: '5:20' },
  { type: 'LONG', distance: 20, pace: '5:10' },
];

export const CLEAN_TEMPLATE: ReadonlyArray<TemplateDay> = Array.from({ length: 7 }, () => null);

function cloneTemplateDay(session: TemplateDay): TemplateDay {
  return session ? { ...session } : null;
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

export function createStarterTemplate(mode: TemplateStarterMode): TemplateDay[] {
  const seed = mode === 'template' ? STEADY_TEMPLATE : CLEAN_TEMPLATE;
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
): boolean {
  return (
    JSON.stringify(resolveTemplateForStepPlan(template)) !==
    JSON.stringify(resolveTemplateForStepPlan(createStarterTemplate(mode)))
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
