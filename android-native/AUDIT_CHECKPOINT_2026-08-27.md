# XDrive Driver Android — Final E2E Audit Checkpoint

Checkpoint time: 2026-08-27 (UK local, after 00:15)
Production client: `android-native/` Kotlin / Jetpack Compose
Production package: `co.uk.xdrivelogistics.driver`

## Firebase progress completed today

Real Firebase project created and Android app registered:

- Project name: `XDrive Logistics`
- Project ID: `xdrive-logistics-cd1fe`
- Project number / FCM sender ID: `511531957260`
- Android app nickname: `XDrive Driver`
- Android package: `co.uk.xdrivelogistics.driver`
- Android App ID: `1:511531957260:android:c8560e4d218b79c0ff8229`
- Firebase Cloud Messaging API (V1): confirmed Enabled
- Legacy Cloud Messaging API: Disabled (expected)

A Firebase Admin SDK service-account private key was successfully generated after a project-only override was applied to `iam.managed.disableServiceAccountKeyCreation`.

Security posture of that override:

- parent organisation policy remains unchanged/protected;
- project `XDrive Logistics` overrides the parent;
- effective project policy is `Not enforced` for service-account key creation;
- the downloaded JSON key is private and MUST NOT be committed to GitHub or pasted into chat/issues.

### Firebase work still pending

The generated service-account JSON has NOT yet been stored in Supabase as:

`FIREBASE_SERVICE_ACCOUNT_JSON`

This is the first Firebase task to resume.

Android release/debug environments still need the real Firebase client values supplied externally:

- `XDRIVE_FIREBASE_PROJECT_ID=xdrive-logistics-cd1fe`
- `XDRIVE_FIREBASE_APPLICATION_ID=1:511531957260:android:c8560e4d218b79c0ff8229`
- `XDRIVE_FIREBASE_SENDER_ID=511531957260`
- `XDRIVE_FIREBASE_API_KEY=<Firebase Android API key; intentionally omitted here>`

Do not commit the downloaded `google-services.json`; the native client currently initialises Firebase explicitly via `FirebaseOptions` and `BuildConfig`.

## Final read-only Android E2E audit

### Code/contract findings confirmed

1. `LoginActivity` owns login and password recovery.
2. `Keep me signed in` is implemented without persisting the user's password.
3. Forgot Password uses the native `xdrive://reset-password` recovery flow.
4. Session data is encrypted with `EncryptedSharedPreferences`.
5. Native device binding uses a generated installation UUID and server-side `driver_mobile_device_sessions`.
6. `XDriveDriverApp` initialises Firebase at process start and reconciles push/location while the app is visible.
7. One foreground `TrackingService` owns both JOB and AVAILABILITY modes while keeping their publish/privacy rules separate.
8. Active-job tracking requires Precise/Fine location and high accuracy; availability can use balanced power.
9. Active allocated-job tracking cannot be stopped by the user-facing availability/stop action while the server says tracking is required.
10. Android and live Supabase lifecycle agree on:
   `allocated/awarded -> on_my_way -> on_site_pickup -> loaded -> in_transit -> on_site_delivery -> delivered -> completed`.
11. Offline Job Status uses WorkManager, network constraint, exponential backoff and terminal-failure surfacing.
12. Offline Quote replay is durable and respects `1 driver + 1 job = 1 quote`; technical retry is idempotent rather than a second quote.
13. Offline POD replay uses deterministic Storage object names, insert-only semantics, retryable job linking and terminal-failure surfacing.
14. FCM token refresh and job deep-link notification handling exist in the native client.
15. Release Gradle configuration fails closed when production signing or Firebase client configuration is missing.

## NEW SECURITY BLOCKER FOUND IN THIS FINAL AUDIT

Problem 9 (device/session binding) is not fully runtime-closed yet.

The server device-session implementation explicitly acknowledges that old Supabase JWTs may remain valid until expiry after a newer native login. XDrive `/api/driver/mobile/*` endpoints can enforce `installation_id + auth_session_id`, but some native mutations still bypass those gated endpoints and talk directly to Supabase:

- `JobStatusSyncWorker` -> direct Supabase RPC via `ApiClient.updateJobStatus(...)`;
- `PodSyncWorker` -> direct Supabase Storage upload + REST job patch.

Therefore a superseded device can have a short residual window in which its still-valid old JWT may perform direct-Supabase mutations even after the XDrive device registry has revoked/replaced that installation.

This must be fixed before production release.

Preferred remediation to evaluate next:

1. Route Job Status and POD mutations through XDrive server endpoints that enforce the native device-session registry, or
2. introduce a server-verifiable, atomic database/device-binding mechanism for these mutation paths.

Do not weaken RLS and do not trust a client-supplied installation ID without server validation.

## Live state checked at audit time

- `driver_push_devices`: 0 rows.
- active `driver_mobile_device_sessions`: 0.
- live `driver_update_job_status_atomic` contains both `loaded -> in_transit` and `in_transit -> on_site_delivery` transitions.

These zero counts are expected before first physical installation/login, but they mean push/device-binding E2E has not yet been demonstrated on hardware.

## External/runtime evidence still missing

- `FIREBASE_SERVICE_ACCOUNT_JSON` not yet installed in Supabase Edge Function secrets.
- Exact-source deploy/verification of `notify-operational-event` still required; earlier live v8 was behind repository source for click-action.
- Supabase Auth production allow-list for `xdrive://reset-password` still requires remote confirmation/application.
- Google Play signing/upload-key lineage remains unverified.
- No genuine Gradle Android build has executed in the assistant environment; BUILD PASS must not be claimed.
- Physical-phone E2E gate has not yet been executed.

## Resume order

1. Add `FIREBASE_SERVICE_ACCOUNT_JSON` to Supabase secrets without exposing it.
2. Fix the direct-Supabase device-binding bypass in a new branch.
3. Re-audit exact diff and live contracts.
4. Redeploy/verify exact `notify-operational-event` source and FCM click-action parity.
5. Configure the Android Firebase client build values.
6. Confirm/apply Supabase Auth redirect allow-list.
7. Verify Google Play signing/upload-key lineage.
8. Run the real local Gradle build gate and record APK SHA-256.
9. Install on a physical Android phone and execute `PHYSICAL_E2E_ACCEPTANCE.md` end to end.

## Release declaration

Current state: **15/15 remediation framework implemented, but NOT production-ready / release-validated.**

The security blocker above plus Firebase secret/deploy, signing, real Gradle build and physical-phone evidence must be closed before a production-ready declaration.
