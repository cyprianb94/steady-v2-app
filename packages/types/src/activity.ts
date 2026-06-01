import type { Niggle } from './niggle';
import type { SubjectiveInput } from './session';

export interface RunFuelGel {
  id: string;
  brand: string;
  name: string;
  flavour: string;
  caloriesKcal: number | null;
  carbsG: number | null;
  caffeineMg: number | null;
  sodiumMg: number | null;
  potassiumMg: number | null;
  magnesiumMg: number | null;
  imageUrl: string | null;
  notes?: string;
}

export interface RunFuelEvent {
  id: string;
  minute: number;
  gel: RunFuelGel;
}

export interface ActivitySplit {
  km: number; // 1-indexed
  pace: number; // seconds per km
  hr?: number; // bpm at end of split
  elevation?: number; // m gain in this km
  label?: string; // display label (e.g. "KM 1", "400m")
  distance?: number; // km in this split/lap
  cadence?: number; // steps per minute where available
}

export type ActivitySource = 'strava' | 'apple_health' | 'garmin' | 'manual';

export type ActivityRunSubtype = 'outdoor' | 'trail' | 'track' | 'treadmill' | 'unknown';

export type ProviderActivitySource = Exclude<ActivitySource, 'manual'>;

export interface NormalizedProviderActivity {
  source: ProviderActivitySource;
  externalId: string;
  name?: string;
  sourceName?: string;
  sourceBundleId?: string;
  sourceDevice?: string;
  startTime: string;
  timezone?: string;
  runSubtype: ActivityRunSubtype;
  distanceKm: number;
  durationSeconds: number;
  movingDurationSeconds?: number;
  elapsedDurationSeconds?: number;
  elevationGainM?: number;
  avgPaceSecondsPerKm?: number;
  avgHR?: number;
  maxHR?: number;
  avgCadence?: number;
  splits: ActivitySplit[];
  dataQuality: Record<string, boolean | number | string | null>;
}

export interface Activity {
  id: string;
  userId: string;
  source: ActivitySource;
  externalId: string;
  name?: string; // Activity name from the source (e.g. Strava's activity.name)
  sourceName?: string; // Provider/source display label, e.g. Apple Watch or Strava
  sourceDevice?: string; // Device/app detail where available
  runSubtype?: ActivityRunSubtype;

  startTime: string; // ISO datetime
  distance: number; // km
  duration: number; // seconds
  elevationGain?: number; // metres

  avgPace: number; // seconds per km
  avgHR?: number; // bpm
  maxHR?: number; // bpm
  avgCadence?: number; // steps per minute

  splits: ActivitySplit[];

  // Post-run subjective ratings
  subjectiveInput?: SubjectiveInput;

  // Matched session (set by matching algorithm)
  matchedSessionId?: string;

  // Auto-detected shoe from the source integration
  shoeId?: string;

  // Freeform notes captured on Run Detail
  notes?: string;

  // Persisted niggles attached to this activity
  niggles?: Niggle[];

  // Gels consumed during this run, logged by minute from run start
  fuelEvents?: RunFuelEvent[];
}

export interface ActivitySyncMatchSummary {
  sessionId: string;
  sessionType: string;
  sessionDate: string;
}

export interface ActivityImportResult {
  fetched: number;
  imported: number;
  skipped: number;
  upgraded: number;
  matched: number;
  errors: number;
  matchedSessions: ActivitySyncMatchSummary[];
  lastSuccessfulSyncAt: string | null;
}
