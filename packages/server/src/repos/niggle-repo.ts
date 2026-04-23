import type { Niggle, BodyPart, NiggleSeverity, NiggleWhen, NiggleSide } from '@steady/types';

export interface NiggleInput {
  bodyPart: BodyPart;
  bodyPartOtherText?: string | null;
  severity: NiggleSeverity;
  when: NiggleWhen;
  side: NiggleSide;
}

export interface NiggleRepo {
  setForActivity(activityId: string, niggles: NiggleInput[]): Promise<Niggle[]>;
  listByActivity(activityId: string): Promise<Niggle[]>;
}
