export interface IntegrationToken {
  id: string;
  userId: string;
  provider: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  expiresAt: string;
  externalAthleteId?: string;
  lastSyncedAt?: string;
  createdAt: string;
}
