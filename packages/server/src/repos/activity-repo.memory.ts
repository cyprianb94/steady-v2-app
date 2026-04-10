import type { Activity, SubjectiveInput } from '@steady/types';
import type { ActivityRepo } from './activity-repo';

export class InMemoryActivityRepo implements ActivityRepo {
  private store = new Map<string, Activity>();

  async getByUserId(userId: string): Promise<Activity[]> {
    const results: Activity[] = [];
    for (const activity of this.store.values()) {
      if (activity.userId === userId) results.push({ ...activity });
    }
    return results;
  }

  async save(activity: Activity): Promise<Activity> {
    this.store.set(activity.id, { ...activity });
    return { ...activity };
  }

  async getByExternalId(userId: string, source: string, externalId: string): Promise<Activity | null> {
    for (const activity of this.store.values()) {
      if (activity.userId === userId && activity.source === source && activity.externalId === externalId) {
        return { ...activity };
      }
    }
    return null;
  }

  async updateSubjectiveInput(activityId: string, input: SubjectiveInput): Promise<Activity | null> {
    const activity = this.store.get(activityId);
    if (!activity) return null;
    activity.subjectiveInput = input;
    return { ...activity };
  }

  async updateMatchedSession(activityId: string, sessionId: string | null): Promise<Activity | null> {
    const activity = this.store.get(activityId);
    if (!activity) return null;
    activity.matchedSessionId = sessionId ?? undefined;
    return { ...activity };
  }
}
