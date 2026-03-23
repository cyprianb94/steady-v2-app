export type SessionType = 'EASY' | 'INTERVAL' | 'TEMPO' | 'LONG' | 'REST';

export interface PlannedSession {
  id: string;
  type: SessionType;
  date: string; // ISO date 'YYYY-MM-DD'

  // EASY, TEMPO, LONG
  distance?: number; // km
  pace?: string; // 'M:SS' format e.g. '4:20'

  // INTERVAL
  reps?: number;
  repDist?: number; // metres e.g. 800
  recovery?: string; // '45s' | '60s' | '90s' | '2min' | '3min' | '4min' | '5min'

  // INTERVAL + TEMPO
  warmup?: number; // km
  cooldown?: number; // km

  // Linked actual activity
  actualActivityId?: string;
}

export type RecoveryDuration = '45s' | '60s' | '90s' | '2min' | '3min' | '4min' | '5min';

export const RECOVERY_KM: Record<RecoveryDuration, number> = {
  '45s': 0.14,
  '60s': 0.18,
  '90s': 0.27,
  '2min': 0.36,
  '3min': 0.55,
  '4min': 0.73,
  '5min': 0.91,
};
