# XDrive Driver Rebuild — Runtime Continuation Checkpoint — 2026-09-06

## Parent checkpoint

Continue from, do not replace or reinterpret:

`docs/checkpoints/XDRIVE_DRIVER_REBUILD_AUTONOMOUS_CHECKPOINT_2026-09-06.md`

## Repository / PR

- Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
- Branch: `driver/phone-golden-20260718-modernization`
- PR: `#510 — Driver phone GOLDEN recovery and modernization`
- PR state at this checkpoint: **OPEN / DRAFT / NOT MERGED**
- Base: `main`
- Base SHA remains: `60c2693316fbf420fa4ad7c0f0956def1434cb1f`
- HEAD after runtime hardening: `c766fad34e3c127d5759157a39d2535e0f6c400a`

## Absolute safety rules still in force

- No GitHub Actions as validation evidence.
- No Production DB migration.
- No Netlify Production deployment.
- Do not merge PR #510.
- Do not modify `main`.
- Do not import PR #503.
- Do not use `android-native` as the base.
- Do not uninstall, replace, overwrite or otherwise alter the phone GOLDEN package.
- GOLDEN package remains `co.uk.xdrivelogistics.driver`.
- Preview candidate must be `co.uk.xdrivelogistics.driver.preview`.
- Physical PASS must not be claimed without Pixel evidence and user visual approval.

## Runtime work completed after parent checkpoint

### 1. Preview Android identity is fail-closed for debug and release

`apps/xdrive-driver-phone-golden/android/app/build.gradle`

- Preview application id is selected globally from `XDRIVE_SIDE_BY_SIDE_PREVIEW`:
  - Preview: `co.uk.xdrivelogistics.driver.preview`
  - non-Preview: `co.uk.xdrivelogistics.driver`
- Preview custom URL scheme:
  - Preview: `xdrivedriver-preview`
  - non-Preview: `xdrivedriver`
- Preview launcher label remains `XDrive Driver Preview`.
- The previous release-only `applicationIdSuffix` dependency is removed so debug cannot accidentally target the GOLDEN package.

`android/app/src/main/AndroidManifest.xml`

- Custom scheme now uses Gradle manifest placeholder `${xdriveDriverScheme}`.

### 2. Native Android location bridge added

Added:

- `android/app/src/main/java/co/uk/xdrivelogistics/driver/XDriveLocationModule.kt`
- `android/app/src/main/java/co/uk/xdrivelogistics/driver/XDriveLocationPackage.kt`

Registered in `MainApplication.kt`.

The native bridge reads current GPS/network position only after Android permission exists, uses a fresh last-known position when appropriate, otherwise waits for a position with a bounded timeout, and cleans listeners.

### 3. Device-bound active-job tracking added

Added:

`src/tracking/nativeLocation.ts`

Privacy/security gate:

1. Before requesting GPS permission or reading position, the app calls the authenticated device-bound route:
   `/api/driver/mobile/jobs?scope=active`
2. If the server does not confirm an active job, tracking stays `standby` and GPS is not read.
3. When active work exists, the app publishes through existing verified contract:
   `POST /api/driver/location`
4. `apiRequest` preserves the existing installation/device identity headers.

V2 publishes while active work exists at a 30-second foreground cadence.

Tracking UI is no longer fake/hard-coded `Active`; it displays real state:

- Standby
- Starting
- Active
- Permission
- Unavailable

### 4. Notification response / deep-link handling added

Added:

`src/push/driverDeepLinks.ts`

V2 handles:

- `Linking.getInitialURL()`
- runtime URL events
- `Notifications.getLastNotificationResponseAsync()`
- notification-response events

Accepted navigation targets are restricted to XDrive schemes/domains and job/load identifiers. Job notifications can open an internal booking. Load notifications can open a known load or route to Live Loads and refresh.

No unverified server-side push or messaging endpoint was invented.

### 5. Live Loads / Quotes hardening

V2 now consumes `fetchLiveLoads()` directly. Quote-state enrichment remains inside the verified Live Loads API layer.

Already-quoted loads:

- remain visible in Live Loads;
- are non-quotable;
- show quote warning/status;
- cannot be submitted again even if the quote screen is reached indirectly;
- remain managed from Quotes.

Withdraw refreshes both quote resources and Live Loads.

### 6. Login overlap

The deliberate negative login-card overlap was removed:

- old `marginTop: -22`
- new bounded separation `marginTop: 16`

This is only a source-level fix until physically seen on the Pixel. Do not declare the ghost/double-layer gate closed before visual evidence.

### 7. Fixed shell

Existing V2 fixed-shell structure remains intact:

- fixed top chrome outside body scroll;
- body is the bounded `ScrollView`;
- bottom navigation remains outside body scroll;
- lifecycle fixed action remains above bottom navigation.

Physical verification is still required.

### 8. Static runtime contract test added

`__tests__/driverPhoneGoldenPreviewRuntimeContract.test.ts`

Covers source contracts for:

- quoted loads remaining visible and duplicate quote prevention;
- login negative-overlap removal;
- fixed shell markers;
- active-job GPS privacy gate;
- `/api/driver/location` publishing;
- notification/deep-link handlers;
- Preview package/scheme isolation.

Note: this branch currently contains a pre-existing test-infrastructure inconsistency: `__tests__` use Vitest conventions, while this HEAD does not declare Vitest in the root package/lock and does not contain `vitest.config.ts`. Do not broaden this Driver workstream by silently repairing global test infrastructure. Use the app-local TypeScript dependency tree and fail-closed source checks for the immediate Preview build gate.

## Gate that now requires the user's Windows checkout / physical phone

Checkout:

`C:\Users\Danny\xg`

Phone:

- Google Pixel 10 Pro XL
- ADB serial: `57311FDCQ00BGS`

Required next sequence:

1. Fail closed if local checkout has uncommitted changes.
2. Fetch and fast-forward only the exact Driver branch.
3. Confirm local HEAD equals this checkpoint HEAD.
4. Install/use app-local dependencies from its lockfile.
5. Run app-local `npm run typecheck`.
6. Run source-level contract checks without GitHub Actions.
7. Build Android locally with `XDRIVE_SIDE_BY_SIDE_PREVIEW=true`.
8. Use `aapt` to prove APK package is exactly `co.uk.xdrivelogistics.driver.preview` before install.
9. Verify GOLDEN exists before installation and capture its APK SHA-256.
10. Install/update only the `.preview` APK.
11. Verify GOLDEN still exists and its SHA-256 is unchanged.
12. Launch Preview.
13. Continue physical E2E: login, no ghost/double layer, light UI, fixed shell, Live Loads, quote submit/edit/withdraw, bookings/history/detail, multi-stop, lifecycle, pickup evidence, POD, offline replay, active-job tracking, notification/deep-link behavior.
14. User must visually approve before any replacement/release claim.

## Release truth

At this checkpoint the repo-side runtime implementation has advanced, but the candidate is **NOT declared PASS, finalized, Production-ready, or replacement-ready**. Physical-device evidence remains mandatory.
