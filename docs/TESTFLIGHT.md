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

0. Put the Fastify API on public HTTPS. The current Fly app is `steady-v2-api`, with production API origin:

```text
https://steady-v2-api.fly.dev
```

For the existing app, deploy from the repo root:

```bash
cd /Users/cyprianbrytan/Projects/steady-v2-app
fly auth login
fly secrets import
fly deploy --remote-only -a steady-v2-api
curl https://steady-v2-api.fly.dev/health
```

When `fly secrets import` opens, paste the backend environment variable lines in your terminal, not in chat:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
ENCRYPTION_KEY=...
```

For a brand new Fly app, create it first:

```bash
fly launch --name steady-v2-api --region lhr --dockerfile packages/server/Dockerfile --internal-port 3000 --no-db --no-redis --no-object-storage --no-github-workflow --no-deploy
fly secrets import
fly deploy --remote-only -a steady-v2-api
curl https://steady-v2-api.fly.dev/health
```

Keep the app scaled to one `shared-cpu-1x` machine with 256MB RAM for beta cost control:

```bash
fly scale count 1 -a steady-v2-api --yes
```

If Fly says `steady-v2-api` is already taken while recreating the app, choose another short app name and use that host everywhere below.

1. Sign in to Expo/EAS:

```bash
cd packages/app
npx --yes eas-cli login
```

This opens an Expo login page in your browser. Sign in, then come back to the terminal. Success looks like `Logged in`.

2. Create or confirm the EAS project:

```bash
cd packages/app
npx --yes eas-cli init
```

3. Configure EAS Update. This should install/configure `expo-updates`, add the EAS project ID, and write the update URL:

```bash
cd packages/app
npx --yes eas-cli update:configure
```

4. Create the required production EAS environment variables.

The confirmed production API values are:

```text
EXPO_PUBLIC_API_URL=https://steady-v2-api.fly.dev
EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN=steady-v2-api.fly.dev
```

Create those two values directly:

```bash
cd packages/app
npx --yes eas-cli env:create production --scope project --name EXPO_PUBLIC_API_URL --visibility plaintext --value https://steady-v2-api.fly.dev --force
npx --yes eas-cli env:create production --scope project --name EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN --visibility plaintext --value steady-v2-api.fly.dev --force
```

Create the Supabase values interactively so they are not written into chat or shell history:

```bash
cd packages/app
npx --yes eas-cli env:create production --scope project --name EXPO_PUBLIC_SUPABASE_URL --visibility sensitive --force
npx --yes eas-cli env:create production --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --visibility sensitive --force
```

When the terminal asks for each value, paste it from Supabase Dashboard -> Project Settings -> API:

- `EXPO_PUBLIC_SUPABASE_URL`: Project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Project API keys -> `anon` `public`.

5. Register your iPhone for preview internal distribution:

```bash
cd packages/app
npx --yes eas-cli device:create
```

6. Create/confirm the App Store Connect app for production TestFlight.

## Redirects To Whitelist

Supabase redirect allow-list:

- `steady://auth/callback`
- `steady-preview://auth/callback`

Google Cloud OAuth authorized redirect URI for the Supabase Google provider:

- `https://ckbhjjtneutbqwnwcupm.supabase.co/auth/v1/callback`

Set the Strava app's **Authorization Callback Domain** to:

- `steady-v2-api.fly.dev`

Use the app/API domain here, not the landing-page domain. Enter only the domain: no `https://`, no path, no trailing slash. If preview and production use the same Strava client ID, they must use the same callback domain; otherwise create separate Strava apps/client IDs per environment.

Production/TestFlight redirect URI sent by the app:

- `steady://steady-v2-api.fly.dev/strava-callback`

Preview redirect URI sent by the app if preview uses the same callback domain:

- `steady-preview://steady-v2-api.fly.dev/strava-callback`

Expo Go Strava testing uses the public API callback relay: set the Strava app's Authorization Callback Domain to the public API host from `EXPO_PUBLIC_API_URL`. The API receives `/oauth/strava/callback` and redirects back into the current Expo Go deep link with Strava's code.

Native development builds can use `localhost`: set the Strava app's Authorization Callback Domain to `localhost`, and the app will send `steady://localhost/strava-callback`.

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
