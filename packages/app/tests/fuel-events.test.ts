import { describe, expect, it } from 'vitest';
import type { Activity, RunFuelGel } from '@steady/types';
import {
  formatFuelSummary,
  maxFuelMinute,
  nextFuelMinute,
  sortFuelEvents,
  suggestedBrands,
  uniqueRecentFuelGels,
} from '../features/fuelling/fuel-events';
import { GEL_CATALOGUE, gelCatalogueId } from '../features/fuelling/gel-catalogue';

const pf30: RunFuelGel = {
  id: 'precision-fuel-and-hydration-pf-30-gel-original',
  brand: 'Precision Fuel & Hydration',
  name: 'PF 30 Gel',
  flavour: 'Original',
  caloriesKcal: 120,
  carbsG: 30,
  caffeineMg: 0,
  sodiumMg: 0,
  potassiumMg: 0,
  magnesiumMg: 0,
  imageUrl: null,
};

const pf30Caf: RunFuelGel = {
  ...pf30,
  id: 'precision-fuel-and-hydration-pf-30-caffeine-gel-original',
  name: 'PF 30 Caffeine Gel',
  caffeineMg: 100,
};

function activity(overrides: Partial<Activity>): Activity {
  return {
    id: 'activity-1',
    userId: 'user-1',
    source: 'strava',
    externalId: 'strava-1',
    startTime: '2026-04-20T08:00:00Z',
    distance: 16,
    duration: 5400,
    avgPace: 337,
    splits: [],
    ...overrides,
  };
}

describe('fuel events', () => {
  it('summarises fuel events in run-detail terms', () => {
    expect(formatFuelSummary([
      { id: 'fuel-1', minute: 24, gel: pf30 },
      { id: 'fuel-2', minute: 58, gel: pf30Caf },
    ])).toBe('2 gels · 60g carbs · 100mg caf');
  });

  it('sorts events by minute and caps the repeat-entry next minute', () => {
    expect(sortFuelEvents([
      { id: 'fuel-2', minute: 58, gel: pf30 },
      { id: 'fuel-1', minute: 24, gel: pf30 },
    ]).map((event) => event.id)).toEqual(['fuel-1', 'fuel-2']);

    expect(maxFuelMinute(2650)).toBe(45);
    expect(nextFuelMinute(35, 45)).toBe(45);
  });

  it('suggests recently used gels and their brands from prior activities', () => {
    const recent = uniqueRecentFuelGels([
      activity({
        id: 'newer',
        startTime: '2026-04-21T08:00:00Z',
        fuelEvents: [{ id: 'fuel-3', minute: 50, gel: pf30Caf }],
      }),
      activity({
        id: 'older',
        startTime: '2026-04-20T08:00:00Z',
        fuelEvents: [
          { id: 'fuel-1', minute: 25, gel: pf30 },
          { id: 'fuel-2', minute: 55, gel: pf30Caf },
        ],
      }),
    ]);

    expect(recent.map((gel) => gel.id)).toEqual([pf30Caf.id, pf30.id]);
    expect(suggestedBrands(recent, ['Maurten', 'Precision Fuel & Hydration'])).toEqual([
      'Precision Fuel & Hydration',
      'Maurten',
    ]);
  });

  it('derives stable catalogue ids from the manual gel JSON', () => {
    expect(gelCatalogueId({
      brand: 'Precision Fuel & Hydration',
      name: 'PF 30 Gel',
      flavour: 'Original',
    })).toBe(pf30.id);
    expect(GEL_CATALOGUE.length).toBeGreaterThan(50);
  });
});
