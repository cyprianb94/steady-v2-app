import type { User } from '@steady/types';

export interface ProfileRepo {
  getById(id: string): Promise<User | null>;
  upsert(profile: User): Promise<User>;
  updateSubscription(id: string, tier: 'free' | 'pro', expiresAt?: string): Promise<User | null>;
}
