# CX → XDrive Post-Merge Checkpoint — 2026-08-30 01:48 UTC / 02:48 BST

Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`  
Canonical branch: `main`  
Consolidated pull request: `#399 — CX-close operational workspace convergence`  
Superseded source PRs: `#395`, `#398`  
Production Supabase: `jqxlauexhkonixtjvljw` (`xdrivelogistics`)

This checkpoint supersedes the PR-stage continuation checkpoint for current repository state. Future work must start from `main`, not from the old PR #399 branch.

---

## 1. Final GitHub disposition

Verified immediately after consolidation:

- PR #399: **CLOSED / MERGED**
- PR #399 source HEAD: `221601de315450fd6523868ca539f24713d04d44`
- PR #399 merge commit: `47936816984df9ef7cfceac9ffb36b5d37afd278`
- merge timestamp: `2026-08-30T01:45:49Z`
- `main` immediately before this documentation-only checkpoint commit: `47936816984df9ef7cfceac9ffb36b5d37afd278`
- merge parents:
  - previous `main`: `5eb2443d331de05f5b521558dc88a9772de22bd9`
  - consolidated PR #399 HEAD: `221601de315450fd6523868ca539f24713d04d44`

Source PR disposition:

- PR #395: **CLOSED / NOT MERGED / SUPERSEDED BY #399**
- PR #398: **CLOSED / NOT MERGED / SUPERSEDED BY #399**

Do not reopen or merge #395/#398 wholesale. Their safe, useful changes were selectively consolidated; stale/non-canonical content remains intentionally excluded.

Canonical consolidation matrix:

`docs/canonical/PR395_PR398_TO_PR399_CONSOLIDATION_MATRIX_2026-08-30.md`

---

## 2. Netlify / executable web build truth

Canonical PR #399 deploy-preview status was re-fetched on the exact final source HEAD:

- commit: `221601de315450fd6523868ca539f24713d04d44`
- context: `netlify/xdrivelogistics/deploy-preview`
- state: **SUCCESS**
- description: `Deploy Preview ready!`
- preview: `https://deploy-preview-399--xdrivelogistics.netlify.app`
- observed status time: `2026-08-30T01:43:25Z`

The unrelated duplicate Netlify context `silly-faloodeh-cea857` is not application evidence and must continue to be ignored.

The merge commit `47936816984df9ef7cfceac9ffb36b5d37afd278` had no GitHub combined-status contexts attached when re-fetched immediately after merge. Therefore:

- the exact PR source tree has a factual canonical Netlify **PASS**;
- the merge itself is factual and `main` contains that source tree;
- do not manufacture a separate GitHub-status PASS for the merge commit unless a real status later appears.

The user also visually reported the deploy green after merge. Treat that as observed UI evidence, while the GitHub API evidence above remains the canonical machine-readable build record currently captured here.

---

## 3. GitHub Actions truth — still infrastructure blocked

Workflow runs exist on final PR HEAD `221601de315450fd6523868ca539f24713d04d44`, but the jobs still fail before runner startup.

Verified CI job shape includes:

- `Public E2E Smoke`: `steps: []`, `runner_id: 0`, empty runner name
- `Build & Lint`: `steps: []`, `runner_id: 0`, empty runner name
- `CodeQL Security Scan (javascript-typescript,actions)`: `steps: []`, `runner_id: 0`, empty runner name
- `Detect Expo Driver Changes`: `steps: []`, `runner_id: 0`, empty runner name
- `Expo Driver Typecheck`: skipped downstream
- `CodeQL Security Scan (java-kotlin)`: skipped

Additional workflow runs such as migration-file validation, visual fixture validation, notification secret scrub and job-creation idempotency also conclude before meaningful execution while Actions credits/billing capacity are unavailable.

Correct classification:

**NOT EXECUTED — BILLING/CREDITS / RUNNER STARTUP UNAVAILABLE**

Do not relabel these as:

- application-test failures;
- unit-test PASS;
- E2E PASS;
- Expo typecheck PASS;
- migration-validator PASS.

When GitHub Actions capacity is restored, rerun the normal workflows from current `main` and replace this infrastructure exception with real execution evidence.

---

## 4. Production Supabase migration truth

Production remains the authoritative hosted database for this workstream:

- project ref: `jqxlauexhkonixtjvljw`
- project name: `xdrivelogistics`

The current hosted migration list includes the complete PR #399 / consolidation set:

1. `20260829192805_telematics_location_source_foundation`
2. `20260829192913_job_stops_multidrop_foundation`
3. `20260829192952_telematics_driver_bindings`
4. `20260829193038_driver_load_alerts_foundation`
5. `20260829193101_fix_driver_load_alert_vehicle_key_normalization`
6. `20260829193123_load_alert_notification_delivery_contract`
7. `20260829193633_harden_pr399_load_alert_function_boundaries`
8. `20260829193829_optimize_pr399_rls_and_fk_indexes`
9. `20260829221052_repair_job_publish_compliance_and_idempotency`
10. `20260830004421_port_driver_return_journey_canonical_atomic_replace`
11. `20260830004958_port_driver_pod_damage_evidence`
12. `20260830011635_port_driver_rich_quote_structure`

Do not return to stale staging migration truth for this completed consolidation unless a future task explicitly creates a new controlled staging branch.

---

## 5. Production Edge Function truth

`notify-operational-event` is currently:

- version: **14**
- status: **ACTIVE**
- `verify_jwt`: **true**

Authentication was not weakened during consolidation.

---

## 6. Current production runtime inventory

Read-only verification immediately after merge:

- `job_stops`: **4**
- `telematics_driver_bindings`: **0**
- `driver_load_alert_preferences`: **0**
- `notification_events(event_type='load_alert')`: **0**

The four `job_stops` are the real authenticated Multi-drop booking evidence already created during PR #399 validation. No fake rows were inserted to manufacture runtime success.

Implications:

- Multi-drop Post Load persistence has real production evidence.
- Telematics provider runtime remains intentionally inert because no real binding exists.
- Driver Smart Load Alerts remain intentionally inert because no real Driver preference exists.

---

## 7. Consolidated capability baseline now in `main`

The following are part of the merged canonical source tree, subject to the runtime qualifications documented below:

### Driver / Expo / execution

- Expo/React Native remains the canonical Driver application.
- ordered Multi-drop `job_stops` route model;
- current-stop progression / ordering guards;
- final delivery/POD blocked until route completion;
- durable offline collection/POD evidence flow;
- damage evidence contract;
- server-mediated device-bound evidence upload;
- staged delivery evidence until final POD;
- signed POD and job attachments;
- richer job detail/history/audit presentation;
- Driver device-session binding and explicit logout revocation;
- Live Loads / quote calls use the shared device-bound API client.

### Marketplace / commercial

- fail-closed Exchange visibility;
- Exchange expiry enforced across Driver and Company Marketplace entry points;
- one active quote per carrier company/job semantics;
- company quote suppression exposes only job IDs to peer Drivers, not colleagues' commercial quote details;
- structured rich quote metadata:
  - final total remains canonical `amount` / quote total;
  - structured base amount;
  - structured additional extras;
  - optional collect-within minutes;
  - server-validated canonical vehicle snapshot;
- exact pre-award coordinates/addresses remain private.

### Return Journey / resources / notifications

- canonical server-only atomic Return Journey replacement;
- no competing Journey-v2 schema introduced;
- Driver resources keep identity/auth fail-closed while peripheral subsystems can return a `partial` projection;
- Expo alert resources reconcile operational `notification_events` with Driver inbox `notifications` where required for compatibility/Driver Instructions.

### Fleet / tracking

- tracking tenant isolation follows assigned/awarded carrier-company boundaries;
- Fleet availability presence is privacy-safe;
- newer #399 Availability/Drivers/Vehicles contracts remain canonical over older #398 variants.

### Customer/Broker operational flow

- authenticated Multi-drop Post Load route persistence;
- standard two-point bookings preserved;
- complete route is persisted before public publish for Multi-drop;
- Customer Job Record projects persisted ordered stops;
- pre-award owner Edit/Delete authority contract exists;
- append-only post-award Driver Instructions contract exists without reopening core awarded transport terms;
- PAF/address-by-postcode integration is provider-bound server-side with manual fallback.

---

## 8. Explicitly rejected / not merged from source PRs

These exclusions are intentional and must not be treated as accidental missing cherry-picks:

### PR #395

- `android-native/**/*.kt` application implementation — **DO NOT PORT**;
- Collection Pass foundation without a complete verifier/site workflow — **DO NOT EXPOSE AS FINISHED SECURITY FEATURE**;
- duplicate/parallel Journey v2 RPC/schema — **SUPERSEDED**;
- dead/global alert preference foundation without complete canonical Expo lifecycle — **DO NOT PORT**;
- dead search-filter-default table without complete lifecycle — **DO NOT PORT**.

### PR #398

- stale Android-native runtime/tests — **DO NOT PORT**;
- Supabase local `.temp` metadata — **DO NOT PORT**;
- older overlapping implementations replaced by the newer Multi-drop / Workspace / Expo contracts in #399 — **SUPERSEDED**.

Collection Pass may be designed later only as a complete product contract with issuer + verifier + expiry/revocation + audit + operational UX. Do not add a visible code/pass merely to claim parity.

---

## 9. Protected boundaries remain mandatory

- `/super-admin` remains untouched by this convergence.
- Do not import PR #359 Workspace visual changes.
- Do not redesign the existing Workspace visual shell under the guise of functional parity.
- `apps/driver-mobile` Expo/React Native remains the Driver app base.
- Do not resurrect Android-native/Kotlin as the application.
- No RLS/security relaxation.
- No fake parity controls.
- No public exact pre-award addresses/coordinates.
- Do not call unexecuted tests PASS.

---

## 10. Factual runtime evidence already completed

### Multi-drop booking persistence — PASS

A real authenticated Customer booking created the complete ordered production route for job:

`f44031b6-2f86-4582-ab46-4fe0dcf0a51e`

Production contains four ordered `job_stops`, and the authorised Customer Job Record was subsequently observed displaying all four stops.

This is enough to mark **Post Load Multi-drop persistence + authorised stop projection** as factual PASS/observed.

It is not enough to mark physical Driver stop progression or final POD execution PASS.

---

## 11. Remaining post-merge operational validation

These are no longer fragmented source-PR consolidation tasks. They are operational/runtime proof tasks against the new canonical `main`.

### A. Owner Edit/Delete runtime

Use a disposable unawarded/pre-execution test job:

- harmless edit succeeds when capability allows;
- protected fields/bid-bearing states remain locked according to contract;
- disposable eligible job can be deleted;
- awarded/allocated/progressed jobs reject destructive edit/delete.

### B. Post-award Driver Instructions runtime

On a real test job:

- award/allocate;
- append an instruction;
- verify immutable tracking history;
- verify Driver `Special Instructions` projection;
- verify Driver inbox projection when assigned;
- verify terminal job rejects new instructions.

### C. PAF postcode-address lookup runtime

With the configured provider key:

- authenticated lookup returns expected address list for a real UK postcode;
- server-only provider key remains private;
- manual address fallback remains usable.

### D. Driver Multi-drop physical Expo execution

On the production test route or a fresh disposable route:

- current stop Arrived;
- current stop Completed;
- out-of-order later stop blocked;
- refresh recovers server-authoritative progression;
- collection evidence / offline replay behaves correctly;
- delivery/POD remains blocked until all required earlier stops are completed/skipped according to contract;
- final POD succeeds only at the valid terminal state;
- verify on a physical Expo device.

### E. Telematics real-provider runtime

Requires a real provider path; do not fabricate a provider binding:

- provider credentials/configuration;
- provider driver + provider vehicle binding;
- XDrive Driver + Vehicle + company binding;
- valid signed ingest accepted;
- replay/duplicate handled correctly;
- revoked binding rejected;
- wrong vehicle/company/job assignment rejected;
- provenance remains `telematics` only through server authority.

### F. Driver Smart Load Alerts runtime

Requires a real authenticated Driver preference:

- save preference through protected UI/API;
- create/use qualifying load;
- matcher creates one deduped event;
- Driver inbox receives it;
- email/push only if those channels are enabled;
- no exact coordinates/address leakage in recipient-facing content.

### G. Browser role/discoverability regression

Run final role regression across supported workspaces without importing PR #359 UI differences and without touching `/super-admin`.

### H. GitHub Actions rerun when credits return

Once runners are available, execute and record actual results for:

- Build & Lint;
- unit/contract tests;
- Public E2E;
- Expo Driver Typecheck;
- migration validation;
- relevant security/static workflows.

Until then, retain `NOT EXECUTED — INFRASTRUCTURE/BILLING` classification.

---

## 12. Remaining product gaps intentionally not falsely closed

The merge of #399 does not mean every Courier Exchange-inspired idea is finished.

Still separate/blocked unless implemented later with a complete canonical contract:

- Customer carrier reputation aggregate / canonical reviewed-party identity;
- privacy-safe pre-award bidder ETA/distance backed by proven provider runtime;
- Fleet/Carrier Smart Alert recipient/preference semantics beyond the Driver alert contract;
- reciprocal Driver Leave/Edit Feedback under protected review semantics;
- protected External Invoice Upload;
- atomic/idempotent Batch Finance mutations;
- Telematics credential/provider administration UI/ops workflow;
- full Collection Pass verifier product.

Do not resurrect old source PR implementations just to fill these gaps.

---

## 13. Exact continuation order from this checkpoint

1. Re-fetch `main` first; do not resume from PR #399 branch.
2. Treat production `jqxlauexhkonixtjvljw` as hosted DB truth.
3. Complete Owner Edit/Delete runtime proof using disposable test data.
4. Complete post-award Driver Instructions runtime proof.
5. Complete real PAF postcode-address lookup proof.
6. Complete authenticated Driver Multi-drop progression + final POD gate, then physical Expo verification.
7. Complete Telematics only when a real provider credential/binding path exists.
8. Complete Driver Smart Alerts only through a real authenticated preference/matcher flow.
9. Run browser role/discoverability regression.
10. Rerun GitHub Actions only after runner/credit capacity is restored; record real outcomes.
11. Address remaining product gaps as separate canonical workstreams, not by reopening #395/#398.

---

## 14. Final consolidation verdict

### PR #395

**CLOSED / NOT MERGED / SUPERSEDED — FINAL**

### PR #398

**CLOSED / NOT MERGED / SUPERSEDED — FINAL**

### PR #399

**MERGED INTO `main` — FINAL CONSOLIDATION COMPLETE**

The source-code consolidation phase is complete.

The remaining items are operational validation and future product work. They must continue from the current `main` baseline and must preserve the protected architecture/security boundaries above.
