export type BlockVolumeTone = 'past' | 'current' | 'future';

export function getWeekVolumeRatio(weekVolume: number, peakVolume: number): number {
  if (peakVolume <= 0 || weekVolume <= 0) return 0;
  return Math.min(weekVolume / peakVolume, 1);
}

export function getBlockVolumeTone(
  weekIndex: number,
  currentWeekIndex: number,
): BlockVolumeTone {
  if (weekIndex < currentWeekIndex) return 'past';
  if (weekIndex > currentWeekIndex) return 'future';
  return 'current';
}
