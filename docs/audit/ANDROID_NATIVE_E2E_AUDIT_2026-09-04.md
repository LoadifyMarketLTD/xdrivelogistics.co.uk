# XDrive Driver Android — E2E Audit 2026-09-04

## Scope

Canonical production Android client: `android-native/` (Kotlin / Jetpack Compose)
Production package: `co.uk.xdrivelogistics.driver`
Audit basis: current `main` plus current hosted Supabase read-only state and PR #497 parity branch.

This document supersedes stale factual statements in older Android audit/checkpoint files where repository/runtime truth has since advanced. Older files remain historical evidence, not current release truth.

## Current verdict

**NOT YET E2E RELEASE PASS.**

The native application has substantially more production-grade coverage than the 27 August checkpoint recorded. The earlier direct-Supabase device-binding bypass for status/POD mutations is closed in current code, and real hosted rows now exist for native device and push registration. Remaining release blockers are primarily integration/build/physical-validation gates rather than the previously alleged lifecycle-runtime defect.

## Verified closed since the 27 August checkpoint

### Device-bound status mutation

`JobStatusSyncWorker` now uses `SecureDriverMutationApi.updateJobStatus(...)` with the native installation identity instead of directly invoking the Supabase status RPC. Device-session revocation is terminal and clears the local session rather than refreshing a revoked installation back into service.

### Device-bound POD mutation

Current contract tests require `PodSyncWorker` to use `SecureDriverMutationApi.uploadPodEvidence(...)` and explicitly reject the old direct Supabase Storage / REST job-patch path. Recipient confirmation is also required to cross the same device gate.

### Hosted runtime evidence now exists

Read-only hosted checks on 2026-09-04 found:

- `driver_push_devices`: 1 row; 1 enabled device.
- `driver_mobile_device_sessions`: 1 row; 1 active session; 0 revoked sessions.
- latest active native device seen: 2026-08-27 14:43:55 UTC.
- latest push-device update/seen: 2026-08-27 14:18:55 UTC.
- `driver_locations`: 51 historical rows; latest location is 2026-07-12, therefore this does **not** prove current tracking E2E.
- `job_bids`: 3 rows; existence alone is not accepted as proof of the complete current offline quote gate.

These rows prove that native/runtime integration has occurred, but they do not replace the physical acceptance gates.

## Canonical lifecycle truth

Hosted `driver_update_job_status_atomic` and `android-native/.../data/Models.kt` agree on:

`allocated/awarded -> on_my_way -> on_site_pickup -> loaded -> in_transit -> on_site_delivery -> delivered -> completed`

The hosted RPC also enforces:

- collection photo before `loaded`;
- strict next-state ordering;
- delivery photo(s), recipient signature and recipient name before `delivered` when POD is required;
- assignment/company authority checks;
- same-status idempotent retry.

Native transition tests explicitly reject `loaded -> on_site_delivery`, which is correct.

## MainActivity lifecycle duplication — corrected finding

`MainActivity.kt` still contains stale private extension helpers named `DriverJob.statusKey()`, `driverStatusKey()`, `isInProgress()`, `isActive()`, `hasPod()`, `isPosted()`, `routeLabel()`, `statusLabel()`, `nextStatus()`, `nextActionLabel()` and `canMoveNext()`.

`DriverJob` already defines canonical member functions with those names in `data/Models.kt`. In Kotlin, member functions take precedence over same-named extension functions. Therefore the earlier audit statement that the stale extensions were proven to shadow runtime lifecycle behaviour was incorrect.

The extensions are still technical debt and dangerous because their bodies disagree with the canonical lifecycle (for example the stale extension maps `loaded -> on_site_delivery` and normalises `in_transit -> on_site_delivery`). They must be removed so there is one lifecycle source of truth, but they are **not** retained as a demonstrated P0 runtime defect.

A second real UI consistency gap remains in `StatusTimeline`: the visible timeline omits the canonical `in_transit` step. That should be corrected during the same UI cleanup so the driver sees `Loaded -> On My Way to Delivery -> Arrived at Delivery` exactly as the model/backend enforce it.

## Expo useful-parity decision

The Expo preview remains reference-only. Before porting anything, current native code was checked to avoid duplicating existing production functionality.

Already stronger/present natively and therefore **not** to be reimplemented from Expo:

- authentication/session handling;
- live loads and quoting;
- awarded/allocated job lifecycle;
- POD/recipient confirmation;
- push/deep links;
- GPS/tracking foundation;
- invoices;
- offline status/POD/quote replay.

Two useful presentation behaviours are still genuinely missing from the current native UI:

1. persistent unread Updates count, derived from backend-authoritative `DriverNotification.readAt`;
2. privacy-safe nearby-driver presentation using already-loaded `nearbyDrivers`, exposing driver identity, vehicle label and recency only — never raw latitude/longitude.

Helper functions and focused tests for these two behaviours exist on PR #497; they still need to be wired into the real native UI and then built/tested.

## Authentication / session

Repository implementation covers:

- native launcher/login via `LoginActivity`;
- Keep me signed in without password persistence;
- encrypted session storage;
- `xdrive://reset-password` native recovery route;
- installation identity + server device session binding;
- newest-device/revocation handling foundation.

Still required for E2E PASS:

- remote confirmation that `xdrive://reset-password` is allowed by production Supabase Auth;
- physical recovery-email deep-link test;
- two-device replacement/revocation test on real hardware.

## Push / deep link

Repository implementation covers Firebase Messaging service, token refresh, notification display, `xdrive://job/{id}` job routing and general native app deep links. A real enabled push-device row now exists.

Still required for E2E PASS:

- verify trusted server `FIREBASE_SERVICE_ACCOUNT_JSON` configuration without exposing the secret;
- verify exact deployed `notify-operational-event` source matches current repository click/deep-link contract;
- physical FCM delivery with app foreground/background/terminated;
- tap notification and prove the exact assigned job opens.

## GPS / tracking

Repository contracts cover foreground tracking, active-job and availability separation, and privacy rules. Hosted historical location rows exist.

Current live evidence is insufficient: latest hosted driver location is from 2026-07-12 and there were no rows in the last 24 hours at audit time. Therefore current physical tracking is **NOT VERIFIED**.

Required physical gate: moving-device active job test, multiple current location writes, participant visibility, non-participant isolation, stop semantics and availability separation.

## Offline recovery

Repository has durable WorkManager-based recovery for:

- job status;
- POD;
- quotes.

Device-bound mutation routing is now present for the critical replay paths. This remains **code/contract verified, not physical E2E verified** until process-death/offline/reconnect tests are run on the current APK.

## Release/build blockers

The release configuration fails closed when signing or Firebase client values are missing. Current production versionCode recorded by the audit is `20260826`.

Still unresolved externally:

1. Google Play signing/upload-key lineage confirmation.
2. Real Gradle build from exact final source.
3. APK SHA-256 recording.
4. Current APK install on physical Android device.
5. Complete `PHYSICAL_E2E_ACCEPTANCE.md` gates A–N with ADB/server evidence.

GitHub Actions runs that fail with no executed steps/logs are infrastructure non-signals: they are neither Android code FAIL nor release PASS.

## PR #497 interaction

PR #497 remains DRAFT and separate from Production. It is being used to:

- make `android-native/` unambiguously canonical;
- quarantine Expo as preview/reference;
- selectively port only useful missing behaviour;
- remove stale lifecycle duplication;
- align visible lifecycle UI with the canonical model/backend;
- hold Android E2E corrections until validated.

No merge to `main` is authorised by this audit alone.

## Required continuation order

1. Remove stale `DriverJob` lifecycle extensions from `MainActivity.kt` and use canonical `Models.kt` members only.
2. Add `in_transit` to the visible native status timeline.
3. Wire backend-authoritative unread Updates count into persistent bottom navigation.
4. Render already-fetched `nearbyDrivers` privacy-safely in native UI.
5. Re-run focused Kotlin tests and obtain a genuine Gradle debug build.
6. Record APK SHA-256/version/source SHA.
7. Verify Firebase server/client configuration and deployed notification source.
8. Verify production reset-password allow-list and Play signing lineage.
9. Execute physical gates A–N on a real Android phone and correlate ADB/Supabase evidence.
10. Only then declare Android Native E2E / release PASS.
