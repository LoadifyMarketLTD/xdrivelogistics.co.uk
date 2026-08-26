# XDrive Driver Mobile Preview

This Expo / React Native application under `apps/driver-mobile/` is an **internal preview and behavioural reference**. It is not the production Android application and must not be submitted to the Play Store as XDrive Driver.

## Canonical production owner

- Production Android source: `android-native/`
- Framework: Kotlin / Jetpack Compose
- Production Android package: `co.uk.xdrivelogistics.driver`
- Expo preview package: `co.uk.xdrivelogistics.driver.preview`

The Expo project may be used to compare flows, prototype UX and run internal APK tests. Useful behaviour must be rebuilt or verified in `android-native/` before it becomes a production Android feature.

## Preview scope

- Driver login and session reference flows.
- Job lifecycle reference screens.
- Live-load and quote UX reference.
- POD/photo/signature reference flows.
- Push and offline-retry reference implementations.

## Commands

```bash
npm install
npm run start
npm run android
npm run build:android:apk
```

From the repository root:

```bash
npm run mobile:dev
npm run mobile:android
npm run mobile:apk
```

## Expo / EAS preview project

- Organization: `xdrive-logistics-ltd`
- Project ID: `c19b0bdf-567a-488e-b78f-d36b84f25c99`
- Android package: `co.uk.xdrivelogistics.driver.preview`
- iOS bundle ID: `co.uk.xdrivelogistics.driver.preview`
- Distribution: internal preview APK only

`eas.json` intentionally contains no Play Store production profile and no submit profile. Do not add a production AAB/store path to this preview application.

The preview app can bootstrap public Supabase configuration from `https://www.xdrivelogistics.co.uk/api/driver/mobile/config` or use preview EAS environment values when explicitly configured.

## Architecture rules

- Backend remains the source of truth.
- The preview client does not decide critical business transitions.
- Shared server APIs may remain compatible with the preview while it exists.
- Production Android features belong in `android-native/`.
- `co.uk.xdrivelogistics.driver` is reserved exclusively for the Kotlin production application.
- Expo preview signing credentials, if any exist in EAS, must never be treated as the production Android signing lineage.
