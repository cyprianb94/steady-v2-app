import type { PrimaryRunSource, User } from '@steady/types';

export interface ProfileRepo {
  getById(id: string): Promise<User | null>;
  upsert(profile: User): Promise<User>;
  updateRunSourceSettings(
    id: string,
    settings: { appleHealthConnected?: boolean; primaryRunSource?: PrimaryRunSource | null },
  ): Promise<User | null>;
  updateSubscription(id: string, tier: 'free' | 'pro', expiresAt?: string): Promise<User | null>;
}
