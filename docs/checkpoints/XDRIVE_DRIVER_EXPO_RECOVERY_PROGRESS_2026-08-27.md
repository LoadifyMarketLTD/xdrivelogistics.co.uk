# XDrive Driver Expo Recovery — E2E Audit Progress Checkpoint

Date: 2026-08-27
Branch: `fix/android-agp-86-build-20260827`
Starting checkpoint: `848f88ed9581e5f5c5b5e069fe8e70274da3267a`
Audited historical baseline: `ac96941609bfb97f9c8b1dc46c121daa9c89b064`
Pre-checkpoint main observed: `a0e62732d3ebe1c2ee46e0175a0366ff724fba29`
Recovery basis: `apps/driver-mobile` Expo / React Native.

## Non-negotiable boundaries preserved

- Expo/React Native remains the production mobile application basis.
- `android-native` / Kotlin is not reintroduced as the application.
- No Netlify deploy performed.
- No Supabase db push, migration repair, hosted schema mutation, or migration deletion performed.
- No APK/EAS production build or physical install performed.
- No Workspace / Super Admin visual changes performed.
- No Loadify Market code mixed into this workstream.
- Useful backend/security migrations created during the Kotlin period remain eligible to KEEP based on contract value, not implementation-era origin.

## Repo and hosted state established

- Starting recovery branch was exactly at checkpoint `848f88ed...` when the pass began.
- At that point the branch was 37 commits ahead of `main` and 0 behind.
- Hosted Supabase project confirmed as `xdrivelogistics` (`jqxlauexhkonixtjvljw`), ACTIVE_HEALTHY.
- `register_driver_mobile_device_session` implements production-package validation, driver/app-access validation, auth-session comparison and newest-login-wins / monotonic binding semantics.
- Expo config currently identifies production package/bundle `co.uk.xdrivelogistics.driver`, scheme `xdrivedriver`, and `productionOwner: apps/driver-mobile`.
- Signing lineage is not yet proven and remains a release gate.

## Changes committed during this recovery pass

### 1. Device-session revocation helper
Commit: `346fd89b056048773a308fb4ace1007a6bc0fad1`

File: `apps/driver-mobile/src/auth/deviceSession.ts`

Added an authenticated DELETE helper for `/api/driver/mobile/device-session`, using the installation id and bound bearer session. This creates the correct explicit logout primitive. Wiring into the large app-level logout handler remains pending.

Classification: **REPAIR**.

### 2. Push-device unregister helper
Commit: `4a1bc9746eb5d5078065b6bfb2e66f8d54cc4dfa`

File: `apps/driver-mobile/src/push/registerPushToken.ts`

Added uninstall/logout-time registration removal via `/api/driver/push-devices` keyed by installation id. The correct final logout order is push unregister -> mobile device-session revoke -> Supabase auth sign-out -> local account data cleanup.

Classification: **REPAIR**.

### 3. Return journey bound to hardened mobile identity
Commit: `a36e1a09844e1fdcceb47169418f93b8226d52b3`

File: `app/api/driver/return-journey/route.ts`

Removed its fragmented legacy auth resolver and moved GET/PUT through the common `requireDriver` / active-device-session boundary while preserving existing database compatibility behavior.

Classification: **CONSOLIDATE -> repaired**.

### 4. Live Loads / quote path consolidated
Commit: `80a664a422c606634604269f742a343ea9d6cff1`

File: `apps/driver-mobile/src/api/liveLoads.ts`

Removed operational raw-fetch/direct-Supabase fragmentation:

- nearby jobs now use the bound central API client;
- current bid state now uses `/api/driver/mobile/bids` rather than reading `job_bids` directly from the mobile client;
- quote submission now uses the same bound server-authoritative API path.

This preserves real operational data from XDrive and does not turn the mobile application into an administrative client.

Classification: **CONSOLIDATE -> repaired**.

## Functional classification

| Area | Verdict | Current finding |
| --- | --- | --- |
| Expo production basis | KEEP | Correct application basis. Do not restore Kotlin app. |
| App identity/package/scheme | KEEP | Current Expo config is production-shaped; signing lineage remains unverified. |
| Central API client + device binding | KEEP | `apiRequest` establishes active installation/session context. |
| Newest-login-wins mobile-session RPC | KEEP | Security foundation is valuable and independent of Kotlin UI. |
| Explicit logout cleanup | REPAIR | Helpers now exist; app-level `signOut()` still needs to call them before Supabase sign-out. |
| Driver API authorization boundary | KEEP | `requireDriver` is the canonical mobile authorization/device boundary. |
| Return journey auth | CONSOLIDATE | Repaired to use canonical driver boundary. |
| Live Loads operational reads | CONSOLIDATE | Repaired to central server API; no direct mobile `job_bids` read. |
| Quote submission/idempotency | KEEP | Server helper validates amount, uses driver identity and protects duplicate semantics. |
| Job lifecycle/status | KEEP | Server-authoritative transition path / atomic RPC remains the authority. |
| Offline status/POD queue | KEEP | Queue does not fake local status before server confirmation; replay still requires test gate. |
| POD storage validation | KEEP | Server checks actual POD artifacts before confirmation. |
| Availability backend | KEEP | Bound to driver/device context and operational rules. |
| Availability Expo UX | REPAIR | API bridge exists but is not yet fully integrated into active Expo app UX. |
| Return-journey Expo UX | REPAIR | API bridge exists; active app integration remains incomplete. |
| Tracking backend | KEEP | Hardened server routes remain valuable. |
| Tracking Expo integration | REPAIR | `operations.ts` bridge exists but the main Expo app does not yet consume it as operational/background tracking. |
| Push token registry/backend | KEEP | Native Android token registration uses production package + installation id. |
| Push logout cleanup | REPAIR | Unregister helper exists; app-level logout wiring pending. |
| Push notification navigation | REPAIR | No proven notification-response handler routing into the relevant job screen. |
| App/deep links | REPAIR | Expo scheme/intent identity exists, but initial/runtime deep-link handling is not yet proven. |
| Direct operational Supabase reads from Expo | REMOVE after replacement | Mobile operational state should flow through XDrive server-authoritative APIs. |
| Kotlin/android-native production app | REMOVE as app basis | Do not reintroduce. Backend/security work from the same era is evaluated separately. |
| Useful 26-27 Aug Supabase migrations | KEEP | Preserve by contract value; do not delete/repair blindly. |

## Supabase migrations explicitly preserved in this pass

At minimum the following are server/security foundations and remain **KEEP** candidates:

- `20260826103000_driver_availability_presence.sql`
- `20260826132000_driver_push_devices.sql`
- `20260827005000_driver_mobile_session_monotonic_login.sql`

Additional 26-27 August migrations must continue to be classified by the database/API contract they provide. No migration is to be removed merely because it was created during the Kotlin period.

## Release gates — current truth

1. Identity/session boundary: **PARTIAL PASS / REPAIR OPEN** — server binding is hardened; explicit logout wiring remains.
2. API compatibility: **PARTIAL PASS** — return journey and Live Loads fragmentation repaired; remaining direct operational access must continue to be audited.
3. Quote/award/lifecycle: **STATIC CONTRACT PASS / EXECUTION TEST OPEN**.
4. Offline replay: **STATIC BEHAVIOUR KEEP / EXECUTION TEST OPEN**.
5. Tracking: **BLOCKED — Expo integration incomplete**.
6. Availability/return journey: **BLOCKED — Expo UX integration incomplete**.
7. Push/deep links: **BLOCKED — navigation/deep-link handling incomplete and logout wiring open**.
8. POD: **STATIC CONTRACT KEEP / execution and physical capture gate open**.
9. Identity/signing: **BLOCKED — certificate/signing lineage not proven**.
10. Typecheck/tests/contracts: **NOT CLAIMED PASS**. No current CI status exists on the recovery HEAD and the audit environment could not run the repository locally. A historical test count is not accepted as evidence for this HEAD.
11. APK/EAS build/install: **NOT AUTHORIZED BY GATES — do not run yet**.

## Next safe execution order

1. Wire app-level logout to unregister push + revoke bound device before Supabase sign-out.
2. Complete remaining API/direct-Supabase audit in Expo.
3. Integrate tracking state + foreground/background location publication with operational job-state gates.
4. Integrate availability/return journey into driver-oriented UX only.
5. Add notification response and deep-link routing to real job detail/status context.
6. Re-run POD/status/quote/offline contract coverage after integration.
7. Run Expo typecheck/tests and repository contract suites.
8. Verify Android signing lineage/package identity without exposing secrets.
9. Only after all gates pass, allow a production APK build; physical installation remains the final acceptance stage.

## Stop conditions

Do not claim release-ready while any of tracking, availability/return journey integration, push/deep-link navigation, logout binding cleanup, tests, or signing lineage remains unverified.
