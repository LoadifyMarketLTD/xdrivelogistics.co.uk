# CX → XDrive PR #399 Continuity Checkpoint — Post Smart Alerts — 2026-08-29

Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
Branch: `fix/cx-dashboard-convergence-20260829`
Pull request: `#399 — CX-close operational workspace convergence`
Previous checkpoint: `docs/checkpoints/CX_TO_XDRIVE_PR399_CONTINUITY_CHECKPOINT_2026-08-29_1715.md`
Implementation HEAD immediately before this checkpoint file: `23dd7ffe2fc3d862d1458e83f16ced06a1309f38`
Base: `main` at `5eb2443d331de05f5b521558dc88a9772de22bd9`

This checkpoint supersedes the previous PR #399 continuity checkpoint for resumption purposes. Do not restart the Courier Exchange screenshot audit and do not ask the user to resend the CX screenshot batch.

## 1. Verified PR state immediately before checkpoint creation

PR #399 was verified as:
- OPEN
- DRAFT
- MERGEABLE
- NOT MERGED
- head branch `fix/cx-dashboard-convergence-20260829`
- implementation HEAD `23dd7ffe2fc3d862d1458e83f16ced06a1309f38`

Do not infer future PR state from this checkpoint; re-fetch PR #399 and the branch HEAD first when resuming.

## 2. Non-negotiable protected boundaries

- `/super-admin` remains out of scope and untouched by this convergence work.
- Do not import or resurrect PR #359 Workspace visual changes.
- Expo / React Native in `apps/driver-mobile` remains the Driver application base.
- Do not reintroduce Android-native/Kotlin as the Driver application.
- Do not relax RLS/security/authorization to obtain parity.
- Do not create fake UI parity when the backend contract does not exist.
- Do not call migrations hosted/applied until Supabase is explicitly verified.
- Do not call tests/build/typecheck/browser/E2E PASS unless those commands actually execute successfully.
- Keep exact pre-award location privacy. Public marketplace and alert payloads must not expose private exact coordinates/addresses.

## 3. Multi-drop — current repository truth

The Multi-drop work is now materially beyond the original foundation.

Implemented:
- persisted ordered `public.job_stops` foundation in `supabase/migrations/20260829170500_job_stops_multidrop_foundation.sql`;
- server-authoritative ordered stop reads in Driver Mobile jobs payload;
- stop progression route `app/api/driver/mobile/jobs/[id]/stop-status/route.ts`;
- current/next actionable stop enforcement;
- `pending -> arrived -> completed` progression;
- out-of-order rejection;
- concurrency/status compare guard so parallel requests cannot silently advance the same stop;
- server refresh after mutation rather than fake optimistic state;
- parent job lifecycle remains separate from stop-local lifecycle;
- final POD / parent Delivered is blocked for jobs with persistent stops until all stops are `completed` or `skipped`;
- Driver Expo UI wires real Arrived / Completed actions;
- stop mutation is explicitly online-only until a safe idempotent ordered offline queue exists;
- focused Multi-drop contract coverage exists.

Status: `PARTIAL` only because hosted `job_stops` migration and physical Expo E2E remain unverified. Do not downgrade the implementation to the old “classification only” description, and do not upgrade it to release PASS.

## 4. Telematics — current repository truth

Provider-neutral telematics is also beyond the initial foundation.

Relevant migrations/routes:
- `supabase/migrations/20260829165000_telematics_location_source_foundation.sql`
- `supabase/migrations/20260829173500_telematics_driver_bindings.sql`
- `app/api/integrations/telematics/location/route.ts`
- `__tests__/telematicsIngestContract.test.ts`

Implemented contract:
- provider-scoped HMAC secret configuration;
- signed server-to-server ingestion;
- replay window enforcement;
- event idempotency;
- provider-native `provider_driver_id` + `provider_vehicle_id` required;
- binding resolves to canonical XDrive driver + vehicle + company;
- disabled/revoked bindings rejected;
- canonical vehicle must be active, assigned to the driver and company-consistent;
- job assignment/carrier checks preserved;
- `jobs.vehicle_id`, when present, must agree with the mapped vehicle;
- telematics location provenance records source/provider/event plus canonical job/company/vehicle context;
- direct canonical driver id in payload may confirm a binding but may not bypass provider identity mapping.

Status: `PARTIAL` because hosted migrations, credential administration/provider onboarding and runtime provider proof remain pending.

## 5. Driver Smart Load Alerts — newly completed repository implementation

The earlier Load Alerts audit correctly said an inbox bell was not Smart Alerts. PR #399 now contains a real Driver alert contract rather than a cosmetic toggle.

New/updated files include:
- `supabase/migrations/20260829185000_driver_load_alerts_foundation.sql`
- `supabase/migrations/20260829185200_load_alert_notification_delivery_contract.sql`
- `app/api/driver/load-alert-preferences/route.ts`
- `app/driver/load-alerts/page.tsx`
- `app/driver/_components/AccountSectionNav.tsx`
- `app/driver/_components/DriverWorkspaceShell.tsx`
- `supabase/functions/notify-operational-event/index.ts`
- `__tests__/driverLoadAlertsContract.test.ts`

Implemented behaviour:
- opt-in persisted `driver_load_alert_preferences`;
- strict own-user RLS and Driver ownership checks;
- at least one matching source and one delivery channel required when enabled;
- current-position radius matching with stale-location maximum age;
- home-area outcode matching without storing/exposing a private home address;
- future / return-position matching against collection timing;
- canonical active vehicle type matching option;
- minimum budget filter;
- exchange/direct visibility and own-company exclusion;
- exact job/driver coordinates used only inside protected server/database matching;
- emitted payload exposes public pickup/delivery outcodes, not exact coordinates;
- one `load_alert` per job + recipient through unique dedupe;
- recipient-scoped catch-up evaluation for recent open loads when preferences change;
- in-app/email/push channel flags;
- inbox bridge honours `in_app_enabled`;
- notification worker has a real `load_alert` handler for email/push and does not classify the event as unknown/skipped;
- Driver Account exposes `Load Alerts` as a real discoverable settings page;
- if hosted schema is missing, the page is disabled and says the feature is not active in that environment; it does not pretend settings were saved;
- user-facing Smart Alert wording was humanised; technical migration/protected-contract wording is not shown as normal product copy.

Important focused-test self-audit:
- the first Smart Alerts test contained one incorrect string assertion (`p_user_id is not null`) while SQL correctly failed closed with `if p_user_id is null then return 0; end if;`;
- that test assertion was repaired in commit `df6b502440e7eeffd6b6e7233cc34d76a57c7f58`;
- the test file now reflects the repository contract, but the test command has NOT been observed executing successfully because GitHub Actions is not starting runners.

Status: Driver Smart Load Alerts are `PARTIAL` only because hosted migrations and runtime delivery proof remain pending. Fleet/Carrier Smart Alert semantics are NOT automatically supplied by the Driver contract and remain a separate gap.

## 6. Hosted Supabase truth

Production project:
- ref: `jqxlauexhkonixtjvljw`
- name: `xdrivelogistics`
- observed active/healthy during this workstream.

Production migration history was explicitly listed and currently ends at:
- `20260827141443_driver_mobile_device_session_installation_conflict`

Therefore the following PR #399 migrations are NOT HOSTED/APPLIED:
1. `20260829165000_telematics_location_source_foundation.sql`
2. `20260829170500_job_stops_multidrop_foundation.sql`
3. `20260829173500_telematics_driver_bindings.sql`
4. `20260829185000_driver_load_alerts_foundation.sql`
5. `20260829185200_load_alert_notification_delivery_contract.sql`

Do not use the Supabase MCP `apply_migration` merely to mark these applied. That tool generates its own migration version and cannot preserve the repository filename version, which would create remote/local migration-history drift.

The repo already contains the approved version-safe validation path:
- `.github/workflows/validate-supabase-staging.yml`
- approved staging project ref `svfjlhljuizckzabtewx`
- Supabase CLI `migration list` / repair legacy remote-only versions / `db push --dry-run --include-all`.

The staging project could not be restored/resolved through the available Supabase connector in this session, so no safe staged replay was executed.

The Supabase GitHub integration also reported the PR as ignored / not associated with a preview branch. That must NOT be interpreted as migrations applied or validated.

## 7. Parity ledger truth

Canonical ledger:
- `docs/canonical/CX_TO_XDRIVE_PARITY_LEDGER_2026-08-29.md`

Ledger was reconciled on implementation HEAD `23dd7ffe...`.

Notable current dispositions:
- Driver Smart Load Alerts: `PARTIAL` — repository contract implemented; hosted/runtime gate remains.
- Fleet/Carrier Load Alerts: `PARTIAL` — recipient/preference ownership contract not implemented.
- Multi-drop: `PARTIAL` — repository execution implemented; hosted + physical Expo gate remains.
- Telematics: `PARTIAL` — provider mapping implemented; hosted/runtime provider gate remains.
- Customer Messages / Broker Messages / Carrier/Fleet/Dispatcher participant Messenger: `KEEP` static contract; runtime regression still required.
- Customer booking disputes: `KEEP` static contract.
- Broker dispute resolution/escalation: `KEEP` static contract.
- Driver Leave/Edit Feedback: `BLOCKED-BY-CONTRACT` under current non-driver review-insert policy.
- Ready to Invoice: `KEEP` static contract.
- Off-platform reconciliation / mark paid: `KEEP` static contract.
- Statements/export: `KEEP` static contract.
- External Invoice Upload: `BLOCKED-BY-CONTRACT`.
- Batch finance mutations: `BLOCKED-BY-CONTRACT`.
- Customer carrier reputation aggregate: still incomplete / blocked by reviewed-party semantics.
- Customer carrier ETA/distance-to-pickup before award: still incomplete because no universal canonical offered driver/vehicle position contract exists for every carrier bid.

## 8. Discoverability truth

Completed:
- Driver Smart Load Alerts is discoverable from Driver Account.
- No primary Driver navigation redesign was introduced.
- No PR #359 UI was imported.

Audited but intentionally NOT faked:
- `/admin/companies` is the current-company management/profile surface, NOT a public carrier Directory; do not relabel it Directory.
- `/admin/drivers-vehicles` is a legacy redirect to `/admin/drivers`, not a real consolidated Drivers & Vehicles register; do not present it as one.
- Fleet already has real `/admin/fleet/drivers`, `/admin/fleet/vehicles` and `/admin/fleet/availability` routes.
- `/admin/live-availability` is a real Live/Future/Nearby operational surface.
- `/admin/messages` is a real participant-scoped messaging surface.

Remaining navigation work should only promote real routes after role permission/browser validation. Do not invent a Directory or combined Drivers & Vehicles page solely to resemble CX.

## 9. Validation / CI / Netlify truth

### GitHub Actions

Current PR runs repeatedly show GitHub Actions jobs failing before any workflow step starts:
- `steps: []`
- `runner_id: 0`
- empty runner name
- no checkout/test/build step executed.

The same no-runner signature was observed on `main`, not only PR #399.

Consequences:
- repository test suite: NOT EXECUTED / NOT PASS;
- Next build through GitHub Actions: NOT EXECUTED / NOT PASS;
- web TypeScript gate: NOT EXECUTED / NOT PASS;
- Expo Driver Typecheck: appears SKIPPED, not PASS;
- Public E2E: NOT EXECUTED / NOT PASS;
- migration-file workflow: NOT EXECUTED / NOT PASS;
- visual fixture gate: NOT EXECUTED / NOT PASS.

Do not describe GitHub Actions failures as test failures in the application code unless a future run actually starts a runner and produces command output.

### Netlify

On implementation HEAD `23dd7ffe2fc3d862d1458e83f16ced06a1309f38`:
- canonical site `xdrivelogistics` Deploy Preview: FAILURE;
- duplicate site `silly-faloodeh-cea857`: canceled/neutral by repository ignore policy, not a real successful build.

Repo guard:
- `scripts/netlify-ignore-foreign-site.mjs` intentionally skips every Netlify site except `SITE_NAME=xdrivelogistics`.

Official build command:
- `npm run build`
- which runs `npm run validate:supabase-env && next build`.

Deployment env validation requires on Netlify:
- exact `NEXT_PUBLIC_SUPABASE_URL=https://jqxlauexhkonixtjvljw.supabase.co`;
- valid `NEXT_PUBLIC_SUPABASE_ANON_KEY` / publishable key.

GitHub exposes only “Deploy failed”; detailed Netlify log is in the Netlify dashboard and was not available through installed connectors. Therefore DO NOT guess whether the canonical failure is environment validation or compilation until the deploy log is inspected.

### Local execution

A direct local clone/download from the execution container was blocked by network/DNS restrictions to GitHub. The GitHub connector remained functional, but no local repository checkout suitable for `npm install`, `npm run build`, `npm test` or `tsc` was obtained.

Therefore local build/test/typecheck remains NOT EXECUTED.

### Physical mobile E2E

No real device/Expo physical E2E was run. Static Expo code review and contract tests do not substitute for physical E2E.

## 10. Remaining CX gaps after this checkpoint

Do not regress completed capabilities. Remaining work is:

1. **Canonical Netlify failure diagnosis**
   - inspect official `xdrivelogistics` deploy log;
   - determine environment-vs-compile failure from evidence;
   - repair only the proven cause.
2. **Version-safe hosted migration validation/deployment**
   - use approved Supabase CLI/staging path when available;
   - apply/verify the five Aug-29 migrations without migration-history drift.
3. **Customer carrier comparison**
   - privacy-safe reputation aggregate with unambiguous reviewed-party identity;
   - canonical pre-award ETA/distance only if a real offered driver/vehicle position contract is defined.
4. **Fleet/Carrier Smart Alerts**
   - define recipients, company-vs-user preferences, matching ownership and channels separately from Driver alerts.
5. **Driver reciprocal Leave/Edit Feedback**
   - remain blocked until reviewed-party identity and safe RLS write policy are deliberately designed.
6. **External Invoice Upload**
   - evidence storage/ownership, duplicate detection, invoice binding, permissions and audit first.
7. **Batch finance mutations**
   - atomicity, idempotency, partial-failure and audit semantics first.
8. **Telematics integration management**
   - provider credential/binding administration and real provider runtime proof after migrations.
9. **Role discoverability**
   - only promote verified real routes after permissions/browser validation; do not invent CX labels for unrelated pages.
10. **Final role/browser wording sweep**
   - remove technical leakage from user-facing screens where found, while retaining actionable error meaning.

## 11. Exact continuation order

On resume:

1. Re-fetch PR #399 and current branch HEAD.
2. Read this checkpoint completely.
3. Diagnose canonical Netlify `xdrivelogistics` preview failure from the actual deploy log if access is available.
4. Re-check GitHub Actions runner health; if jobs finally start, run/observe Build & Lint, unit/contract tests, web typecheck, Expo typecheck, migration gates and Public E2E. Do not use the old no-runner failures as application-test evidence.
5. Restore/use approved Supabase staging CLI path and run version-safe migration inventory + dry run.
6. Only after dry-run success, plan hosted application of the five migrations and verify schema/RLS/functions/indexes.
7. Runtime-test Multi-drop on hosted DB and then physical Expo device.
8. Runtime-test Telematics with a mapped provider identity/vehicle using signed ingestion.
9. Runtime-test Driver Smart Alerts end-to-end: preference save -> matcher -> deduped notification event -> inbox/email/push according to channels; prove no exact coordinate leakage.
10. Continue Customer reputation/ETA contract work only if it can be made canonical and privacy-safe.
11. Keep Driver feedback, external invoice upload and finance batch mutations blocked until their protected contracts exist.
12. Finish browser role/discoverability regression.
13. Only when all release gates are factual PASS should PR #399 leave Draft / be considered for merge.

## 12. Final release gate checklist

Do NOT call PR #399 release-ready until all applicable gates have actual evidence:

- [ ] canonical Netlify preview PASS
- [ ] GitHub Actions jobs actually start and execute
- [ ] web build PASS
- [ ] web TypeScript PASS
- [ ] unit/contract tests PASS
- [ ] Public E2E PASS
- [ ] migration validation PASS with repository versions preserved
- [ ] five PR #399 migrations hosted/applied/verified
- [ ] Supabase security/RLS advisors reviewed after DDL
- [ ] Multi-drop hosted/runtime E2E PASS
- [ ] Telematics hosted/runtime signed provider test PASS
- [ ] Driver Smart Alerts hosted/runtime delivery PASS
- [ ] role/browser regression PASS
- [ ] physical Expo Driver E2E PASS
- [ ] no `/super-admin` regression
- [ ] no PR #359 Workspace visual regression
- [ ] PR remains mergeable against current `main`

Until then PR #399 remains Draft and NOT MERGED.
