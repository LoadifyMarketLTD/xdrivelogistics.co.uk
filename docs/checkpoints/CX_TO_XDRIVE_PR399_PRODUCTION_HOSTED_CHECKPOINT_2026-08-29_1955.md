# CX → XDrive PR #399 Production Hosted Checkpoint — 2026-08-29 19:55 UTC

Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`  
Branch: `fix/cx-dashboard-convergence-20260829`  
Pull request: `#399 — CX-close operational workspace convergence`  
Supersedes for current hosted-state truth: `docs/checkpoints/CX_TO_XDRIVE_PR399_CONTINUITY_CHECKPOINT_2026-08-29_POST_SMART_ALERTS.md`

## 1. Current PR truth

Re-fetched PR #399 after the Netlify-agent TypeScript repair:
- OPEN
- DRAFT
- MERGEABLE
- NOT MERGED
- branch `fix/cx-dashboard-convergence-20260829`
- HEAD `044229ccc1d4ecef04b342cb36dc74205d85a568`
- base `main` at `5eb2443d331de05f5b521558dc88a9772de22bd9`

Do not infer later PR state from this file; re-fetch first on resume.

## 2. Protected boundaries remain unchanged

- `/super-admin` untouched and out of scope.
- Do not import PR #359 Workspace visual changes.
- Expo / React Native under `apps/driver-mobile` remains the Driver app base.
- Do not reintroduce Android-native/Kotlin as the Driver app.
- No RLS/security relaxation.
- No fake parity/discoverability.
- Preserve exact pre-award location privacy.
- Do not call tests/runtime gates PASS unless actually observed.

## 3. Production Supabase is now the source of truth

Per current execution decision, staging is no longer used as the authoritative migration gate for this workstream. The canonical database is production:

- project name: `xdrivelogistics`
- project ref: `jqxlauexhkonixtjvljw`
- URL: `https://jqxlauexhkonixtjvljw.supabase.co`

The previous checkpoint statement that the Aug-29 migrations were NOT HOSTED is obsolete.

### Hosted migration history now includes

1. `20260829192805_telematics_location_source_foundation`
2. `20260829192913_job_stops_multidrop_foundation`
3. `20260829192952_telematics_driver_bindings`
4. `20260829193038_driver_load_alerts_foundation`
5. `20260829193101_fix_driver_load_alert_vehicle_key_normalization`
6. `20260829193123_load_alert_notification_delivery_contract`
7. `20260829193633_harden_pr399_load_alert_function_boundaries`
8. `20260829193829_optimize_pr399_rls_and_fk_indexes`

Repository migration filenames were aligned to the hosted versions rather than leaving remote/local version drift.

## 4. Hosted schema verification completed

### Telematics provenance

Verified on production:
- `driver_locations` has the new source/provider/job/company/vehicle provenance columns;
- existing Driver location data was preserved;
- geography/numeric coordinate reconciliation is present;
- `source='telematics'` remains reserved for server-side ingestion;
- direct authenticated Driver writes do not gain telematics provenance authority.

### Multi-drop

Verified on production:
- `public.job_stops` exists;
- RLS is enabled;
- no direct `anon` / `authenticated` table access is granted;
- `service_role` is the server authority;
- ordered stop/status constraints and parent-job FK are hosted.

The booking path is now also wired end-to-end in the PR:
- Customer/Broker Post Load exposes optional `Additional stops` without redesigning the Workspace shell;
- up to 8 intermediate stops can be ordered as collection/delivery stops;
- standard two-point bookings remain unchanged when no additional stop exists;
- for a published Multi-drop, the parent job remains draft/private until the complete `job_stops` route persists;
- only after successful stop persistence is the job promoted to `posted/exchange`;
- exact intermediate stop addresses are execution data, not pre-award Marketplace payload;
- idempotency replay verifies the complete stop count before treating a previous submission as clean.

Current hosted runtime inventory still has `job_stops = 0`; no production stop data was fabricated during migration or connector testing.

### Telematics provider binding

Verified on production:
- `public.telematics_driver_bindings` exists;
- RLS/fail-closed server-only boundary is active;
- no fake provider bindings were inserted;
- current hosted row count is `0` until real provider onboarding/mapping.

### Driver Smart Load Alerts

Verified on production:
- preference table exists;
- matcher/dedupe contract exists;
- notification delivery functions exist;
- preferences default opt-in/off;
- no accidental `load_alert` events were generated during migration;
- exact coordinates are not part of public alert payload design.

Current hosted runtime inventory:
- `driver_load_alert_preferences = 0`
- `notification_events(event_type='load_alert') = 0`

Vehicle-type normalization bug found during live verification was repaired in the dedicated corrective migration `20260829193101`; e.g. uppercase `LWB 3.5T` now normalizes consistently instead of losing uppercase letters before lowercase conversion.

## 5. Security / performance hardening

Production advisor review found PR-specific issues after initial hosted application and they were corrected through dedicated migrations rather than rewriting already-applied history.

Security hardening:
- trigger-function direct RPC boundary closed;
- helper function `search_path` fixed;
- service-role-only execution boundaries retained;
- PR-specific security warnings identified during this pass were cleared.

Performance hardening:
- new RLS ownership checks were optimized without changing authorization semantics;
- complete FK covering indexes were added where the initial hot-path partial indexes were insufficient;
- existing hot-path indexes were not removed.

The production project still has legacy/global Supabase advisor warnings unrelated to PR #399. Do not silently broaden this PR into a full historical database cleanup.

`job_stops` and `telematics_driver_bindings` may appear as RLS-enabled-with-no-client-policy informational findings; this is intentional fail-closed server-only design.

## 6. Edge Function production truth

`notify-operational-event` is deployed on production as:
- version `12`
- status `ACTIVE`
- `verify_jwt=true`

The deployed version includes the PR #399 `load_alert` handler and generic Driver push path while preserving authentication and the existing lease/idempotency architecture.

## 7. Netlify truth

Current HEAD `044229ccc1d4ecef04b342cb36dc74205d85a568` has an observed canonical Netlify success after the Netlify-agent TypeScript null-narrowing repair:
- context: `netlify/xdrivelogistics/deploy-preview`
- state: SUCCESS
- description: `Deploy Preview ready!`
- deploy id: `6a93467664972b0008697ada`
- preview: `https://deploy-preview-399--xdrivelogistics.netlify.app`
- Lighthouse: Performance 100 / Accessibility 97 / Best Practices 83 / SEO 100 / PWA 100

The repair was limited to preserving the already-validated `supabaseAdmin` client in a narrowed local `adminClient` for the nested Multi-drop replay callback; strict TypeScript checks were not disabled and Multi-drop logic was not weakened.

The duplicate `silly-faloodeh-cea857` deploy is not application evidence.

## 8. GitHub Actions truth

Current CI still fails before runner startup:
- `steps: []`
- `runner_id: 0`
- empty runner name

Observed affected jobs include:
- Detect Expo Driver Changes
- CodeQL JS/actions
- Build & Lint
- Public E2E Smoke

Expo Driver Typecheck and java/kotlin CodeQL remain skipped as downstream effects.

Therefore:
- GitHub Actions build: NOT EXECUTED / NOT PASS
- unit/contract tests: NOT EXECUTED / NOT PASS
- Public E2E: NOT EXECUTED / NOT PASS
- Expo Driver typecheck: NOT PASS

Do not call these application test failures; they are still runner/startup failures.

## 9. Runtime test constraint discovered

The available Supabase `execute_sql` connector session permits production SELECT/read verification but rejects mutation attempts with `cannot execute INSERT in a read-only transaction`.

A controlled rollback-only Multi-drop insert/progression test was attempted and stopped by that read-only boundary before any INSERT executed.

Do NOT work around this by creating fake data migrations or polluting migration history solely for tests.

Runtime proof must therefore use the real authenticated application/API/Expo path or another legitimate operational test path.

The current hosted production inventory for the new runtime objects is deliberately clean:
- `job_stops = 0`
- `telematics_driver_bindings = 0`
- `driver_load_alert_preferences = 0`
- `load_alert` notification events = 0

## 10. Capability status after hosted deployment

### Multi-drop Driver Mobile

Status: `PARTIAL — HOSTED DB + BOOKING CREATION CONTRACT COMPLETE / AUTHENTICATED RUNTIME + PHYSICAL EXPO PENDING`

The remaining gate is:
- create one authenticated Multi-drop booking through the real Post Load path so the hosted route exists;
- prove Driver server route progression against that route;
- prove ordering/idempotency/concurrency behaviour;
- prove final POD/delivered gate;
- execute on physical Expo device.

### Telematics

Status: `PARTIAL — HOSTED CONTRACT COMPLETE / PROVIDER RUNTIME PENDING`

Remaining:
- real provider credential configuration;
- real provider driver+vehicle binding;
- signed ingestion test;
- replay/dedupe/revocation/assignment rejection proof.

### Driver Smart Load Alerts

Status: `PARTIAL — HOSTED CONTRACT + EDGE WORKER COMPLETE / AUTHENTICATED RUNTIME DELIVERY PENDING`

Remaining:
- save a real Driver preference through the protected API/UI;
- matcher against a qualifying load;
- dedupe proof;
- in-app notification proof;
- email/push proof only for enabled channels;
- final confirmation that no exact location leaks into recipient-facing payload/content.

## 11. Remaining CX gaps unchanged unless separately implemented

- Customer carrier reputation aggregate / canonical reviewed-party identity.
- Canonical privacy-safe pre-award bidder ETA/distance.
- Fleet/Carrier Smart Alert ownership/recipient semantics.
- Driver reciprocal Leave/Edit Feedback under protected review semantics.
- External Invoice Upload protected contract.
- Batch finance mutations with atomicity/idempotency/audit.
- Telematics credential/provider administration UI/ops workflow.
- Browser role/discoverability regression.

Do not fabricate these as complete.

## 12. Exact continuation order from this checkpoint

1. Re-fetch PR #399 / HEAD before any new write.
2. Use production `jqxlauexhkonixtjvljw` as hosted database truth; do not regress to stale staging verdicts.
3. Create one authenticated Multi-drop booking through the real Customer/Broker Post Load path.
4. Verify the resulting `job_stops` route read-only in production, then execute Driver stop progression through authenticated API/app and physical Expo.
5. Runtime Telematics with a real mapped provider driver+vehicle and signed ingestion.
6. Runtime Driver Smart Alerts preference -> matcher -> dedupe event -> inbox/email/push according to enabled channels.
7. Continue only remaining CX gaps that have safe canonical contracts.
8. Browser role/discoverability regression.
9. Re-check GitHub Actions runner health and execute real gates if runners become available.
10. Keep PR #399 Draft until all applicable release gates have factual evidence.

## 13. Release gate snapshot

- [x] production hosted migration application verified
- [x] PR-specific hosted security hardening verified
- [x] PR-specific FK/RLS performance hardening applied
- [x] `notify-operational-event` v12 ACTIVE with JWT verification
- [x] Multi-drop booking creation path wired without changing standard two-point booking semantics
- [x] canonical Netlify preview observed SUCCESS on current code HEAD
- [ ] GitHub Actions runner starts jobs
- [ ] web CI build/test gates actually execute
- [ ] unit/contract tests execute successfully
- [ ] Public E2E executes successfully
- [ ] Expo Driver typecheck executes successfully
- [ ] authenticated Multi-drop booking creates hosted `job_stops`
- [ ] Multi-drop authenticated Driver runtime E2E
- [ ] physical Expo Multi-drop E2E
- [ ] Telematics real-provider runtime E2E
- [ ] Driver Smart Alerts authenticated runtime E2E
- [ ] final browser role/discoverability regression
- [ ] final parity ledger cleanup
- [ ] PR leaves Draft only after applicable gates are factual PASS
