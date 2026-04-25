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
}

export interface Activity {
  id: string;
  userId: string;
  source: 'strava' | 'apple_health' | 'garmin' | 'manual';
  externalId: string;
  name?: string; // Activity name from the source (e.g. Strava's activity.name)

  startTime: string; // ISO datetime
  distance: number; // km
  duration: number; // seconds
  elevationGain?: number; // metres

  avgPace: number; // seconds per km
  avgHR?: number; // bpm
  maxHR?: number; // bpm

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
