import type { Activity, SubjectiveInput } from '@steady/types';

export interface ActivityRepo {
  getByUserId(userId: string): Promise<Activity[]>;
  getById(activityId: string): Promise<Activity | null>;
  save(activity: Activity): Promise<Activity>;
  delete(activityId: string): Promise<void>;
  getByExternalId(userId: string, source: string, externalId: string): Promise<Activity | null>;
  updateSubjectiveInput(activityId: string, input: SubjectiveInput): Promise<Activity | null>;
  updateMatchedSession(activityId: string, sessionId: string | null): Promise<Activity | null>;
}
