# XDrive Driver Native Android

This folder contains the canonical native Android direction for the XDrive Driver app.

## Stack

- Kotlin
- Jetpack Compose (Material 3)
- OkHttp + Gson
- DataStore / encrypted session persistence
- Google Play Services Location
- Firebase Cloud Messaging client foundation

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
- Unified foreground location runtime for periodic Availability and active-job tracking
- Foreground GPS tracking with encrypted durable retry and session refresh
- Real POD document picker upload to Supabase Storage bucket `pod-docs` and photo arrays update on `jobs`
- Authenticated FCM device registration and `job_assigned` deep-link receiver foundation

## Configure Build Properties

Create or edit `android-native/gradle.properties` on the build machine and set:

```properties
XDRIVE_BASE_URL=https://www.xdrivelogistics.co.uk
XDRIVE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
XDRIVE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY

# Required only when real Firebase Cloud Messaging is enabled for this build.
# These are Firebase Android application identifiers/configuration values, not
# the server service-account private key. Never place the service account here.
XDRIVE_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
XDRIVE_FIREBASE_APPLICATION_ID=YOUR_FIREBASE_ANDROID_APP_ID
XDRIVE_FIREBASE_API_KEY=YOUR_FIREBASE_WEB_API_KEY
XDRIVE_FIREBASE_SENDER_ID=YOUR_FIREBASE_SENDER_ID
```

Notes:

- Production builds must use HTTPS-only XDrive production endpoints. Browser-shell routing is not valid production mobile configuration.
- Firebase initialization stays disabled when any Firebase build property is blank; the app must remain usable without pretending push is configured.
- The Firebase service-account credential belongs only in the trusted server/Edge Function secret `FIREBASE_SERVICE_ACCOUNT_JSON`. Never commit it or place it in Android BuildConfig.
- The Android package registered in Firebase must be exactly `co.uk.xdrivelogistics.driver`.
- Real push delivery is not considered PASS until a registered physical device receives an assignment notification from the production/staging notification queue.

## Build Debug APK

From `android-native`:

```sh
./gradlew assembleDebug
```

Windows PowerShell:

```powershell
.\gradlew.bat assembleDebug
```

APK output path:

- `android-native/app/build/outputs/apk/debug/app-debug.apk`

## Remaining Native Foundation Work

1. Complete and physically verify FCM project/app credentials and assignment delivery.
2. Add offline action recovery for status/POD/quotes.
3. Add device/session binding and trusted-device controls.
4. Resolve native vs Expo package/signing lineage before Play release.
5. Run a genuine Gradle build/APK and physical-device E2E before declaring Android release PASS.
