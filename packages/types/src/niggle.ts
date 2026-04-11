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

export type BodyPart = typeof BODY_PARTS[number];
export type NiggleSeverity = typeof NIGGLE_SEVERITIES[number];
export type NiggleWhen = typeof NIGGLE_WHEN_OPTIONS[number];
export type NiggleSide = 'left' | 'right' | null;

export interface Niggle {
  id: string;
  userId: string;
  activityId: string;
  bodyPart: BodyPart;
  severity: NiggleSeverity;
  when: NiggleWhen;
  side: NiggleSide;
  createdAt: string;
}
