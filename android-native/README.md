# XDrive Driver — Canonical Production Android Application

**Package**: `co.uk.xdrivelogistics.driver`  
**Role**: This is the only canonical Android/Google Play production application for XDrive drivers.

The Expo/React Native preview app (`apps/driver-mobile`, package `co.uk.xdrivelogistics.driver.preview`) is a separate staging/preview project and is not a production Android target.

This folder contains the Kotlin/Jetpack Compose native Android application.

## Stack

- Kotlin
- Jetpack Compose (Material 3)
- OkHttp + Gson
- DataStore (session persistence)
- Google Play Services Location

## Current Native Coverage

- Native login against Supabase auth
- Driver profile resolution from Supabase REST
- Assigned jobs list
- Native tabbed shell (Today, Jobs, Messages, Documents, Settings)
- Quick note dispatch via `/api/driver/jobs/{jobId}/notes`
- Password update via `/api/driver/password`
- GPS publish via `/api/driver/location` (runtime permission flow included)
- Complete canonical job execution chain: `allocated/awarded -> on_my_way -> on_site_pickup -> loaded -> in_transit -> on_site_delivery -> delivered -> completed`
- Collection proof guard before `loaded` and signed POD/recipient confirmation guard before `delivered`
- Foreground GPS tracking with encrypted durable retry and session refresh
- Real POD document picker upload to Supabase Storage bucket `pod-docs` and photo arrays update on `jobs`

## Configure Build Properties

Create or edit `android-native/gradle.properties` (local machine) and set:

```
XDRIVE_BASE_URL=https://www.xdrivelogistics.co.uk
XDRIVE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
XDRIVE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Notes:

- Production builds must use HTTPS-only XDrive production endpoints. Browser-shell routing is not valid production mobile configuration.
- For real devices, replace with your machine LAN IP or deployed domain.

## Build Debug APK

From `android-native`:

```
./gradlew assembleDebug
```

Windows PowerShell:

```
.\gradlew.bat assembleDebug
```

APK output path:

- `android-native/app/build/outputs/apk/debug/app-debug.apk`

## Next Native Work (recommended)

1. Add push notifications (FCM) for assignment and dispatch events.
2. Add optional WorkManager recovery for OEM-specific service termination.
3. Expand instrumentation tests for authenticated login, live job visibility, notes and provider-backed POD uploads.
4. Add production signing and Play/App Distribution release promotion after staging acceptance.
