# Apple HealthKit Integration QA Handoff

## What changed

Steady can now import completed Apple Watch runs from Apple Health on iOS.

The app reads only the v1 run data needed for planned-vs-actual:

- completed workouts
- distance, duration, pace
- heart rate summary when permission is available
- cadence from workout step count when permission is available
- provider/source metadata for provenance

The app does not request or store routes, GPS traces, raw streams, sleep, HRV, readiness, or all-day health data.

## What still needs a human

1. In Apple Developer, enable HealthKit for both iOS bundle IDs:
   - `com.cyprianbrytan.steady.preview`
   - `com.cyprianbrytan.steady`
2. Make sure the provisioning profiles regenerate after HealthKit is enabled.
3. Deploy the Supabase migration in this branch before TestFlight QA.
4. Build a new iOS binary. An EAS Update is not enough because HealthKit is a native entitlement.
5. Test on a real iPhone with Apple Health data. Expo Go cannot run this HealthKit integration.

## Build steps

From the repo root:

```bash
npm run typecheck
npm run test
```

Deploy the database migration:

```bash
supabase db push
```

Build preview TestFlight:

```bash
npm run release:preview:ios -w packages/app
```

Build production when preview QA passes:

```bash
npm run release:production:ios -w packages/app
```

## ELI5 QA script

Use an iPhone that has at least one completed Apple Watch run in Apple Health.

1. Install the preview build from TestFlight.
2. Sign in.
3. Build or open a training plan.
4. Go to `Settings`.
5. Under `Activity sync`, tap `Connect Apple Health`.
6. In the Apple permission sheet, allow:
   - workouts
   - distance
   - heart rate
   - steps
   - running speed
7. Confirm the Settings row changes to `Connected`.
8. Tap `Sync Apple Health`.
9. Open the relevant week or home screen and check that the run matched to the right planned session.
10. Open the run detail screen.
11. Confirm it shows:
    - Apple Watch or Apple Health source label
    - distance, duration, pace
    - average heart rate if allowed
    - cadence if step-count permission was allowed
    - planned-vs-actual still works
12. Add notes, shoes, fuel, feel, and niggles, then save.
13. Sync again and confirm those user-entered fields were not overwritten.

## Privacy QA

Check the Apple Health permission sheet and Settings copy. It must not mention sleep, HRV, readiness, or all-day health.

After syncing a run, inspect the database row:

- `activities.source` should be `apple_health`
- `provider_activity_records.data_quality_flags.routeRetained` should be `false`
- no route/polyline/GPS fields should exist in the payload or database rows
- `provider_activity_records` should include source/provenance, not raw HealthKit files

Try denying heart-rate permission but allowing workouts and distance. The run should still import without HR.

Try denying all Health permissions. Steady should not mark Apple Health connected, and no run should import.

## Source-switching QA

1. Connect Strava.
2. Connect Apple Health.
3. Import an Apple Watch run that duplicates an existing Strava run.
4. If Apple Watch is primary, Steady should keep the same canonical activity id, switch its source to `apple_health`, and preserve:
   - matched planned session
   - notes
   - shoes
   - feel
   - fuel
   - niggles
5. Disconnect Apple Health.
6. Confirm existing imported runs stay in Steady.
7. Confirm future Apple Health sync stops until reconnected.

## Known v1 limits

- iOS only.
- Real device/TestFlight or a custom dev client only. Not Expo Go.
- Foreground/manual sync only.
- No HealthKit background delivery in v1.
- One summary split is created when HealthKit does not provide safe lap data.
- Garmin is not implemented in this branch.
