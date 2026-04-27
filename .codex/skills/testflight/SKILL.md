---
name: testflight
description: Use when preparing production mobile builds, release environment variables, or TestFlight distribution and verification.
---

# TestFlight Checklist

## Before the first build

1. Put the Fastify server on a public HTTPS URL.
2. Create the Expo public env vars in EAS for the `production` environment:
   - `EXPO_PUBLIC_API_URL`
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN`
3. Pull those vars locally if you want local parity:

```bash
eas env:pull --environment production
```

4. Confirm the auth callbacks are whitelisted:
   - Supabase / Google OAuth redirect: `steady://auth/callback`
   - Strava Authorization Callback Domain: the value of `EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN` (app/API domain, not landing-page domain)
   - Strava redirect URI: `steady://<EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN>/strava-callback`
   - Local Strava testing uses Authorization Callback Domain `localhost`: Expo Go sends `exp://localhost/--/strava-callback`, native development builds send `steady://localhost/strava-callback`.

## Build and submit

From `packages/app`:

```bash
npx testflight
```

That command walks through EAS project setup, iOS credentials, the build, and App Store Connect submission.

## After upload

1. Wait for Apple processing to finish in App Store Connect.
2. Add internal testers right away, or submit the beta for external tester review.
3. Share the TestFlight invite link with testers once the build is available.
