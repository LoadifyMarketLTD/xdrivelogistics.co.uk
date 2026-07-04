# XDrive Driver Mobile

Native driver app for Android/iOS built with Expo React Native.

This is not a mobile web page, PWA, or `/m` route. The target output is an installable Android APK/AAB and later an iOS build.

## App structure

The app uses a **custom entrypoint** — `App.tsx` — not Expo Router. `App.tsx` dynamically imports the root component from `src/mobile/DriverMobileApp.tsx`. There is no `src/app/` Expo Router root.

```
App.tsx                          ← Expo entrypoint (startup diagnostics, error boundary)
src/
  mobile/
    DriverMobileApp.tsx          ← Root React Native component
    mockData.ts
  api/                           ← API client helpers
  auth/                          ← Auth context and session logic
  jobs/                          ← Job screens and hooks
  offline/                       ← Offline queue
  push/                          ← Push notification shell
  ui/                            ← Theme, primitives
```

## Setup

```bash
cd apps/driver-mobile
cp .env.example .env             # fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npm start
```

## APK preview build (EAS)

```bash
eas build --profile preview --platform android
```

This produces an internal-distribution `.apk` signed by EAS-managed credentials.

### Required EAS environment variables

Set these on the `preview` profile in the EAS dashboard before building:

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `https://xdrivelogistics.co.uk` |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

For Android credentials, EAS can generate and manage the keystore during the first build. Do not lose the Expo account access because that keystore signs future Android releases.

## Expo / EAS Project

- Organization: `xdrive-logistics-ltd`
- Project: `XDrive Driver`
- Slug: `xdrive-driver`
- Project ID: `c19b0bdf-567a-488e-b78f-d36b84f25c99`
- Android package: `co.uk.xdrivelogistics.driver`

## EAS Build Profiles

- `preview`: Android APK for internal testing.
- `production`: Android App Bundle for Play Store release.

## MVP Scope

- Persistent driver login.
- Active Job as the default operational screen.
- My Jobs with Active, Upcoming, and Completed scopes.
- Job Detail with operational fields only.
- Canonical execution flow from awarded to delivered.
- POD capture shell for photo, document, and signature.
- Critical notification registration shell.
- Offline queue skeleton for status/POD retry.

## Architecture Rules

- Backend remains the source of truth.
- The mobile client does not decide critical business transitions.
- Status changes use atomic backend endpoints.
- Offline actions are queued and retried; the UI must show pending/synced/failed states.
