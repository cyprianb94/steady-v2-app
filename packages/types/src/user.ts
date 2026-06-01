export type WeeklyVolumeMetric = 'time' | 'distance';
export type PrimaryRunSource = 'apple_watch' | 'garmin' | 'strava';

export interface User {
  id: string;
  email: string;
  createdAt: string;

  // Integrations
  stravaAthleteId?: string;
  appleHealthConnected: boolean;
  garminAthleteId?: string;
  primaryRunSource?: PrimaryRunSource;

  // Subscription
  subscriptionTier: 'free' | 'pro';
  subscriptionExpiresAt?: string;

  // Preferences
  timezone: string; // IANA e.g. 'Europe/London'
  units: 'metric' | 'imperial';
  weeklyVolumeMetric: WeeklyVolumeMetric;
}
