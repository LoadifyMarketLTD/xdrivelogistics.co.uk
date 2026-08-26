# XDrive Driver Android — Canonical 15-Point Closure Ledger

Date: 2026-08-26
Production Android owner: `android-native/` Kotlin / Jetpack Compose
Production package: `co.uk.xdrivelogistics.driver`

This ledger distinguishes **code/remediation closure** from **external/runtime acceptance**. A point is never marked runtime PASS without the required evidence.

| # | Problem | Remediation state | Canonical PR | Remaining acceptance evidence |
|---|---|---|---|---|
| 1 | Push deep-link reliability | IMPLEMENTED / MERGED | #373 | Included again in physical push gate 15 |
| 2 | Active-job GPS High Accuracy | IMPLEMENTED / MERGED | #374 | Physical moving-device verification in gate 15 |
| 3 | Tracking readiness / non-blocking On My Way | IMPLEMENTED / MERGED | #376 | Physical lifecycle + GPS-loss verification in gate 15 |
| 4 | Stop Tracking semantics | IMPLEMENTED / MERGED | #377 | Physical privacy/stop verification in gate 15 |
| 5 | Offline job-status recovery | IMPLEMENTED / MERGED | #378 | Process-death/offline physical replay in gate 15 |
| 6 | Offline POD recovery | IMPLEMENTED / MERGED | #379 | Physical offline file/photo replay in gate 15 |
| 7 | Offline quote recovery + single-quote rule | IMPLEMENTED / MERGED | #380 | Physical offline replay in gate 15; DB uniqueness already enforced |
| 8 | Login incomplete controls | IMPLEMENTED / MERGED | #383 | `Remember me` code complete; Forgot Password requires Supabase allow-list for `xdrive://reset-password` then physical email/deep-link test. Biometrics deliberately removed. |
| 9 | Device/session binding | IMPLEMENTED / MERGED | #382 | Two-device/revocation physical verification in gate 15 |
| 10 | Expo vs Native package ownership | IMPLEMENTED / MERGED | #384 | Kotlin is sole production owner; Expo is preview-only |
| 11 | Production versionCode | IMPLEMENTED / MERGED | #385 | `20260826` established; final Play upload must confirm no unknown external higher code |
| 12 | Production signing lineage | REPOSITORY SAFETY CLOSED | #386 | Play Console must confirm app-signing/upload certificate lineage and provide/recover valid upload key before release build |
| 13 | Firebase real production config | REPOSITORY SAFETY CLOSED | #387 | Real Firebase Android config + server service-account secret + exact-source Edge Function redeploy + physical FCM delivery/deep-link. Live function v8 was found behind repo source for click-action. |
| 14 | Genuine Gradle build | BUILD GATE IMPLEMENTED | #388 | Run `verify-local-build.ps1` or `.sh` on a machine with Android SDK/Gradle access; record successful unit tests, APK and SHA-256. Current assistant container cannot perform this due no GitHub DNS, no Gradle distribution and no Android SDK. |
| 15 | Physical phone E2E | ACCEPTANCE GATE IMPLEMENTED | #389 | Execute every gate in `PHYSICAL_E2E_ACCEPTANCE.md` on a real Android phone and correlate ADB/Supabase evidence |

## Corrected historical decisions

### Problem 3

A previously proposed rule requiring fresh GPS before `On My Way` was withdrawn. Lifecycle progress must not deadlock solely because GPS is unavailable or stale. Active-job tracking remains required as an independent channel.

### Problem 7

The permanent commercial rule is:

`1 driver + 1 job = 1 quote`

A byte-for-byte/payload-equivalent technical retry of the same still-active quote may be recognised idempotently after a lost response, but it must never create a second quote. A different amount/message or any attempt after the first quote became terminal is not a retry.

### Problem 8

Removing useful login controls was not accepted as the final solution. `Remember me` and `Forgot password` were restored with real implementation in #383. Biometrics were intentionally removed from scope and must not be reintroduced without an approved product/security requirement.

### Problem 10

Expo/React Native remains available only as an internal preview/reference target under `co.uk.xdrivelogistics.driver.preview`. It must not reclaim the production package, production EAS store profile or submit path.

## External release blockers that cannot be inferred from repository code

The following require external systems or physical hardware and therefore remain explicit rather than guessed:

1. Supabase Auth Additional Redirect URL: `xdrive://reset-password`.
2. Google Play production app/signing/upload-key lineage.
3. Firebase project Android app configuration for `co.uk.xdrivelogistics.driver`.
4. Trusted server secret `FIREBASE_SERVICE_ACCOUNT_JSON`.
5. Exact-source redeploy of `notify-operational-event` so live source matches the repository push/deep-link contract.
6. One real Gradle debug build from the current main checkout.
7. One full real-phone E2E run covering all gates in `PHYSICAL_E2E_ACCEPTANCE.md`.

## GitHub Actions rule

Current GitHub Actions failures where jobs never execute steps are infrastructure/billing non-signals. They are not Android code failures and are not accepted as release PASS either. Android build PASS requires the local Gradle evidence defined in `LOCAL_BUILD_EVIDENCE.md`.

## Release declaration rule

The application may be described as **15/15 remediation implemented/prepared** only when referring to repository remediation and acceptance tooling.

It may be described as **15/15 release validated / production ready** only after all external blockers above have been resolved and Problems 12–15 have their required runtime/Play/physical evidence.
