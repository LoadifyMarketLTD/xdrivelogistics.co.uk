# XDrive Driver Native Android

This folder contains the native Android migration baseline for the XDrive Driver app.

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
- Job status transitions from native UI (`on_my_way`, `loaded`, `delivered`)
- Delivery completion guard: `delivered` requires existing POD evidence
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
2. Add WorkManager periodic location sync for robust background delivery.
3. Add complete status chain UI (`on_site_pickup`, `in_transit`, `on_site_delivery`) and proof capture checkpoints.
4. Add instrumentation tests for login, jobs visibility, note submission, and POD upload.
5. Add Gradle wrapper and CI build lane for automatic APK artifacts per commit.
