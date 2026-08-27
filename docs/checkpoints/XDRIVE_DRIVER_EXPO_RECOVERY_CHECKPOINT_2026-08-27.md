# XDrive Driver Expo Recovery Checkpoint — 2026-08-27

## Purpose

Continue the XDrive Driver mobile recovery from this checkpoint. The product direction is now fixed: preserve and modernize the valuable Expo / React Native driver application under `apps/driver-mobile/`; do not rebuild the product in Kotlin.

## Repository / branch

- Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
- Working branch: `fix/android-agp-86-build-20260827`
- Kotlin implementation under `android-native/` was deliberately removed from this branch in commit `8ad00fa2a657e1af2356ffe7335c0d1eea6d9d55` (`chore(android): remove Kotlin driver app implementation`).
- Do not reintroduce `android-native/` as the production app.
- Do not merge to `main` or deploy until the Expo recovery and E2E gates are complete.

## Historical good mobile baseline

Primary historical candidate for the previously valuable app:

- Commit: `ac96941609bfb97f9c8b1dc46c121daa9c89b064`
- Historical intent: preserve Driver Mobile lifecycle, POD and marketplace implementation.
- App path: `apps/driver-mobile/`
- Historical app identity at that commit: `XDrive Driver`, slug `xdrive-driver`, Android package `co.uk.xdrivelogistics.driver`, scheme `xdrivedriver`.
- Historical UI/state model includes: `login`, `liveLoads`, `active`, `jobs`, `detail`, `pod`, `viewPod`, `notifications`, `profile`.
- Historical app has Live Loads / marketplace, quote flow, job lifecycle, POD/photo/signature, offline queue, notifications and account-scoped state.
- Assets include `apps/driver-mobile/assets/xdrive-native-logo.jpeg`, `icon.png`, splash and Android icon assets. The exact historical login-image match still needs visual confirmation, but this is the strongest current candidate for the app the user previously had installed.

## Current product requirement

The phone app must be an operational delivery-driver application, Courier Exchange-like in purpose, not a generic account/admin dashboard.

Core UX must center on:

- current/next work;
- Live Loads / marketplace;
- quote / offer submission and status;
- awarded / allocated work;
- job detail with pickup, delivery, times and operational instructions;
- lifecycle: `allocated/awarded -> on_my_way -> on_site_pickup -> loaded -> in_transit -> on_site_delivery -> delivered -> completed`;
- live tracking only in correct operational contexts;
- POD with photo/document/signature/recipient confirmation;
- notifications;
- availability / future position / return journey;
- offline-safe job actions and replay.

Real operational XDrive platform data MUST flow into the app. The previous problem was the wrong UX/product direction, not data synchronization.

## Backend / Supabase improvements to KEEP

Do not delete useful backend/security work merely because it was introduced while Kotlin existed. Keep or adapt framework-independent functionality.

Confirmed useful items include:

- `driver_mobile_device_sessions` and device/session binding;
- monotonic/newest-login-wins session registration;
- `driver_push_devices`;
- secure mobile mutation gates;
- server-authoritative job status routes;
- POD evidence and delivery confirmation hardening;
- single quote per driver/job and idempotency guards;
- secure tracking share and tracking state;
- availability presence;
- return journey support;
- notification inbox / push infrastructure;
- security-definer/RLS hardening and related security migrations.

Hosted Supabase project: `jqxlauexhkonixtjvljw`.

Important: migration histories are already divergent. Do NOT use `supabase db push`, migration repair, or casual `db pull`. Any hosted DDL must be deliberate and narrowly reviewed.

Latest production fix applied today: installation conflict in `register_driver_mobile_device_session` was corrected by targeting the PK constraint; hosted function was verified fixed. Keep this unless a later audit proves the entire device-binding design should be replaced.

## Expo gaps identified so far

### CRITICAL / REPAIR

1. Expo was later demoted to preview identity:
   - `XDrive Driver Preview`
   - package `co.uk.xdrivelogistics.driver.preview`
   - scheme `xdrivedriverpreview`
   - `productionOwner: android-native`
   This is now obsolete because Kotlin was removed. Restore one coherent production ownership model only after signing lineage is verified.

2. Current Expo push registration is stale:
   - `apps/driver-mobile/src/push/registerPushToken.ts` still uses Expo push token flow and `/api/driver/mobile/device-token`.
   - Newer backend has `/api/driver/push-devices` with `installation_id`, active device-session binding and Android package validation.
   - Reconcile this rather than weakening the backend.

3. Device/session binding is not fully integrated into the Expo client. Expo sign-in currently obtains a Supabase session and validates driver authorization but does not yet perform the full installation/session registration contract required by the hardened backend.

4. Tracking / availability capability added later must be ported/adapted into Expo. Do not restore Kotlin UI; reuse only the good behavior/contracts.

5. POD/status/quote client calls must be checked against current server-authoritative routes and device binding.

6. Push deep links, return journey and availability/future-position UX must be integrated into the old operational app flow.

7. Production signing lineage must be verified before any production package/AAB decision. Never generate a replacement keystore just to make a build pass.

8. Firebase / notification credentials must remain secret and be verified through environment/build configuration; never commit secrets.

## Known current Expo code behavior

`DriverMobileApp.tsx` currently still contains the valuable operational flow and account-scoped offline queue. Sign-in uses Supabase `signInWithPassword`, validates driver authorization through the backend, loads jobs/resources, registers push and flushes queued actions. Job status transitions do not optimistically advance the local server state; failed actions are queued for retry. POD is gated before delivery.

This is a good base. Do not replace it wholesale with a new dashboard.

## Audit / implementation method

For each feature classify it as:

- KEEP — already correct and valuable;
- REPAIR — same feature, current contract mismatch or bug;
- CONSOLIDATE — duplicate implementations or newer backend/Kotlin behavior should be merged into Expo;
- REMOVE — obsolete Kotlin-only/preview-only behavior with no remaining product value.

Audit both site and app E2E. Map each mobile capability to the current site/backend/Supabase contract before implementing.

## Required release gates before any APK is handed to the user

1. Expo typecheck PASS.
2. Expo unit tests PASS.
3. Relevant repository contract tests PASS.
4. Device-session / login / logout / newest-login-wins contract PASS.
5. Live Loads / quote / award / active-job lifecycle contract PASS.
6. Offline replay for status / quote / POD PASS.
7. Tracking start/stop/privacy behavior PASS.
8. Availability / return journey PASS.
9. Push registration / revocation / deep-link routing PASS.
10. POD evidence + recipient confirmation PASS.
11. Production identity/signing configuration audited.
12. APK build and static artifact inspection PASS.
13. Only then physical-device E2E install/test.

Do not claim a gate PASS without current evidence.

## Operational constraints

- No APK installation until the integration audit is complete enough to justify device testing.
- No paid Android GitHub CI.
- No Netlify deploy from this recovery work unless explicitly authorized.
- No destructive Supabase cleanup unless an object is proven obsolete and its dependencies are understood.
- Do not modify Workspace / Super Admin visuals as part of this mobile recovery.
- Do not import visual changes from PR #359 into Workspace.
- Do not mix Loadify Market work into XDrive.

## User workflow preference

When local machine interaction is required, give exactly ONE runnable PowerShell/code block at a time, wait for its output, then provide exactly ONE next block. Do not stack multiple runnable blocks.

## Immediate continuation point

Continue from this checkpoint by auditing and then implementing the Expo recovery feature-by-feature, starting with the identity/session boundary and current Expo/backend API compatibility. Do not spend time rebuilding Kotlin or creating a new mobile architecture.

Before changing code, re-read:

- this checkpoint;
- `apps/driver-mobile/` current branch;
- historical `apps/driver-mobile/` at `ac96941609bfb97f9c8b1dc46c121daa9c89b064`;
- current `app/api/driver/**` and tracking routes;
- relevant Supabase migrations from 2026-08-26 and 2026-08-27.

Then continue autonomously with KEEP / REPAIR / CONSOLIDATE / REMOVE decisions and concrete fixes on the existing working branch.