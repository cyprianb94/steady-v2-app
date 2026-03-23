export interface User {
  id: string;
  email: string;
  createdAt: string;

  // Integrations
  stravaAthleteId?: string;
  appleHealthConnected: boolean;
  garminAthleteId?: string;

  // Subscription
  subscriptionTier: 'free' | 'pro';
  subscriptionExpiresAt?: string;

  // Preferences
  timezone: string; // IANA e.g. 'Europe/London'
  units: 'metric' | 'imperial';
}
