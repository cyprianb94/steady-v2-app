import type { User } from '@steady/types';
import type { ProfileRepo } from './profile-repo';

export class InMemoryProfileRepo implements ProfileRepo {
  private store = new Map<string, User>();

  async getById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async upsert(profile: User): Promise<User> {
    this.store.set(profile.id, { ...profile });
    return { ...profile };
  }

  async updateSubscription(id: string, tier: 'free' | 'pro', expiresAt?: string): Promise<User | null> {
    const user = this.store.get(id);
    if (!user) return null;
    user.subscriptionTier = tier;
    user.subscriptionExpiresAt = expiresAt;
    return { ...user };
  }
}
