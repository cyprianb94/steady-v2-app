export const BODY_PARTS = [
  'calf',
  'knee',
  'hamstring',
  'quad',
  'hip',
  'glute',
  'foot',
  'shin',
  'ankle',
  'achilles',
  'back',
  'other',
] as const;

export const NIGGLE_SEVERITIES = ['niggle', 'mild', 'moderate', 'stop'] as const;
export const NIGGLE_WHEN_OPTIONS = ['before', 'during', 'after'] as const;
export const NIGGLE_OTHER_BODY_PART_MAX_LENGTH = 40;

export type BodyPart = typeof BODY_PARTS[number];
export type NiggleSeverity = typeof NIGGLE_SEVERITIES[number];
export type NiggleWhen = typeof NIGGLE_WHEN_OPTIONS[number];
export type NiggleWhenValue = NiggleWhen | readonly NiggleWhen[];
export type NiggleSide = 'left' | 'right' | null;

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  calf: 'Calf',
  knee: 'Knee',
  hamstring: 'Hamstring',
  quad: 'Quad',
  hip: 'Hip',
  glute: 'Glute',
  foot: 'Foot',
  shin: 'Shin',
  ankle: 'Ankle',
  achilles: 'Achilles',
  back: 'Back',
  other: 'Other',
};

export interface Niggle {
  id: string;
  userId: string;
  activityId: string;
  bodyPart: BodyPart;
  bodyPartOtherText?: string | null;
  severity: NiggleSeverity;
  when: NiggleWhen[];
  side: NiggleSide;
  createdAt: string;
}

function titleCase(value: string): string {
  return value
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatNiggleBodyPart(niggle: Pick<Niggle, 'bodyPart' | 'bodyPartOtherText'>): string {
  if (niggle.bodyPart !== 'other') {
    return BODY_PART_LABELS[niggle.bodyPart];
  }

  const customText = niggle.bodyPartOtherText?.trim();
  return customText && customText.length > 0 ? customText : BODY_PART_LABELS.other;
}

export function normalizeNiggleWhen(when: NiggleWhenValue): NiggleWhen[] {
  const selected = new Set(Array.isArray(when) ? when : [when]);
  return NIGGLE_WHEN_OPTIONS.filter((option) => selected.has(option));
}

export function formatNiggleWhen(when: NiggleWhenValue): string {
  return normalizeNiggleWhen(when).map(titleCase).join(', ');
}

export function formatNiggleSummary(
  niggle: Pick<Niggle, 'bodyPart' | 'bodyPartOtherText' | 'severity' | 'side'> & { when: NiggleWhenValue },
): string {
  const side = niggle.side ? `${titleCase(niggle.side)} ` : '';
  return `${side}${formatNiggleBodyPart(niggle)} · ${titleCase(niggle.severity)} · ${formatNiggleWhen(niggle.when)}`;
}
