export interface ActivitySplit {
  km: number; // 1-indexed
  pace: number; // seconds per km
  hr?: number; // bpm at end of split
  elevation?: number; // m gain in this km
}

export interface Activity {
  id: string;
  userId: string;
  source: 'strava' | 'apple_health' | 'garmin' | 'manual';
  externalId: string;

  startTime: string; // ISO datetime
  distance: number; // km
  duration: number; // seconds
  elevationGain?: number; // metres

  avgPace: number; // seconds per km
  avgHR?: number; // bpm
  maxHR?: number; // bpm

  splits: ActivitySplit[];

  // Matched session (set by matching algorithm)
  matchedSessionId?: string;
}
