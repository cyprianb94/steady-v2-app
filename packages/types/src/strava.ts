export interface StravaSyncMatchSummary {
  sessionId: string;
  sessionType: string;
  sessionDate: string;
}

export interface StravaSyncResult {
  new: number;
  skipped: number;
  matched: number;
  matchedSessions: StravaSyncMatchSummary[];
}
