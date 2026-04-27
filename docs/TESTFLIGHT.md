# TestFlight + Private Staging

Steady uses three lanes:

| Lane | Who sees it | How it runs | Use it for |
| --- | --- | --- | --- |
| Local dev | You | Expo local/LAN dev server | Fast coding iteration. This is the current setup. |
| Preview | You | EAS internal distribution, `preview` channel | Private release-like testing on your phone, away from local Wi-Fi. |
| Production | Friends/TestFlight | App Store Connect/TestFlight, `production` channel | Builds and updates that are ready for friends. |

## Current Repo Setup

- `packages/app/eas.json` has `development`, `preview`, and `production` profiles.
- `preview` builds use the `preview` EAS channel and internal distribution.
- `production` builds use the `production` EAS channel and auto-increment app versions.
- `app.config.ts` gives preview its own app identity:
  - Name: `Steady Preview`
  - Scheme: `steady-preview`
  - iOS bundle ID: `com.cyprianbrytan.steady.preview`
- Local dev and production keep the current identity:
  - Name: `Steady`
  - Scheme: `steady`
  - iOS bundle ID: `com.cyprianbrytan.steady`

This means preview and production can be installed as separate apps once the Apple/EAS setup exists.

## What Still Needs You Awake

These steps can prompt for Apple/EAS credentials, 2FA, agreements, or real secrets:

1. Create or confirm the EAS project:

```bash
cd packages/app
npx --yes eas-cli init
```

2. Configure EAS Update. This should install/configure `expo-updates`, add the EAS project ID, and write the update URL:

```bash
cd packages/app
npx --yes eas-cli update:configure
```

3. Create EAS environment variables for both `preview` and `production`:

```bash
cd packages/app
npx --yes eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://your-preview-api.example.com
npx --yes eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co
npx --yes eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your-anon-key
npx --yes eas-cli env:create --environment preview --name EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN --value your-preview-app-domain.example.com

npx --yes eas-cli env:create --environment production --name EXPO_PUBLIC_API_URL --value https://your-production-api.example.com
npx --yes eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co
npx --yes eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your-anon-key
npx --yes eas-cli env:create --environment production --name EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN --value your-production-app-domain.example.com
```

4. Register your iPhone for preview internal distribution:

```bash
cd packages/app
npx --yes eas-cli device:create
```

5. Create/confirm the App Store Connect app for production TestFlight.

## Redirects To Whitelist

Supabase/Google redirect URLs:

- `steady://auth/callback`
- `steady-preview://auth/callback`

Set the Strava app's **Authorization Callback Domain** to:

- the domain in `EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN`, without `https://`

Use the app/API domain here, not the landing-page domain. If preview and production use the same Strava client ID, they must use the same callback domain; otherwise create separate Strava apps/client IDs per environment.

Production/TestFlight redirect URI sent by the app:

- `steady://<EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN>/strava-callback`

Preview redirect URI sent by the app:

- `steady-preview://<EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN>/strava-callback`

Local development uses Strava's localhost callback-domain whitelist. Set the Strava app's Authorization Callback Domain to `localhost` when testing locally. The app sends `exp://localhost/--/strava-callback` from Expo Go and `steady://localhost/strava-callback` from native development builds.

## Build Commands

Private preview build for only you:

```bash
cd packages/app
npm run release:preview:ios
```

Production build for TestFlight:

```bash
cd packages/app
npm run release:production:ios
```

Submit the latest production build to App Store Connect/TestFlight:

```bash
cd packages/app
npm run release:production:submit
```

## Update Commands

Use these only after `npx --yes eas-cli update:configure` has completed successfully.

Only you get the JS/UI update:

```bash
cd packages/app
npm run release:update:preview -- --message "Describe the change"
```

Friends on TestFlight get the JS/UI update:

```bash
cd packages/app
npm run release:update:production -- --message "Describe the change"
```

## Daily Workflow

For normal coding:

1. Run the current local setup.
2. Test in Expo/dev mode.
3. Stop there if the change is tiny and not ready for anyone else.

For private phone testing away from Wi-Fi:

1. Finish the feature locally.
2. If it is JS/UI only and EAS Update is configured, publish to `preview`.
3. If it changes native dependencies, `app.json`, app identity, permissions, or native config, make a new preview build.
4. Test in `Steady Preview` on your phone.

For friends:

1. Only promote changes after preview/dev validation.
2. JS/UI-only change: publish to `production`.
3. Native/config change: create a new production build and submit it to TestFlight.
4. Add or notify testers from App Store Connect/TestFlight.

## Rules Of Thumb

Dev only is enough for copy tweaks, safe UI polish, and small local logic changes.

Use preview before friends for auth/OAuth, API/env/backend changes, onboarding, deep links, native/config changes, and anything friends will touch soon.

Friends do not automatically see preview changes. They only see production TestFlight builds or updates published to the `production` channel.
