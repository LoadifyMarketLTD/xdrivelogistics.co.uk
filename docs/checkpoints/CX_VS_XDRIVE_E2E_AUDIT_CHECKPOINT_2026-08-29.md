# CX vs XDrive E2E Audit — Continuity Checkpoint — 2026-08-29

## Purpose

This checkpoint is the canonical continuation point for the whole-site **Courier Exchange / CX benchmark vs XDrive Logistics E2E audit** currently running on the XDrive repository.

Continue from this document in the next chat. Do not reconstruct the work from memory and do not restart the audit from Domain 1.

---

## Repository coordinates

- Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
- Audit branch: `audit/cx-vs-xdrive-e2e-20260828`
- Captured work HEAD before this documentation-only checkpoint commit: `47d8b8036800912348633c782e6710f37cbec8c6`
- Captured work HEAD message: `fix(driver): make offline evidence durable and retry safe`
- Base branch: `main`
- PR base SHA currently recorded by GitHub: `3fe010a68a6107af0496a406f9a98bfe04f5dd54`
- Draft PR: `#398` — `audit: CX vs XDrive E2E — Marketplace checkpoint`
- PR state at checkpoint time: **OPEN / DRAFT / NOT MERGED / mergeable**
- PR #398 currently contains more than its original Domain 1 body describes. Its title/body are stale relative to the branch contents. Keep it DRAFT and do **not** merge it yet.

The checkpoint commit itself is documentation-only and therefore becomes the branch HEAD after the captured work HEAD above.

---

## Non-negotiable rules

1. `apps/driver-mobile` Expo / React Native remains the canonical Driver application.
2. Do **not** reintroduce `android-native/` / Kotlin as the Driver app.
3. Do not merge to `main` until the complete E2E audit and release gate are closed.
4. Do not deploy production changes from this audit checkpoint.
5. Do not mutate hosted Supabase unless a later step explicitly authorises and verifies the migration set.
6. Treat push/deep-link payloads only as navigation intents, never as authorization.
7. Driver job reads remain assignment-gated by authoritative backend state.
8. Never expose peer-driver exact GPS to another driver.
9. Private `pod-photos` / `load-documents` objects remain private and are presented only through short-lived signed URLs.
10. Raw private storage paths must not be returned as user-facing download authorities.
11. Service-role access must happen only after assignment / tenant / device checks.
12. Offline replay must remain per-user, durable, ordered per job and retry-safe.
13. Never call static source inspection a runtime PASS.
14. Status vocabulary to use in reporting:
   - **IMPLEMENTED STATIC**
   - **EXACT DIFF VERIFIED**
   - **CONTRACT TEST ADDED — NEEXECUTED**
   - **RUNTIME NEEXECUTED**
   - **HOSTED DB NOT APPLIED**
   - **BUILD/DEPLOY PREVIEW FAILED** where applicable.

---

# Audit domain state

## Domain 1 — Marketplace / Exchange

**Closed for this audit phase.**

Previously consolidated on this audit branch:

- company-level active quote identity;
- strict Exchange visibility;
- canonical Exchange expiry across load-search surfaces;
- expired-quote rejection;
- Expo duplicate-quote state moved behind authenticated mobile API;
- no colleague commercial bid-detail leakage.

Do not reopen Domain 1 unless a later cross-domain regression specifically points back to it.

## Domain 2 — Fleet

**Closed static for this audit phase.**

Key outcome:

- Fleet own-presence is separated from Exchange presence;
- `driver_availability_presence` must be consumed under Fleet scope only for own-fleet exact position use;
- Live Availability, Fleet Availability, Drivers and Vehicles were aligned to this own-fleet presence model;
- job tracking remains authoritative while a driver is executing a job;
- vehicle availability must not infer `available now` from an unassigned vehicle alone;
- allocation core remains KEEP;
- load-match / vehicles-in-range is deferred to the matching/intelligence domain;
- real-time alert behaviour is deferred to the notifications/alerts domain.

Do not mix Exchange-presence and Fleet-presence semantics in later work.

## Domain 3 — Driver

**ACTIVE. This is the exact continuation domain.**

The audit discovered that `main` did not contain a number of already-audited Expo/backend recovery fixes. We are porting those fixes selectively into the CX audit branch rather than cherry-picking the entire recovery branch.

---

# Domain 3 — implemented on audit branch so far

## A. Canonical Expo resources contract — IMPLEMENTED STATIC

Commit:

- `b74d76c051f614aa03c2f0b3e40a2d3ae591383c` — `fix(driver): restore canonical Expo resources contract`

`app/api/driver/mobile/resources/route.ts` now provides the Expo contract expected by the stable app:

- `driver`
- `company`
- `vehicle`
- `alerts`
- `documents`
- `invoices`
- canonical Return Journey fields
- compatibility fields for legacy consumers
- peripheral resources fail-soft through `partial[]`

Operational alerts are sourced from `notification_events`; the legacy `notifications` table remains compatibility-only.

Authorization itself remains fail-closed inside `requireDriver`.

## B. Atomic Return Journey — IMPLEMENTED STATIC / HOSTED DB NOT APPLIED

Relevant commits:

- `93799746fba953626efef1bed222dcb72e295763` — added canonical atomic Return Journey migration to audit branch
- `2c3150cca14e7d3fd7d78983ee1309aedd985936` — route switched to atomic RPC
- `58db094c6e417cb8c17976e5415e7f5019d91de2` — static regression contract

Migration:

`supabase/migrations/20260828205000_driver_return_journey_canonical_atomic_replace.sql`

RPC:

`replace_driver_return_journey_canonical`

The old API delete-first window is removed. Replacement and clear are transactional inside PostgreSQL. A failed replacement must roll back the delete and preserve the previously valid declaration.

The RPC also verifies the driver/company binding for a published journey. A blank starting postcode is the canonical clear operation.

**HOSTED DB NOT APPLIED.**

## C. GPS backend tenant binding — IMPLEMENTED STATIC

Relevant commits:

- `c4dd694ce086b39cb210e85cf3bd38e4a391d371` — tracking-state tenant gate
- `16453b40571231ee7985ae667287979c1103de7d` — location publish tenant gate
- `b03a779bb7beb30688bbf5a6b37020c82675ed13` — regression contract

Both endpoints now use carrier binding in this order:

`awarded_carrier_company_id ?? assigned_company_id`

A carrier-bound job is rejected if that company does not equal the driver's company, including the case where the driver company binding is null.

Individual-driver jobs with no carrier company bound remain valid.

## D. Session-loss clarification — CURRENT STABLE STATE

An earlier recovery fix stopped operational tracking on session loss, but the stable audit branch does **not yet contain the Expo background tracking module or its `expo-location` / `expo-task-manager` dependencies**.

Therefore the audit branch intentionally does **not** reference a nonexistent tracking module.

Current state:

- involuntary session loss clears the previous user's account-scoped offline queue;
- explicit logout revokes the native device binding before Supabase local signout;
- background tracking stop-on-session-loss must be added only when the complete Expo tracking module and generated lockfile dependencies are introduced.

Do not falsely report session-loss tracking stop as complete on this branch yet.

## E. Assigned job history/detail presentation — IMPLEMENTED STATIC

The existing good behaviour on stable was preserved:

- job reads are assignment-gated;
- completed history defaults to 365 days;
- completed history supports server cursor pagination;
- active/all semantics remain separate from Marketplace visibility.

Ported presentation helpers from the audited Driver recovery work:

- `app/api/driver/mobile/jobAuditPresentation.ts`
- `app/api/driver/mobile/jobOperationalPresentation.ts`
- `app/api/driver/mobile/jobAttachmentPresentation.ts`
- `app/api/driver/mobile/podPresentation.ts`

Relevant commits in the port sequence include:

- `a4fba88b411e205d0278c086899c33eaa34bf7e6`
- `ccdfc293fdd563154606f22b083f66bdf8d8d871`
- `fa0755b429c69c7c7729941259cb14a67d86defb`
- `2b538822c01514cfecfcbee8ed8574e29e2d81f6`
- `b6d72a243be18d2b83401c0353e9e95ae3198a6` — enriched assigned job list
- `d7fd08aaf40fcb4c512f8b1d3ba98e47720e3467` — enriched assigned job detail

Result:

- operational fields are normalized for Expo;
- audit trail uses real lifecycle history and does not present actor UUIDs as human names;
- load attachments validate canonical `job-owner-company/job/...` storage paths;
- `load-documents` objects are exposed only via signed URLs;
- POD evidence is exposed only via signed URLs from private `pod-photos`;
- signing/read outage is fail-soft: assigned job remains visible while private evidence remains undisclosed;
- no raw private storage path is intentionally presented to the mobile UI.

## F. Damage evidence schema — IMPLEMENTED STATIC / HOSTED DB NOT APPLIED

Commit:

- `946b5e714da593dd78beb5d47db61afb6df0e508`

Migration:

`supabase/migrations/20260828133000_driver_pod_damage_evidence.sql`

Adds:

`jobs.damage_photos jsonb`

**HOSTED DB NOT APPLIED.**

## G. Native device binding in Expo HTTP client — IMPLEMENTED STATIC

Relevant commits:

- `43a56530c949162397789eda3432fda99259dcff` — Expo device-session identity helper
- `b13836a0e767c42fd1b8e23a84f8e2688182a2fa` — authenticated JSON/binary API client becomes device-bound
- `e30aa34b476197d388cf459ac473191978b68e3f` — explicit logout server cleanup helper
- `ce43d92e5b714cb751b5c636f97d2c5b914845a1` — Supabase signout revokes native binding before local signout

Important stable behaviour:

- `ensureDeviceSession()` registers `installation_id` against the current Supabase auth session;
- authenticated API requests send `x-xdrive-installation-id`;
- binary API requests use the same binding;
- logout revokes the native device binding;
- push cleanup remains deliberately deferred to the notifications/push domain;
- background tracking cleanup remains deliberately deferred until the actual tracking module exists.

The server endpoint `app/api/driver/mobile/device-session/route.ts` was already present on stable and uses atomic newest-native-login-wins registration.

## H. Durable offline evidence / retry classification — IMPLEMENTED STATIC

Relevant commits:

- `0398d1d5390f69ae3b76c65adfd8508746c85af8` — durable queued collection evidence
- `7ff5ee9dbee3a530d6ac043292b957e7de43ad6e` — durable queued POD evidence
- `47d8b8036800912348633c782e6710f37cbec8c6` — queue durability + retry safety integration

New helpers:

- `apps/driver-mobile/src/offline/collectionEvidencePersistence.ts`
- `apps/driver-mobile/src/offline/podEvidencePersistence.ts`

Behaviour:

- ImagePicker / DocumentPicker cache URIs are copied into app `documentDirectory` before the AsyncStorage queue item is committed;
- queued evidence survives process restart and cache eviction until explicitly cleaned;
- queue remains scoped per authenticated user;
- account cleanup also deletes that user's durable queued evidence;
- permanent 4xx failures are not retried automatically;
- 408 / 425 / 429 remain retryable;
- network / unknown / 5xx failures remain retryable;
- manual retry can re-enable a terminal queue item.

Existing `queueOrderingHelpers.ts` already guarantees per-job lifecycle ordering and specifically keeps `pod` before `delivered`.

---

# CRITICAL CURRENT FRAGMENTATION — NEXT WORK MUST START HERE

The audit branch is **not release-ready** after the changes above.

The current stable `apps/driver-mobile/src/api/jobs.ts` and backend POD write routes still speak the older POD protocol.

### Current old client behaviour still present

`apps/driver-mobile/src/api/jobs.ts` still:

- uploads POD directly to Supabase Storage;
- uses old paths such as `jobId/photos/...` and `jobId/documents/...`;
- does not yet use the device-bound binary evidence API for POD;
- does not keep delivery / damage / documents as three first-class categories end-to-end;
- does not yet use stable `evidenceBatchId` object names for replay idempotency;
- does not yet perform the recovery-branch cleanup ordering (`POST POD -> refresh job -> cleanup durable evidence`).

### Current old backend behaviour still present

`app/api/driver/mobile/jobs/[id]/evidence/route.ts` still needs to be aligned to the audited recovery contract:

- canonical storage path must be `companyId/jobId/category/objectName`;
- delivery categories must be `photos | damage | documents`;
- PDF must be allowed for documents only, not photo categories;
- assignment and company binding must be authoritative;
- duplicate storage object on replay should be treated as idempotent success;
- collection evidence can be linked immediately;
- delivery/damage/document evidence must remain unlinked until final POD verifies every object.

`app/api/driver/mobile/jobs/[id]/[action]/route.ts` still needs the audited POD/lifecycle contract:

- lifecycle status payload must not inject physical evidence paths/signatures as authority;
- required POD must align with authoritative lifecycle requirements;
- delivery photo + recipient signature + recipient name are required when POD is required;
- damage evidence must remain separate from delivery evidence;
- persisted evidence should be deduplicated;
- final POD must use tenant/job/category validated paths;
- final POD should write canonical `driver_notes` and `pod_generated_at`;
- lifecycle transition should then consume persisted server state.

This client/server POD alignment is the **exact next implementation task** after resolving the current failed preview status below.

---

# Storage / migration dependency still to audit

The audited recovery branch also has:

`supabase/migrations/20260828130500_driver_pod_pdf_bucket_mime.sql`

That migration allows PDF MIME in the private `pod-photos` bucket for POD documents.

It has **not yet been intentionally ported and closed in this audit branch checkpoint**.

Before declaring PDF document upload complete:

1. inspect the stable/audit migration inventory;
2. verify whether the equivalent bucket MIME configuration already exists under another migration;
3. port only if genuinely missing;
4. keep **HOSTED DB NOT APPLIED** until the migration clean-replay audit is complete.

Also re-audit the authoritative lifecycle RPC migration:

`supabase/migrations/20260827052500_preserve_driver_pod_signature_json.sql`

Do not assume hosted state from repository presence.

---

# Expo background tracking dependency rule

Do not port `apps/driver-mobile/src/tracking/operationalTracking.ts` blindly.

The recovery implementation uses Expo location/task-manager support, but the stable audit branch package currently does not yet carry the complete generated dependency/lockfile state for that tracking module.

When this phase is reached:

1. inspect `apps/driver-mobile/package.json` and root lockfile together;
2. add tracking dependencies only through a generated, verifiable lockfile update;
3. do not handcraft `package-lock.json`;
4. then add background tracking, entrypoint task registration and session-loss stop behaviour as one coherent unit;
5. preserve server-authoritative `tracking-state` checks before publishing GPS.

---

# PR / build evidence at checkpoint time

PR #398 is still DRAFT and must remain unmerged.

Captured work HEAD `47d8b8036800912348633c782e6710f37cbec8c6` has GitHub combined status **FAILURE** because the primary `netlify/xdrivelogistics/deploy-preview` status is `Deploy Preview failed`.

A second Netlify context (`silly-faloodeh-cea857`) is reported as a canceled preview.

Therefore:

- **BUILD/DEPLOY PREVIEW FAILED** at the captured work HEAD;
- do not call the current branch build PASS;
- the failure reason has not yet been diagnosed in this checkpoint;
- first operational step in the next chat is to inspect the failed XDrive Netlify deploy/build log and determine whether the failure was introduced by this Driver port or is external/infrastructure-related.

Do not add broad new features until any compile/import error from the current branch is excluded.

---

# Test truth state

At this checkpoint:

- static regression contracts have been added in several Driver areas;
- they must not be described as runtime PASS unless actually executed;
- no new claim of successful `npm test`, `vitest`, `tsc --noEmit`, Next build, Expo/EAS build, APK build or physical-device E2E is established by this checkpoint;
- hosted Supabase migration behaviour is not executed by this checkpoint.

Use **CONTRACT TEST ADDED — NEEXECUTED** / **RUNTIME NEEXECUTED** where applicable.

---

# Exact continuation order for the next chat

## Step 1 — Recover real state

Read this checkpoint fully, then verify:

- audit branch exists;
- checkpoint is at/after captured work HEAD `47d8b8036800912348633c782e6710f37cbec8c6`;
- `main` current HEAD;
- PR #398 remains DRAFT / unmerged;
- current Netlify / CI status.

## Step 2 — Diagnose failed preview

Inspect the failed `netlify/xdrivelogistics/deploy-preview` for the captured/current audit HEAD.

If it is a code compile/import error caused by the current port, repair that before continuing.

If it is infrastructure/config unrelated to the Driver diff, document the evidence and continue with static audit while leaving runtime status unresolved.

## Step 3 — Finish POD/offline client-server protocol

Port/adapt the already-audited recovery contract, not a new design:

- device-bound binary evidence upload;
- `company/job/category/file` storage layout;
- categories `photos | damage | documents`;
- stable evidence batch/object names;
- duplicate upload = idempotent replay success;
- collection linked immediately;
- delivery/damage/docs linked only by final POD;
- required POD gate = delivery photo + signature + recipient name;
- separate damage evidence;
- server-authoritative lifecycle mutation;
- POST POD -> refresh assigned job -> only then clean durable offline files;
- legacy queued damage marker compatibility only when internally consistent.

Add/port narrow regression contracts for each invariant.

## Step 4 — Migration clean replay audit

Audit the 26–29 Aug Driver migrations as a coherent set before any hosted apply, including:

- `driver_mobile_device_sessions` / registration RPCs;
- `driver_locations`;
- `notification_events` ETA contract;
- `jobs.damage_photos`;
- POD PDF MIME bucket migration;
- lifecycle RPC and POD signature type preservation;
- Return Journey canonical atomic replace;
- private `pod-photos` / `load-documents` storage assumptions;
- duplicated or superseded historical migrations.

Output KEEP / REPAIR / CONSOLIDATE / REMOVE for migration conflicts.

Do **not** apply hosted migrations during the audit itself.

## Step 5 — Device/tracking

Only after package/lock coherence is demonstrable:

- add/port Expo operational tracking;
- entrypoint background task registration;
- server `tracking-state` as authority;
- stop tracking on explicit logout and involuntary session loss;
- no completed-history permission prompt;
- no peer GPS leakage;
- verify null-company/carrier fail-closed behaviour already ported.

## Step 6 — Push + ETA alerts

Audit:

- Android native FCM token registration;
- installation/session ownership;
- unregister on logout;
- notification event recipient ownership;
- push/deep-link job intent re-authorized by assignment fetch;
- ETA alert cooldown/material-change behaviour;
- alerts UI from `notification_events`.

## Step 7 — Driver history / invoices / POD UX

CX benchmark target:

- up to 12 months booking history;
- POD access from completed job;
- permitted invoice access tied to the driver's executed job, not company-wide finance exposure;
- signed URL refresh rather than persisting expired URLs;
- session expiry checked while Driver pages remain open.

Do not expose all company invoices to an ordinary driver.

## Step 8 — Live Loads / bidding / availability / Return Journey E2E

Verify complete chain:

availability -> eligible nearby job -> bid -> awarded -> assignment -> disappears from Marketplace -> appears in Driver execution.

Preserve Exchange vs Fleet presence separation.

Return Journey must be tested after migration application through:

create -> replace -> clear -> app restart -> reload.

Compare behaviour with CX return-load matching without copying privacy-invasive peer location behaviour.

## Step 9 — Release gate only after all domains close

Required before merge/readiness claim:

- exact diff vs current `main`;
- migration inventory PASS;
- generated lockfile coherence;
- typecheck;
- unit/contract tests;
- Next build;
- Expo build;
- Android APK/EAS build;
- real login on physical phone;
- native device binding;
- real push;
- real GPS/background tracking;
- offline restart/replay;
- full pickup -> POD -> delivered job;
- Return Journey E2E;
- signed URL expiry/refresh;
- session expiry while app/page is open.

Only after this release gate can PR #398 (or its successor consolidation PR) be considered for merge.

---

# Start prompt for the next chat

Use this exact instruction:

**CONTINUĂ CX VS XDRIVE E2E EXACT DIN CHECKPOINT-UL DIN REPO:**

`docs/checkpoints/CX_VS_XDRIVE_E2E_AUDIT_CHECKPOINT_2026-08-29.md`

Repo: `LoadifyMarketLTD/xdrivelogistics.co.uk`

Branch: `audit/cx-vs-xdrive-e2e-20260828`

Captured work HEAD before checkpoint: `47d8b8036800912348633c782e6710f37cbec8c6`

Draft PR: `#398`

**Citește checkpoint-ul integral și verifică mai întâi branch-ul, main și statusul PR/Netlify. Nu relua Domain 1. Continuă din Domain 3 — Driver, începând cu diagnosticul preview-ului eșuat și apoi închiderea POD/offline client-server protocol. Nu face merge, production deploy sau hosted Supabase apply. Expo/React Native rămâne aplicația Driver canonică; nu reintroduce android-native/Kotlin. Păstrează strict adevărul între static implemented, runtime neexecuted și hosted DB not applied.**
