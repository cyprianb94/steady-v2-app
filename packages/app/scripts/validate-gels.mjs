import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, '..');
const CATALOGUE_PATH = path.join(APP_DIR, 'data', 'gels.json');

const nullableNumberFields = [
  'calories_kcal',
  'carbs_g',
  'caffeine_mg',
  'sodium_mg',
  'potassium_mg',
  'magnesium_mg',
];

function fail(message) {
  console.error(`Gel catalogue invalid: ${message}`);
  process.exitCode = 1;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const raw = await readFile(CATALOGUE_PATH, 'utf8');
const catalogue = JSON.parse(raw);

if (!Array.isArray(catalogue)) {
  fail('top-level value must be an array');
} else {
  const seen = new Set();

  catalogue.forEach((gel, index) => {
    const label = `entry ${index + 1}`;
    if (!gel || typeof gel !== 'object' || Array.isArray(gel)) {
      fail(`${label} must be an object`);
      return;
    }

    for (const field of ['brand', 'name', 'flavour']) {
      if (typeof gel[field] !== 'string' || gel[field].trim().length === 0) {
        fail(`${label} has missing ${field}`);
      }
    }

    const identity = [gel.brand, gel.name, gel.flavour]
      .map((part) => String(part ?? '').trim().toLowerCase())
      .join('|');
    if (seen.has(identity)) {
      fail(`${label} duplicates brand/name/flavour: ${gel.brand} / ${gel.name} / ${gel.flavour}`);
    }
    seen.add(identity);

    for (const field of nullableNumberFields) {
      const value = gel[field];
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
        fail(`${label} ${field} must be a non-negative number or null`);
      }
    }

    if (gel.image_url !== null && (typeof gel.image_url !== 'string' || !isHttpUrl(gel.image_url))) {
      fail(`${label} image_url must be null or an http(s) URL`);
    }

    if (gel.notes !== null && gel.notes !== undefined && typeof gel.notes !== 'string') {
      fail(`${label} notes must be a string, null, or omitted`);
    }
  });

  if (process.exitCode !== 1) {
    console.log(`Gel catalogue valid: ${catalogue.length} entries`);
  }
}
