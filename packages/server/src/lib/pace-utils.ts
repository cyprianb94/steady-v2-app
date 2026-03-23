/**
 * Convert pace string 'M:SS' to total seconds.
 * e.g. '4:20' → 260
 */
export function paceToSeconds(pace: string): number {
  const [m, s] = pace.split(':').map(Number);
  return m * 60 + s;
}

/**
 * Convert total seconds to pace string 'M:SS'.
 * e.g. 260 → '4:20'
 */
export function secondsToPace(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
