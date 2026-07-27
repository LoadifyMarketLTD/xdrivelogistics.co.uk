# XDrive Driver Preview (Expo/React Native)

This is the **preview** Expo/React Native driver app. It is for internal staging and testing only.

**Canonical production Android application**: see `android-native/` (`co.uk.xdrivelogistics.driver`, Kotlin/Jetpack Compose).

This app's Android package is `co.uk.xdrivelogistics.driver.preview` and it must never be published to the Play Store as `co.uk.xdrivelogistics.driver`.

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
- Project: `XDrive Driver Preview`
- Slug: `xdrive-driver-preview`
- Project ID: `c19b0bdf-567a-488e-b78f-d36b84f25c99`
- Android package: `co.uk.xdrivelogistics.driver.preview` (preview only — never the production package)

## EAS Build Profiles

- `preview`: Android APK for internal testing.
- `production`: Android App Bundle for Play Store release.

The mobile app now supports two Supabase config sources:

- **Preferred fallback:** runtime fetch from `https://www.xdrivelogistics.co.uk/api/driver/mobile/config`
- **Optional override:** EAS secrets injected at build time

This means the APK build no longer depends on EAS secrets just to make login work. If the production site already has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured, the app can bootstrap auth at runtime automatically.

If you still want to override the runtime config during cloud builds, register the Supabase credentials as **EAS secrets**:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "<your-supabase-url>"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<your-supabase-anon-key>"
```

`EXPO_PUBLIC_API_BASE_URL` is already set to `https://www.xdrivelogistics.co.uk` in `eas.json` and does not need a separate secret.

> **Why keep EAS secrets optional?** Metro statically inlines `process.env.EXPO_PUBLIC_*` at bundle time, but the app now falls back to a runtime config fetch before auth starts. Missing EAS secrets no longer block login as long as the production site exposes valid public Supabase settings from `/api/driver/mobile/config`.

For Android credentials, EAS can generate and manage the keystore during the first build. Do not lose the Expo account access because that keystore signs future Android releases.

## Architecture Rules

- Backend remains the source of truth.
- The mobile client does not decide critical business transitions.
- Status changes use atomic backend endpoints.
- Offline actions are queued and retried; the UI must show pending/synced/failed states.

## Functional APK Audit

- Use `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/apps/driver-mobile/docs/apk-functional-audit-workbook.md` as the canonical ecran-cu-ecran, buton-cu-buton audit workbook.
- Fill baseline metadata (APK build ID/hash + environment) before starting execution.
- Record all defects in the in-file Functional Gap Register and convert approved fixes into P0/P1/P2 remediation backlog items.
