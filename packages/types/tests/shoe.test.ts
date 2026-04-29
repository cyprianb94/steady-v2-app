import { describe, expect, it } from 'vitest';
import { shoeLifetimeKm, type Shoe } from '../src/shoe';

function makeShoe(overrides: Partial<Shoe> = {}): Shoe {
  return {
    id: 'shoe-1',
    userId: 'user-1',
    stravaGearId: 'gear-1',
    brand: 'Nike',
    model: 'Pegasus',
    retired: false,
    totalKm: 0,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('shoeLifetimeKm', () => {
  it('uses Strava gear distance when it is the highest known total', () => {
    expect(shoeLifetimeKm(makeShoe({ stravaDistanceKm: 388.206, totalKm: 18 }))).toBe(388.206);
  });

  it('uses local activity distance when Strava returns a lower total', () => {
    expect(shoeLifetimeKm(makeShoe({ stravaDistanceKm: 27, totalKm: 111 }))).toBe(111);
  });

  it('falls back to local activity distance for non-Strava shoes', () => {
    expect(shoeLifetimeKm(makeShoe({ stravaGearId: undefined, stravaDistanceKm: 388, totalKm: 42 }))).toBe(42);
  });
});
