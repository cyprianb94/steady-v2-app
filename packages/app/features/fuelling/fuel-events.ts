import type { Activity, RunFuelEvent, RunFuelGel } from '@steady/types';

export interface FuelSummary {
  count: number;
  carbsG: number;
  caffeineMg: number;
}

export function maxFuelMinute(durationSeconds: number): number {
  return Math.max(0, Math.ceil(durationSeconds / 60));
}

export function sortFuelEvents(events: RunFuelEvent[]): RunFuelEvent[] {
  return [...events].sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id));
}

export function fuelSummary(events: RunFuelEvent[]): FuelSummary {
  return events.reduce<FuelSummary>(
    (summary, event) => ({
      count: summary.count + 1,
      carbsG: summary.carbsG + (event.gel.carbsG ?? 0),
      caffeineMg: summary.caffeineMg + (event.gel.caffeineMg ?? 0),
    }),
    { count: 0, carbsG: 0, caffeineMg: 0 },
  );
}

export function formatFuelSummary(events: RunFuelEvent[]): string {
  const summary = fuelSummary(events);
  if (summary.count === 0) {
    return 'No gels logged';
  }

  const gelLabel = summary.count === 1 ? 'gel' : 'gels';
  return `${summary.count} ${gelLabel} · ${summary.carbsG}g carbs · ${summary.caffeineMg}mg caf`;
}

export function formatGelStats(gel: RunFuelGel): string {
  const stats: string[] = [];
  if (gel.carbsG != null) stats.push(`${gel.carbsG}g carbs`);
  if (gel.caffeineMg) stats.push(`${gel.caffeineMg}mg caf`);
  if (gel.sodiumMg) stats.push(`${gel.sodiumMg}mg sodium`);
  return stats.length ? stats.join(' · ') : 'No nutrition data';
}

export function createFuelEvent(gel: RunFuelGel, minute: number): RunFuelEvent {
  return {
    id: `fuel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    minute,
    gel: { ...gel },
  };
}

export function nextFuelMinute(currentMinute: number, maxMinute: number): number {
  return Math.min(maxMinute, currentMinute + 25);
}

export function uniqueRecentFuelGels(activities: Activity[], limit = 6): RunFuelGel[] {
  const orderedEvents = activities
    .flatMap((activity) => (activity.fuelEvents ?? []).map((event) => ({ event, activity })))
    .sort((a, b) => {
      const byActivityTime = b.activity.startTime.localeCompare(a.activity.startTime);
      return byActivityTime || b.event.minute - a.event.minute;
    });
  const seen = new Set<string>();
  const gels: RunFuelGel[] = [];

  for (const { event } of orderedEvents) {
    if (seen.has(event.gel.id)) continue;
    seen.add(event.gel.id);
    gels.push(event.gel);
    if (gels.length >= limit) break;
  }

  return gels;
}

const DEFAULT_BRAND_ORDER = [
  'Precision Fuel & Hydration',
  'Maurten',
  'SiS (Science in Sport)',
  'HIGH5',
  'Puresport',
];

export function suggestedBrands(recentGels: RunFuelGel[], allBrands: string[], limit = 5): string[] {
  const suggestions: string[] = [];
  for (const gel of recentGels) {
    if (!suggestions.includes(gel.brand)) suggestions.push(gel.brand);
  }
  for (const brand of DEFAULT_BRAND_ORDER) {
    if (allBrands.includes(brand) && !suggestions.includes(brand)) suggestions.push(brand);
    if (suggestions.length >= limit) break;
  }
  for (const brand of allBrands) {
    if (!suggestions.includes(brand)) suggestions.push(brand);
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}
