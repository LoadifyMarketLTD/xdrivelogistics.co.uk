# XDrive post-consolidation continuity checkpoint — 2026-08-30 12:15 BST

## Canonical repository state

Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`

Checkpoint parent `main` before this documentation commit:

`df72c49dd14a059cc86b17ae344c8be7bb969f64`

Parent commit message:

`docs(checkpoint): record post-consolidation compliance hotfix state`

Previous checkpoint retained for history:

`docs/checkpoints/XDRIVE_POST_CONSOLIDATION_COMPLIANCE_CHECKPOINT_2026-08-30.md`

This checkpoint supersedes that file for continuation because production compliance review has since been exercised and repository truth has advanced.

## PR consolidation disposition

### PR #395 — Driver CX parity generation

- `CLOSED`
- `NOT MERGED`
- `SUPERSEDED`
- safe rich-quote concepts were rebuilt on the canonical Expo/server path
- `android-native/**/*.kt` remains non-canonical and must not be resurrected as the Driver application
- Collection Pass remains intentionally not ported because #395 did not contain a complete verifier workflow

### PR #398 — CX vs XDrive E2E audit branch

- `CLOSED`
- `NOT MERGED`
- `SUPERSEDED`
- stronger E2E/security contracts were selectively absorbed into #399
- do not merge or revive this branch wholesale

### PR #399 — CX-close operational workspace convergence

- `CLOSED`
- `MERGED`
- source HEAD: `221601de315450fd6523868ca539f24713d04d44`
- merge commit in `main`: `47936816984df9ef7cfceac9ffb36b5d37afd278`
- this is the completed consolidation branch

Canonical consolidation matrix:

`docs/canonical/PR395_PR398_TO_PR399_CONSOLIDATION_MATRIX_2026-08-30.md`

## Canonical deploy truth

The final PR #399 source HEAD:

`221601de315450fd6523868ca539f24713d04d44`

has canonical Netlify status:

- context: `netlify/xdrivelogistics/deploy-preview`
- state: `SUCCESS`
- preview: `https://deploy-preview-399--xdrivelogistics.netlify.app`

The duplicate `silly-faloodeh-cea857` site is not application evidence.

PR #403 source HEAD:

`debf1a46b4bde48950e28c7325b20c861e35801b`

also has canonical `netlify/xdrivelogistics/deploy-preview = SUCCESS`.

The checkpoint parent `main` SHA `df72c49d...` currently has no combined commit-status entries attached. Absence of a status entry is not interpreted as a build failure. The exact functional PR heads above have canonical green Netlify evidence.

## GitHub Actions truth

Latest `main` CI run observed for checkpoint parent `df72c49d...`:

- run id: `33307658810`
- GitHub conclusion: `failure`

However every runnable job failed before runner startup:

- `steps: []`
- `runner_id: 0`
- empty runner name

Observed affected jobs include:

- CodeQL Java/Kotlin
- CodeQL JS/TS/Actions
- Detect Expo Driver Changes
- Public E2E Smoke
- Build & Lint

Expo Driver Typecheck was skipped and also has no executed steps.

Therefore these are classified as:

`NOT EXECUTED — RUNNER / BILLING-CREDITS INFRASTRUCTURE`

They are not application-test failures and must not be relabelled as PASS.

## Major #399 capabilities now in main

The consolidated `main` contains, among other contracts:

- Customer/Broker Multi-drop Post Load with ordered `job_stops`
- authorised multi-stop job-sheet projection
- Expo Driver Multi-drop execution foundation
- staged/server-authoritative POD evidence
- durable offline collection/POD queue
- first-class damage evidence
- signed POD/document presentation and audit/history projection
- device-bound Expo API requests and logout revocation
- tracking tenant isolation
- canonical atomic Return Journey replacement
- structured rich quote metadata: base amount, extras and collect-within
- server-validated canonical quote vehicle snapshot
- carrier-company active quote protection
- fail-closed Exchange visibility and expiry across Driver/Company Marketplace surfaces
- Customer owner Edit/Delete contract for unawarded/unallocated pre-execution loads
- post-award append-only Driver Instructions without mutating route/rate/cargo/timing
- PAF postcode-address provider contract
- Driver Smart Load Alerts foundation
- provider-neutral telematics foundation

Expo / React Native remains the canonical Driver application.

## Post-merge PR #403 — Driver compliance upload repair

PR #403:

- `MERGED`
- merge commit: `7e96adc349387899f52462b007ceda6845afb9fb`

Repair contract:

- browser may upload the file to `driver-docs` under the existing storage policy
- browser does not receive DB INSERT privilege on `driver_documents`
- authenticated `POST /api/driver/documents` persists the record using server authority
- Driver/path ownership is validated
- stored file size/type/magic bytes are verified server-side
- retry is idempotent
- invalid/failed persistence is compensated by object deletion
- no RLS or browser ACL relaxation

Production currently contains a Driver document created at `2026-08-30 10:36:35+00`, after PR #403 merged. This is strong persistence evidence for the repaired path, but this checkpoint does not claim a separately captured request trace for that individual upload.

## Post-merge PR #404 — Super Admin Driver compliance review enum repair

PR #404:

- `MERGED`
- merge commit: `bbc8bb1149c8992540f8323bd378a98d502ef92c`

Hosted production migration:

`20260830105007_repair_owner_compliance_doc_status_enum_cast`

Root cause repaired:

- `driver_documents.status` is `public.doc_status`
- the polymorphic review RPC previously supplied a `text` parameter to that enum column
- Driver-family writes now explicitly cast to `public.doc_status`
- polymorphic status reads cast to text for the RPC/audit contract
- other compliance families retain their text status contracts

Security boundary remains intact:

`owner_review_compliance_document` ACL is:

`{postgres=X/postgres,service_role=X/postgres}`

No direct `anon` / `authenticated` EXECUTE grant exists.

## Production migration truth

Production project:

`jqxlauexhkonixtjvljw` (`xdrivelogistics`)

The following hosted migrations were freshly re-verified in production:

- `20260829192805_telematics_location_source_foundation`
- `20260829192913_job_stops_multidrop_foundation`
- `20260829192952_telematics_driver_bindings`
- `20260829193038_driver_load_alerts_foundation`
- `20260829193101_fix_driver_load_alert_vehicle_key_normalization`
- `20260829193123_load_alert_notification_delivery_contract`
- `20260829193633_harden_pr399_load_alert_function_boundaries`
- `20260829193829_optimize_pr399_rls_and_fk_indexes`
- `20260829221052_repair_job_publish_compliance_and_idempotency`
- `20260830004421_port_driver_return_journey_canonical_atomic_replace`
- `20260830004958_port_driver_pod_damage_evidence`
- `20260830011635_port_driver_rich_quote_structure`
- `20260830105007_repair_owner_compliance_doc_status_enum_cast`

## Compliance runtime evidence now observed

The previous checkpoint recorded:

- 2 Driver documents in `pending`
- both belonging to one Driver

Current production truth is now:

- `pending Driver documents = 0`
- `approved Driver documents = 2`
- both approved rows have `verified_at`
- both approved rows have `verified_by`

`owner_audit_log` contains two real review transitions:

1. `document_approved` — `pending -> approved` at `2026-08-30 11:06:42.614628+00`
2. `document_approved` — `pending -> approved` at `2026-08-30 11:07:26.773397+00`

Therefore the Super Admin Driver-document **Approve** mutation is now factual runtime PASS for the enum-cast incident repaired by #404.

Reject-path runtime has not been separately exercised in this checkpoint and is not claimed PASS merely by inference.

## Current Driver access inventory

Production currently shows:

- 4 active Driver rows
- 3 active Drivers with `app_access=true`
- 1 active Driver with `app_access=false`

The remaining `app_access=false` case must remain separate from the document-review fix. Do not blindly enable access simply because other Driver documents were approved.

## Previous #399 runtime evidence retained

Authenticated Customer booking:

`f44031b6-2f86-4582-ab46-4fe0dcf0a51e`

proved real Multi-drop persistence with 4 ordered `job_stops`:

1. Collection — `101 Cornelian Street, BB1 9QL`
2. Collection — `91 Cornelian Street, BB1 9QL`
3. Collection — `55 Cornelian Street, BB1 9QL`
4. Delivery — `2 SANDCLIFF ROAD, DA8 1NY`

The authorised Customer Job Record subsequently displayed the complete persisted stop sequence.

Do not restart the Courier Exchange screenshot audit for this continuation.

## Remaining operational/runtime gates

These are no longer fragmented source-PR tasks. Continue from `main`.

1. **Owner Edit/Delete** — exercise a harmless edit on an unawarded job and delete a disposable unawarded job; verify production cleanup.
2. **Post-award Driver Instruction** — award/allocate a test job, append an instruction, verify immutable job history + Driver `Special Instructions` + Driver inbox; prove terminal job rejection.
3. **PAF postcode lookup** — visibly prove a real postcode returns the expected address list with the configured provider credential.
4. **Physical Expo Multi-drop** — prove Arrived -> Completed stop ordering, refresh/server authority and final POD/delivery gate on a real device.
5. **Telematics runtime** — configure a real provider binding/credential and prove signed ingest, replay/dedupe, revocation and assignment rejection.
6. **Smart Load Alerts runtime** — save a real Driver preference and prove matcher -> dedupe event -> enabled delivery channels without exact-location leakage.
7. **Driver compliance upload** — if needed, capture one explicit browser upload -> API persistence proof after #403; production persistence already exists post-merge.
8. **Reject review path** — optional dedicated runtime proof for Super Admin rejection semantics; Approve path is already PASS.

## Protected architecture and constraints

- `/super-admin` remains a protected, server-authoritative audited surface; do not weaken it to fix client errors.
- Expo/React Native is the Driver app base.
- Do not resurrect Android-native/Kotlin as the application.
- Do not import PR #359 Workspace visual changes.
- Do not relax RLS/security/browser DB privileges.
- Do not expose exact pre-award addresses or coordinates.
- Do not reopen or merge PR #395/#398.
- Do not relabel GitHub Actions runner-start failures as application failures or PASS.
- Do not fabricate runtime PASS where a physical device/provider/user action is still required.

## Continuation order

Continue from current `main`, not from PR #399 branch:

1. Confirm current `main` before any new code change.
2. Treat PR #395/#398/#399 consolidation as complete.
3. Preserve #403/#404 compliance repairs.
4. Continue the remaining runtime gates in the order above, prioritising browser-verifiable PAF + owner mutation + Driver Instruction before provider/device-dependent gates.
5. Keep production Supabase `jqxlauexhkonixtjvljw` as the canonical hosted source of truth.

This is the canonical continuation checkpoint after the #395/#398 -> #399 consolidation merge and the subsequent #403/#404 compliance repairs.