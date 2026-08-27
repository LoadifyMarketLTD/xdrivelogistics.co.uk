# XDrive Driver Mobile

`apps/driver-mobile/` is the canonical XDrive Driver application source for the Android production candidate.

## Production identity

- Framework: Expo / React Native
- Android package: `co.uk.xdrivelogistics.driver`
- iOS bundle ID: `co.uk.xdrivelogistics.driver`
- API base: `https://www.xdrivelogistics.co.uk`
- Backend and Supabase remain the source of truth for authorization, job state, quoting, POD, tracking and notifications.

The retired Kotlin implementation under `android-native/` is no longer the production owner. Useful backend/security contracts created during that work are retained and must be consumed by this app where they improve security or reliability.

## Core driver flows

- Driver authentication and server authorization
- Live Loads / marketplace and quoting
- Active jobs and complete operational lifecycle
- Job detail, stops and status history
- POD photo/document/signature workflow
- Offline action queue and retry
- Notifications and push registration
- Driver profile/resources
- Device-bound authenticated API access

## Security contract

Authenticated API requests use the current bearer token together with a persistent per-installation UUID stored in Expo SecureStore. The client registers the installation through `/api/driver/mobile/device-session`; protected server routes remain authoritative and fail closed when a registered mobile session has been revoked or superseded.

Push registration uses the native Android device token and `/api/driver/push-devices`, bound to the same installation and authenticated session.

The installation UUID is an application identity only. It is not a hardware fingerprint.

## Commands

```bash
npm install
npm run typecheck
npm test
npm run start
npm run android
```

A production-candidate internal APK profile is defined as `production-apk` in `eas.json`. Do not publish or submit a store build until signing lineage, Firebase delivery, backend contracts and physical-device E2E are all verified.

## Release gates

Before any APK is handed to a tester:

1. TypeScript typecheck and mobile unit tests must pass.
2. Server/mobile contract tests must pass.
3. Device-session registration and revocation must work against the production backend.
4. Live Loads, quote, lifecycle, POD, offline retry, tracking/availability, push/deep links and return journey must be reconciled with the current site/backend contracts.
5. Existing Android signing lineage must be confirmed; never generate a replacement production keystore.
6. Firebase production configuration must be verified without exposing credentials.
7. Only then build, inspect and install the APK for physical E2E testing.
