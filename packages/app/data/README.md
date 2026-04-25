# Gel catalogue

Edit `gels.json` directly when adding or correcting gels.

Each entry uses the source-friendly field names from the seed file:

```json
{
  "brand": "Precision Fuel & Hydration",
  "name": "PF 30 Gel",
  "flavour": "Original",
  "calories_kcal": 120,
  "carbs_g": 30,
  "caffeine_mg": 0,
  "sodium_mg": 0,
  "potassium_mg": 0,
  "magnesium_mg": 0,
  "image_url": null,
  "notes": "Optional catalogue note"
}
```

Rules:

- Keep `brand`, `name`, and `flavour` non-empty. Together they identify a gel in the app catalogue.
- Use numbers for known nutrition values.
- Use `null` when the label does not publish a value.
- Keep `image_url` as `null` for now. Image storage is tracked separately in Linear issue `STV2-110`.

After editing, run:

```bash
npm run validate:gels -w packages/app
```
