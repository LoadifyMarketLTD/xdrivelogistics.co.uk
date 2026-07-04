# XDrive Driver Mobile

Native driver app scaffold for Android/iOS built with Expo React Native.

This is not a mobile web page, PWA, or `/m` route. The target output is an installable Android APK/AAB and later an iOS build.

## MVP Scope

- Persistent driver login.
- Active Job as the default operational screen.
- My Jobs with Active, Upcoming, and Completed scopes.
- Job Detail with operational fields only.
- Canonical execution flow from awarded to delivered.
- POD capture shell for photo, document, and signature.
- Critical notification registration shell.
- Offline queue skeleton for status/POD retry.

## Commands

```bash
npm install
npm run start
npm run android
npm run build:android:apk
npm run build:android:aab
```

From the repository root:

```bash
npm run mobile:dev
npm run mobile:android
npm run mobile:apk
```

## Expo / EAS Project

- Organization: `xdrive-logistics-ltd`
- Project: `XDrive Driver`
- Slug: `xdrive-driver`
- Project ID: `c19b0bdf-567a-488e-b78f-d36b84f25c99`
- Android package: `co.uk.xdrivelogistics.driver`

## EAS Build Profiles

- `preview`: Android APK for internal testing.
- `production`: Android App Bundle for Play Store release.

Before the first cloud build, register the Supabase credentials as **EAS secrets** (they are injected automatically during the build and override the empty placeholder values in `eas.json`):

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "<your-supabase-url>"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<your-supabase-anon-key>"
```

`EXPO_PUBLIC_API_BASE_URL` is already set to `https://xdrivelogistics.co.uk` in `eas.json` and does not need a separate secret.

> **Why EAS secrets?** Metro statically inlines `process.env.EXPO_PUBLIC_*` at bundle time. If these env vars are absent during the EAS cloud build, the Supabase client is initialised with empty credentials (`isSupabaseConfigured = false`), login is blocked, and all API calls return `401 Missing bearer token`.

For Android credentials, EAS can generate and manage the keystore during the first build. Do not lose the Expo account access because that keystore signs future Android releases.

## Architecture Rules

- Backend remains the source of truth.
- The mobile client does not decide critical business transitions.
- Status changes use atomic backend endpoints.
- Offline actions are queued and retried; the UI must show pending/synced/failed states.
