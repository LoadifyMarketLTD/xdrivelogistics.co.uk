# XDrive Driver — three-client architecture decision

Status: corrective architecture decision for PR #301.

## Three confirmed driver clients

The repository contains three driver-facing clients with distinct package identities and roles:

### 1. `android-native` — canonical production Android application
- **Package**: `co.uk.xdrivelogistics.driver`
- **Stack**: Kotlin / Jetpack Compose (Material 3) / OkHttp / DataStore
- **Role**: The only canonical Android/Google Play production application.
- **Source**: `android-native/`

### 2. `apps/driver-mobile` — preview Expo/React Native application
- **Package**: `co.uk.xdrivelogistics.driver.preview`
- **Stack**: Expo / React Native / TypeScript
- **Role**: Internal preview and staging only. Never canonical, never production, never a Play Store release target.
- **Source**: `apps/driver-mobile/`

### 3. `app/m` / `DriverMobileAppVariant.tsx` — mobile web launcher / fallback
- **Stack**: Next.js server + client components
- **Role**: Deep-link launcher (`xdrivedriver://`), APK download page, and web fallback for drivers without the native app. Not an operational driver product.
- **Source**: `app/m/`, `app/m/_components/DriverMobileAppVariant.tsx`

## Architecture rules

- `android-native` is the only canonical Android/Google Play target. All production Android decisions (signing, Play Store listing, versioning) apply exclusively to it.
- `apps/driver-mobile` must never be described as canonical or production. Its package ID (`co.uk.xdrivelogistics.driver.preview`) is permanently distinct from the production application.
- `/m` must remain a launcher/download/deep-link page only. It must not become a second operational mobile product.
- The mobile API routes (`/api/driver/mobile/*`) serve both the Kotlin native app and the Expo preview; they are not exclusive to either.

## Previous incorrect claim

The document added in commit `ba5673a5` stated that `apps/driver-mobile` was "the single canonical driver application intended for Android/Google Play". That claim was wrong. Commit `ae6c7adc` had already renamed the Expo app to **XDrive Driver Preview** and set the Android package to `co.uk.xdrivelogistics.driver.preview`, preserving `co.uk.xdrivelogistics.driver` for the Kotlin native application.

No production migration, deploy, merge or Play Store publication is authorised by this document.
