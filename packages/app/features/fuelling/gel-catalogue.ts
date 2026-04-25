import type { RunFuelGel } from '@steady/types';
import gelsSeed from '../../data/gels.json';

interface SeedGel {
  brand: string;
  name: string;
  flavour: string;
  calories_kcal: number | null;
  carbs_g: number | null;
  caffeine_mg: number | null;
  sodium_mg: number | null;
  potassium_mg: number | null;
  magnesium_mg: number | null;
  image_url: string | null;
  notes?: string | null;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function gelCatalogueId(gel: Pick<SeedGel, 'brand' | 'name' | 'flavour'>): string {
  return [gel.brand, gel.name, gel.flavour].map(slugify).join('-');
}

export function seedGelToRunFuelGel(gel: SeedGel): RunFuelGel {
  return {
    id: gelCatalogueId(gel),
    brand: gel.brand,
    name: gel.name,
    flavour: gel.flavour,
    caloriesKcal: gel.calories_kcal,
    carbsG: gel.carbs_g,
    caffeineMg: gel.caffeine_mg,
    sodiumMg: gel.sodium_mg,
    potassiumMg: gel.potassium_mg,
    magnesiumMg: gel.magnesium_mg,
    imageUrl: gel.image_url,
    notes: gel.notes ?? undefined,
  };
}

export const GEL_CATALOGUE: RunFuelGel[] = (gelsSeed as SeedGel[]).map(seedGelToRunFuelGel);

export const GEL_BRANDS: string[] = Array.from(
  new Set(GEL_CATALOGUE.map((gel) => gel.brand)),
).sort((a, b) => a.localeCompare(b));

export function gelsForBrand(brand: string, gels = GEL_CATALOGUE): RunFuelGel[] {
  return gels
    .filter((gel) => gel.brand === brand)
    .sort((a, b) => `${a.name} ${a.flavour}`.localeCompare(`${b.name} ${b.flavour}`));
}

export function findGelById(gelId: string, gels = GEL_CATALOGUE): RunFuelGel | null {
  return gels.find((gel) => gel.id === gelId) ?? null;
}

export function searchBrands(query: string, brands = GEL_BRANDS): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return brands;
  return brands.filter((brand) => brand.toLowerCase().includes(normalized));
}
