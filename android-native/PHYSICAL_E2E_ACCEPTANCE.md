# XDrive Driver Android — Physical Phone E2E Acceptance

Problem 15/15 is PASS only after the current Native Android APK is exercised on a real Android phone against the intended XDrive environment.

Courier Exchange reference behaviour used for this gate:

- Driver App: load search, alerts, availability/status, live operational updates.
- Booked load: live status / ETA visibility through to POD.
- Completed work: electronic POD remains part of the job record.

Public references:
- https://courierexchange.co.uk/driver-app/
- https://courierexchange.co.uk/courier-exchange-apps/
- https://courierexchange.co.uk/cx-explained/

This gate verifies XDrive behaviour; it does not assert unpublished Courier Exchange internals.

## Evidence truth rules

Each gate must end in one of these states:

- `PASS` — the required phone behaviour and any required server-side evidence were actually observed.
- `FAIL` — the required behaviour was exercised and did not meet the contract.
- `BLOCKED` — a prerequisite such as Firebase, Supabase Auth redirect configuration, second device, test job or server evidence is unavailable.
- `NOT_RUN` — the gate has not yet been exercised.

`STATIC PASS`, `BUILD PASS`, successful APK installation, or the absence of a crash must never be converted into a physical E2E PASS by inference.

## Test prerequisites

Record before execution:

- Git commit SHA
- APK SHA-256
- APK versionName / versionCode
- Android device model
- Android version
- XDrive environment/base URL
- Supabase project id
- test user id / driver id (IDs only; never store password)
- test job id
- network used for baseline

All jobs used in this acceptance cycle must be explicitly test jobs.

## Gate A — Install and cold start

1. Remove any prior test build if doing a clean-install cycle.
2. Install the current APK with ADB.
3. Confirm package is `co.uk.xdrivelogistics.driver`.
4. Confirm installed versionCode matches the APK under test.
5. Cold-start the app.
6. Confirm login is the entry screen when no persistent session exists.

PASS: app starts without crash and correct package/version is installed.

## Gate B — Login, Remember me, device binding

1. Log in with a valid driver account.
2. Confirm device session registers successfully.
3. Close and relaunch with **Keep me signed in** enabled; session must restore.
4. Log out.
5. Log in with Keep me signed in disabled; terminate the app process and relaunch; persistent login must not survive a fresh process.
6. Re-enable persistent login for the rest of E2E.
7. Where a second Android device is available, log in there and verify the first native device is rejected/revoked by newest-device-wins policy.

PASS: no password is persisted; session persistence follows user choice; revoked device cannot silently continue after server validation.

## Gate C — Forgot password

Prerequisite: `xdrive://reset-password` is present in Supabase Auth Additional Redirect URLs.

1. From Login, request password recovery for the test account.
2. Open the recovery email on the phone.
3. Confirm link routes into XDrive reset-password flow.
4. Set a temporary new password.
5. Confirm recovery session is cleared after success.
6. Log in with the new password.

PASS: no dead browser callback, no raw token displayed, no recovery session retained after completion.

## Gate D — Push registration and deep link

Prerequisites:

- Firebase Android app registered for `co.uk.xdrivelogistics.driver`.
- Native Firebase project/app/api/sender values supplied to the exact APK under test.
- `FIREBASE_SERVICE_ACCOUNT_JSON` configured only on the trusted server/Edge Function.
- `notify-operational-event` exact-source version deployed with the XDrive Android click/deep-link contract.

1. Grant notification permission when prompted.
2. Confirm a row appears in `driver_push_devices` for the installation.
3. Assign a test job to this driver.
4. Confirm physical push arrives.
5. Tap push.
6. Confirm XDrive opens the exact assigned job, including when app was backgrounded/terminated.

PASS: registered device + real FCM delivery + correct job deep link.

## Gate E — Job status lifecycle

Use the canonical persisted lifecycle:

`allocated -> on_my_way -> on_site_pickup -> loaded -> in_transit -> on_site_delivery -> delivered -> completed`

1. Open awarded/allocated test job.
2. `On My Way` must not be blocked solely because GPS is temporarily stale/unavailable.
3. Progress every transition in order, including `loaded -> in_transit -> on_site_delivery`.
4. Attempt an out-of-order transition and confirm server rejects it.
5. Confirm same-status retry is idempotent where applicable.
6. Confirm UI/server state converge after each transition.

PASS: no skipped persisted transition, including `in_transit`, and no lifecycle deadlock caused by GPS/network state.

## Gate F — Active-job GPS and live tracking

1. Grant precise foreground location.
2. Start active-job journey (`On My Way`).
3. Keep app/device moving long enough to produce multiple GPS updates.
4. Confirm `driver_locations` receives current driver/job points at approximately the designed active-job cadence.
5. Confirm authorized job participants can see current tracking/ETA as intended.
6. Confirm unauthorized/non-participant account cannot read exact active-job location.
7. Confirm lifecycle status and GPS channel remain independent.

PASS: precise active-job tracking works without widening location access.

## Gate G — Availability tracking separation

1. End active-job tracking state before testing availability.
2. Opt in to availability tracking.
3. Confirm availability presence is published at the lower-power/lower-frequency policy.
4. Turn availability off.
5. Confirm no continued availability publication after stop.

PASS: pre-job availability remains opt-in and separate from active job tracking.

## Gate H — Offline status recovery

1. Put phone offline before one valid lifecycle transition.
2. Perform the transition.
3. Confirm UI represents the local pending/optimistic state without falsely claiming server confirmation.
4. Kill/restart app while still offline.
5. Restore network.
6. Confirm WorkManager replays the action chronologically and exactly once.
7. Confirm server reaches the intended canonical status.

PASS: process death + offline period does not lose or duplicate the status action.

## Gate I — Offline quote recovery and one-quote rule

Use a fresh test load that the driver has never quoted.

1. Go offline.
2. Submit one quote.
3. Confirm local status is Pending, not Submitted.
4. Attempt to quote the same job again; UI must refuse a second quote.
5. Kill/restart app while offline.
6. Restore network.
7. Confirm the exact quote is submitted once.
8. Confirm DB has exactly one `job_bids` row for this driver/job.
9. Attempt a second quote after server submission; it must be rejected.

PASS: `1 driver + 1 job = 1 quote`, including retries/process death.

## Gate J — Offline POD recovery

1. Use an eligible POD file/photo within the configured size/type contract.
2. Go offline before upload.
3. Capture/select POD.
4. Confirm payload is retained securely as pending.
5. Kill/restart app.
6. Restore network.
7. Confirm deterministic upload/link retry succeeds once.
8. Confirm job evidence points to the final storage object.
9. Confirm local payload is removed only after success or terminal failure.

PASS: no lost POD, duplicate link, dead content URI dependency or false Delivered unlock.

## Gate K — Delivery guards

1. Attempt `delivered` before required recipient/signature/POD evidence exists.
2. Confirm transition is blocked.
3. Add required delivery confirmation evidence.
4. Retry `delivered`.
5. Confirm delivery succeeds.
6. Complete job only after Delivered.

PASS: server-visible evidence, not merely locally queued evidence, unlocks delivery.

## Gate L — Stop tracking semantics

1. During active job, exercise the user-facing stop semantics allowed by the product contract.
2. Confirm stopping pre-job availability does not incorrectly terminate mandatory active-job tracking.
3. Finish/exit the active tracking condition.
4. Confirm foreground location runtime stops when neither JOB nor AVAILABILITY is required.
5. Confirm no new location rows continue after the expected stop window.

PASS: no privacy leak and no premature active-job tracking termination.

## Gate M — Logout / relogin / revocation

1. Log out while online.
2. Confirm push registration/device session cleanup is attempted in the correct order.
3. Confirm session is unusable after logout.
4. Relaunch and log back in.
5. Confirm a new valid device session is established and normal job data returns.
6. Repeat logout once while offline, then reconnect and confirm queued cleanup/revocation is reconciled.

PASS: stale session/device cannot continue indefinitely after logout.

## Gate N — Crash and background observation

During the full run inspect:

- Android logcat for uncaught exceptions / ANR indicators.
- foreground-service notification behaviour during active tracking.
- battery/background restrictions that suppress required WorkManager replay.
- notification handling when app is foreground, background and terminated.

PASS: no reproducible crash/ANR and required background work recovers after normal Android lifecycle changes.

## Final PASS record

Problem 15/15 may be marked PASS only when every applicable gate above has evidence. Record:

- final commit SHA
- APK SHA-256
- phone + Android version
- test job ids
- timestamps of push/GPS/offline/POD tests
- relevant Supabase row evidence/counts
- any ADB log files
- explicit `PASS` / `FAIL` / `BLOCKED` / `NOT_RUN` per gate

A partial phone test must be reported as partial. Never convert missing Firebase, signing, build, server correlation or physical evidence into an inferred PASS.
