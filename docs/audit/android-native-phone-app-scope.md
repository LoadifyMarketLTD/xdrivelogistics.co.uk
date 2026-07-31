# XDrive Driver Android — Phone App Functional Audit

## Canonical target

- Application: `android-native/`
- Package: `co.uk.xdrivelogistics.driver`
- Stack: Kotlin + Jetpack Compose
- Device target: the production Android application installed on the driver's phone

## Explicit exclusions

This pull request must not implement or modify:

- `apps/driver-mobile/` Expo preview
- `/m` mobile-web workspace
- web launcher behaviour unless a native-app deep-link contract is strictly required
- unrelated marketplace, dashboard, or admin functionality

## Functional audit scope

The audit and corrective implementation cover the real driver workflow end to end:

1. Authentication, session restore, refresh, expiry and logout.
2. Live Loads discovery, job details, eligibility and quote submission.
3. Quote retry/idempotency and offline persistence.
4. Awarded/allocated job receipt and notification routing.
5. Job detail visibility and assignment ownership.
6. Accept Job.
7. On My Way to Pickup.
8. Arrived at Pickup.
9. Collection proof and Loaded/Collected.
10. On My Way to Delivery.
11. Arrived at Delivery.
12. POD evidence, recipient confirmation, signature requirements and Delivered.
13. Offline lifecycle queue, pending-sync UX and recovery after process death.
14. FCM notifications and deep links.
15. GPS/location publication and foreground tracking.
16. Dispatcher messages and Updates.
17. SmartPay, invoices and finance visibility.
18. Documents, profile, availability and settings.
19. API authentication headers, server contracts and error handling.
20. Build, unit, instrumentation and device-install validation.

## Initial confirmed risks to verify and repair

- Authenticated Android API calls must send `Authorization: Bearer <access token>`.
- The `awarded -> allocated/accepted` contract must be unambiguous and actionable on Android.
- `current_status` must be canonical and usable for every operational assignment.
- A new intentional quote must not be mistaken for a retry of an older identical quote.
- POD requirements must match the actual Android UI, including recipient and signature behaviour.
- Queued offline actions must expose a visible pending-sync state and prevent duplicate taps.

## Change restrictions

- Keep the PR Draft until the phone-app workflow is functionally verified.
- Do not merge to `main`.
- Do not deploy.
- Do not run production Supabase migrations.
- Do not publish APK/AAB or promote signing keys.
