import type { Niggle, BodyPart, NiggleSeverity, NiggleWhenValue, NiggleSide } from '@steady/types';

export interface NiggleInput {
  bodyPart: BodyPart;
  bodyPartOtherText?: string | null;
  severity: NiggleSeverity;
  when: NiggleWhenValue;
  side: NiggleSide;
}

export interface NiggleRepo {
  setForActivity(activityId: string, niggles: NiggleInput[]): Promise<Niggle[]>;
  listByActivity(activityId: string): Promise<Niggle[]>;
}
