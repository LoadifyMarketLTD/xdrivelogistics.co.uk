# XDrive Driver V3 — Full Runtime Contract Audit — 2026-09-06

## Scope

- Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
- Branch: `driver/phone-golden-20260718-modernization`
- PR: #510 — Driver phone GOLDEN recovery and modernization
- PR remains DRAFT / NOT MERGED.
- No GitHub Actions validation.
- No Production DB migration.
- No Netlify Production deploy.
- GOLDEN APK must never be uninstalled or overwritten.

## Physical evidence before this audit

- GOLDEN package: `co.uk.xdrivelogistics.driver`
- GOLDEN version: `1.0.0` / versionCode `1`
- GOLDEN canonical SHA-256: `81f0e825a5899c90c34cd6a34af8104ce37c8be42ca4b3dcf9a7b978ee916f74`
- Preview package: `co.uk.xdrivelogistics.driver.preview`
- V3 visual shell physically validated on Pixel.
- Login ghost/double-layer resolved.
- Fixed shell physically confirmed.
- V3 information architecture differentiated from CX:
  - Overview
  - Loads
  - Offers
  - History
  - Account
- History target is full chronological work history with no date-period tabs.

## Root cause found by full audit

PR #510 is based on a recovered July tree and is heavily diverged from current `main`. The branch contains modern V3 mobile-client expectations mixed with stale/missing server contracts. This caused authenticated requests to fail before reaching Resources, Loads, Offers and Jobs.

The visible physical symptoms were:

- Overview fell back to `XDrive Driver` / `Vehicle no assigned`.
- Loads showed `Network request failed`, followed by `Device session registration failed with HTTP 500` once the local bridge was repaired.
- Real marketplace jobs did not render.
- Offers/profile resources disappeared behind the same request gate.

## Production data verification — read only

The problem is not missing data.

Verified in the hosted XDrive database:

- driver record exists and is active;
- app access is enabled;
- profile status is active;
- driver type is `owner_driver`;
- commercial bidding is enabled;
- assigned vehicle exists: `KM57CXL`, `luton_tail_lift`;
- 6 marketplace jobs are currently eligible under the XDrive marketplace contract;
- 3 accepted job bids exist for the driver identity;
- `driver_mobile_device_sessions` exists;
- `register_driver_mobile_device_session` RPC exists.

No Production database mutation was required for these checks.

## Critical contract defects found

### 1. Mobile client required a route absent from the branch

The shared API client calls `ensureNativeDeviceSession()` before every authenticated mobile request. The client POSTs to:

`/api/driver/mobile/device-session`

but the recovered branch did not contain that route.

Result: one missing server contract blocked Resources, Loads, Offers and Jobs together.

### 2. Preview impersonated the canonical GOLDEN package

`apps/xdrive-driver-phone-golden/src/auth/deviceSession.ts` hardcoded:

`co.uk.xdrivelogistics.driver`

including in a side-by-side `.preview` build.

This defeated package isolation at the server-device-registry layer.

The physical Preview login at approximately 10:47 UTC created a new canonical-package native binding with a different installation ID and auth-session ID from the previous binding. The GOLDEN APK bytes remained untouched, but the server-side newest-native-login registry was replaced.

No manual Production registry rewrite is authorised by this audit. The final GOLDEN server binding must be re-established through the GOLDEN application itself after Preview validation.

### 3. Mobile backend device gate had regressed

The recovered branch `_lib.ts` authenticated bearer + driver status but did not enforce the native installation/session binding present in current `main`.

This was a security regression, independent of the visual failure.

### 4. Location publisher targeted a stale bearer-only location endpoint

The native location publisher was added to V3, but the branch location endpoint did not require an active native device session.

### 5. Job history/lifecycle query was stale

The branch jobs endpoint filtered only legacy `status` values and missed modern `current_status` lifecycle aliases.

History also needed to preserve the V3 decision: one full chronological log, with no 7/14/365-day UI period contract.

### 6. Evidence uploader had no concrete route

The mobile client uploads collection/delivery evidence to:

`/api/driver/mobile/jobs/{id}/evidence`

but the branch had only the dynamic `[action]` route. `evidence` would therefore be treated as an unsupported lifecycle action, blocking Loaded/POD E2E.

### 7. Additional stale backend surface remains to reconcile before final release

Compared with current main, the recovered branch still has reduced job-detail/history/presentation surface. Before final release gate, reconcile deliberately rather than merging main wholesale:

- job detail presentation / multi-stop support;
- confirmation / notes / stop-status contracts where V3 uses them;
- signed attachment/POD presentation;
- Resources partial-degradation behavior;
- final location/tracking semantics;
- notification/deep-link end-to-end behavior;
- message contract only if a verified production endpoint exists.

Do not reintroduce date-period History behavior when reconciling main.

## Fixes applied by this audit

### Preview identity

Mobile device-session registration now derives the actual Expo Android package at runtime. A Preview build therefore reports:

`co.uk.xdrivelogistics.driver.preview`

instead of impersonating the GOLDEN package.

### Device-session route restored

Added:

`app/api/driver/mobile/device-session/route.ts`

Canonical production registration accepts only the canonical package and uses the hosted newest-native-login RPC.

For physical real-data Preview testing only, a bypass is permitted when all conditions hold:

- `XDRIVE_LOCAL_PREVIEW_DEVICE_BYPASS=true`;
- request host is loopback (`127.0.0.1`, `localhost` or `::1`);
- app package is exactly `co.uk.xdrivelogistics.driver.preview`.

The bypass still authenticates the Supabase user and active driver but returns success without writing the production device-session registry.

### Mobile API gate restored

`app/api/driver/mobile/_lib.ts` now restores:

- active profile validation;
- active driver validation;
- strict `app_access=true`;
- native installation + auth-session binding outside the explicit loopback Preview gate;
- driver type / commercial-bid context;
- broader lifecycle normalization.

### Location route hardened

`app/api/driver/location/route.ts` now requires the shared active-native-session gate, with the same explicit loopback-only Preview exception during the physical gate.

### Jobs route reconciled

`app/api/driver/mobile/jobs/route.ts` now:

- supports modern lifecycle aliases;
- reads `current_status` with fallback to legacy `status`;
- keeps History full rather than applying a time-period filter.

### Evidence route restored

Added:

`app/api/driver/mobile/jobs/[id]/evidence/route.ts`

with:

- driver assignment ownership check;
- feature gates;
- 10 MB limit;
- MIME + magic-byte validation;
- private POD storage path scoped by carrier company and job;
- collection evidence linkage before Loaded transition.

## Existing nearby-load fix retained

The V3 branch keeps the explicit PostgREST relationship:

`companies:companies!jobs_company_id_fkey(...)`

This resolves the physical error:

`Could not embed because more than one relationship was found for 'jobs' and 'companies'`

Do not replace this with the ambiguous `companies(...)` embed during later main reconciliation.

## Next physical gate

1. Fetch the new exact PR HEAD into the isolated worktree.
2. Start the local Next backend under Netlify deploy-preview environment with `XDRIVE_LOCAL_PREVIEW_DEVICE_BYPASS=true`.
3. Keep backend local only; no Production deploy.
4. `adb reverse` the local API port.
5. Rebuild the `.preview` APK because mobile package identity code changed.
6. Verify package/label before install.
7. Verify canonical GOLDEN APK SHA before install.
8. Install/update Preview only.
9. Verify GOLDEN APK SHA remains byte-identical.
10. Log in to Preview if required.
11. Confirm driver name + `KM57CXL` return.
12. Confirm `Loads > Available` renders real marketplace cards.
13. Confirm Offers renders real bid history.
14. Continue physical lifecycle/evidence/POD/offline/tracking gates.
15. Re-establish and verify the GOLDEN server-side native binding through GOLDEN itself only after Preview testing is complete.

## Verdict

NO FINAL PASS yet.

The V3 visual direction is close to final, but the recovered branch had a real client/server contract split. The root request gate and the next known lifecycle blocker are now repaired on the PR branch. Physical real-data validation is required on the new HEAD before any release/replacement decision.
