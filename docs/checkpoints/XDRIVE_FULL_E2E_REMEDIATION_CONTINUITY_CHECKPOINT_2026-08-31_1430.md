# XDRIVE FULL E2E REMEDIATION — CONTINUITY CHECKPOINT

**Checkpoint time:** 2026-08-31 14:30 UTC  
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`  
**Workstream:** Full E2E Remediation / Production RLS convergence / release governance

> **CONTINUE EXACTLY FROM THIS CHECKPOINT. DO NOT RESTART THE AUDIT FROM ZERO.**

This checkpoint supersedes the active-state portions of:

`docs/checkpoints/XDRIVE_FULL_E2E_REMEDIATION_CONTINUITY_CHECKPOINT_2026-08-31_1345.md`

The earlier checkpoint remains useful for PR #430/#432 migration-history detail, but the active state has advanced substantially.

---

## 1. Canonical repository state

Current canonical `main` exact SHA:

`e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`

This remains the merge commit of PR #432.

Production Supabase project:

`jqxlauexhkonixtjvljw`

No Production DDL/DML was executed during the work recorded in this checkpoint.

No PR #359 visual Workspace content was imported.

---

## 2. PR #430 — MERGED / CLOSED

**PR #430 — Recover remaining hosted mid-August migrations**

Merge commit:

`8f3774558912f830daab8dee17fb5471d05165c1`

Outcome remains valid:
- hosted migration history restored;
- clean replay recovered;
- legacy `sync_job_bid_price()` / `trg_sync_job_bid_price` retired from canonical history/current Production;
- no PR #359 UI content imported.

---

## 3. PR #432 — MERGED / CLOSED

**PR #432 — Fail close clean-replay historical security artifacts**

Validated head before merge:

`afde9cefa38f9616d8f098d36999f1300efece87`

Merge commit / current `main`:

`e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`

Pre-merge exact-head evidence:
- Supabase preview SUCCESS;
- migration ledger 326;
- max migration `20260831104223`;
- `dashboard_stats` clean replay view hardened with `security_invoker=true`;
- three migration_068 snapshot tables fail-closed with RLS + revoked anon/authenticated;
- four target Security Advisor errors disappeared;
- canonical Netlify deploy preview SUCCESS.

Production intentionally remained unchanged because #432 repaired historical replay artifacts, not live objects.

---

## 4. Issue #433 — ACTIVE INFRASTRUCTURE / RELEASE-GOVERNANCE BLOCKER

**Issue #433 — Restore CI runner startup and Supabase PR preview gates**

Still OPEN.

### GitHub Actions — fresh evidence

Main retry evidence:
- main SHA: `e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`
- workflow run: `33396673193` — Validate Supabase Staging
- explicit rerun attempt: **2**
- job: `99517234367`
- result: failure
- `steps=[]`
- `runner_id=0`
- empty runner name/group
- approximately 2 seconds from create to completion

Fresh PR evidence from PR #438 exact head `a059e7950e158a1b76ffe413e4b177662576397e`:
- CI run `33402355685`
- Build & Lint: failure before steps, `steps=[]`, `runner_id=0`
- Public E2E Smoke: failure before steps, `steps=[]`, `runner_id=0`
- Detect Expo Driver Changes: failure before steps, `steps=[]`, `runner_id=0`
- CodeQL JS/TS/actions: failure before steps, `steps=[]`, `runner_id=0`
- Visual Fixture Gate run `33402355693`: failure with no executed steps

Conclusion:
- this is reproducible on a brand-new tests-only PR;
- do **not** classify these failures as code/test failures;
- do **not** enable required status checks while runners cannot allocate;
- do **not** use these failed jobs as release evidence.

### Supabase per-PR preview creation

PR #438 check:
- check name: `Supabase Preview`
- check id: `99521513556`
- result: **SKIPPED**
- exact integration message:
  `Creating a new preview branch per PR is disabled. You can re-enable it in Project Integrations Settings.`

Therefore the fresh writable preview required to execute new SQL regression tests is unavailable.

Existing connector previews are read-only; one confirmed:
- project ref `bewydwcwfhccwnjsqwyn`
- `transaction_read_only=on`
- `current_user=supabase_read_only_user`

Do not mutate stale/read-only previews as a substitute for a real PR preview.

---

## 5. Issue #436 — ACTIVE P0 SECURITY

**Issue #436 — P0: Remove Production-only broad jobs RLS exposure**

Confirmed Production-only policy:

`drivers_select_all_jobs`

Properties:
- `PERMISSIVE`
- `FOR SELECT`
- `TO authenticated`
- predicate checks only whether the authenticated user has a driver row with app access;
- predicate is not correlated to the current `jobs` row.

Important nuance already resolved:
- `jobs_preaward_marketplace_privacy_guard` is **RESTRICTIVE**;
- therefore `drivers_select_all_jobs` does not bypass private execution data while a row remains inside the canonical pre-award boundary;
- the real exposure is outside that boundary (post-award/runtime/delivered/etc.), where the restrictive function intentionally returns true and the broad permissive policy can expose unrelated rows.

Read-only Production aggregate evidence at discovery:
- app-access driver users: 1
- jobs outside canonical pre-award boundary: 4
- distinct job-owning companies: 2

No identities/private job contents were surfaced.

Other Production-only `jobs` SELECT policy names with 0 exact matches in current `main` were recorded for reconciliation, but not all are independently exploitable.

Do not remove policies blindly; preserve:
- Platform Owner access;
- owning company/operator access;
- assigned driver access;
- winning carrier access;
- quote-safe pre-award Marketplace projection.

Forward migration only after real test/replay evidence.

---

## 6. Issue #437 — ACTIVE P0 INTEGRITY

**Issue #437 — P0: Remove Production-only broad job_bids mutation policy**

Confirmed Production-only policy:

`job_bids_update_authenticated`

Properties:
- `PERMISSIVE`
- `FOR UPDATE`
- allows the job creator/job-owning company path **or** bidder-company membership through `USING`;
- `WITH CHECK` only constrains post-update `company_id` to a company the actor belongs to.

Why it is dangerous:
- a job-owning actor can target a competitor `submitted` bid;
- current trigger set does not provide a general immutable bidder identity/commercial field guard for non-accepted bids;
- `fn_lock_accepted_bid()` only blocks when `OLD.status='accepted'`;
- direct-invite acceptance guard only protects an acceptance transition;
- compliance guard does not protect general amount/message/company identity updates;
- authenticated currently has table/column UPDATE privileges, so RLS is the row boundary.

Read-only Production aggregate evidence at discovery:
- total bids: 3
- accepted bids: 3
- submitted bids: 0
- jobs with bids: 3
- bidder companies: 1

Therefore no currently submitted live row was exposed at the audit instant, but the defect would apply to future submitted traffic.

Related legacy drift:
- `job_bids_insert_authenticated` is also Production-only / absent from current `main`;
- current INSERT trigger/guard appears fail-closed, so do not claim an INSERT exploit without a negative test;
- Production has 14 non-internal `job_bids` triggers vs a much smaller clean-replay set, including duplicate `updated_at` and legacy autofill/normalisation objects;
- do not delete trigger debt merely because it is duplicated; classify against canonical behavior first.

Important historical warning:
- do not blindly copy old `job_bids_update_bidder_or_admin` logic that compares `auth.uid()` to `bidder_id`;
- `bidder_id` is now canonical Driver FK semantics, not auth-user identity.

---

## 7. PR #438 — OPEN / TESTS ONLY / DO NOT MERGE YET

**PR #438 — Add regression gates for Production RLS convergence**

Branch:

`test/p0-production-rls-convergence-20260831`

Exact current HEAD:

`a059e7950e158a1b76ffe413e4b177662576397e`

Base:

`main @ e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`

Scope:
- exactly one SQL test file;
- no migration DDL;
- no new migration version/timestamp;
- no Production mutation;
- no UI/Workspace changes;
- no PR #359 content.

File:

`supabase/tests/production_rls_convergence_jobs_and_bids.sql`

### #436 regression coverage

The test:
- asserts targeted Production-only broad `jobs` policy names are absent after clean replay;
- asserts `jobs_preaward_marketplace_privacy_guard` remains `RESTRICTIVE` for authenticated SELECT;
- creates synthetic driver/company/job fixtures inside one rolled-back transaction;
- proves app-access driver can SELECT their own assigned job;
- proves the same driver cannot SELECT an unrelated other-company `delivered` job outside the pre-award boundary.

### #437 regression coverage

The test:
- asserts `job_bids_insert_authenticated` and `job_bids_update_authenticated` are absent after clean replay;
- seeds a synthetic competitor `submitted` bid inside the rollback-only test transaction;
- uses `session_replication_role=replica` only for privileged fixture seeding so INSERT business triggers do not contaminate the UPDATE boundary under test;
- immediately restores `session_replication_role=origin`;
- under `authenticated`, job owner attempts a raw UPDATE that would succeed under the Production-only broad policy;
- test passes only if UPDATE is denied or affects zero rows;
- test fails if competitor bid row is actually changed;
- verifies original company/message/status remain intact.

### Pre-PR validation already done

On clean read-only preview `bewyd...`:
- all targeted legacy `jobs` policy names absent = true;
- Marketplace privacy guard canonical/restrictive = true;
- legacy `job_bids_insert_authenticated` / `job_bids_update_authenticated` absent = true.

Canonical schema checks:
- `jobs.assigned_driver_id` exists;
- `jobs.assigned_company_id` exists;
- `jobs.awarded_carrier_company_id` exists;
- `jobs.status` is text;
- no status CHECK rejects `allocated`/`delivered` fixture values.

Fixture correction already made:
- initial test incorrectly treated `quote_amount` as a physical clean-schema `job_bids` column;
- canonical migration `122_job_bids_with_job_owner_view.sql` derives `quote_amount` in the view instead;
- test was corrected in commit `a059e7950e158a1b76ffe413e4b177662576397e` to omit physical `quote_amount`.

### Exact-head checks

PR #438 exact head `a059e795...`:
- canonical Netlify `netlify/xdrivelogistics/deploy-preview`: **SUCCESS**
- secondary Netlify deploy-preview: SUCCESS / secondary check noise may include canceled-neutral component checks
- Supabase Preview: **SKIPPED** because per-PR preview creation disabled
- GitHub Actions: infrastructure failures before steps / runner_id=0

### Draft state caveat

The assistant attempted to convert PR #438 to Draft, but the GitHub connector failed due a GraphQL schema bug (`Repository.fullDatabaseId` undefined).

Therefore:
- PR remains OPEN and non-draft in GitHub metadata;
- a prominent `DO NOT MERGE YET` comment was added to the PR;
- do not infer readiness from non-draft state.

### Merge gate for #438

Do not merge until:
1. a writable disposable/local/fresh Supabase environment exists;
2. exact HEAD SQL test executes end-to-end and rolls back successfully;
3. CI runner infrastructure executes real steps;
4. exact-head evidence is recorded on the PR.

---

## 8. Issue #434 — Leaked Password Protection

Still tracked separately.

Production Security Advisor previously confirmed Leaked Password Protection disabled.

Supabase connector does not expose the Auth control-plane write necessary to toggle this setting safely.

Do not fake completion through SQL; enable through the supported Auth settings control plane when available.

---

## 9. Issue #435 — duplicate index / performance debt

Still tracked separately.

Audit found:
- 15 duplicate-index groups;
- 16 redundant index copies;
- none of the targeted duplicate indexes were constraint-backed;
- approximate duplicate storage small (~208 kB at discovery), but duplicate maintenance cost matters more than disk size.

No Production index was dropped.

Handle after security P0 / release-gate recovery, using forward migration and exact evidence.

---

## 10. Production safety facts to preserve

- No Production DDL executed during #436/#437 discovery.
- No Production DML executed.
- No user identity/private bid/job payload exposed in evidence.
- Aggregates only were used for live-condition confirmation.
- Do not directly apply RLS fixes through `execute_sql` or `apply_migration` to Production.
- Use a new forward migration only.
- Do not invent migration timestamps manually.
- Do not edit already-applied Production migrations for the live RLS repair.
- Do not weaken RLS/security to make tests pass.
- Do not enable main required checks while runner allocation remains broken.

---

## 11. Exact next execution order

Continue in this order:

1. **Issue #433 — restore GitHub Actions runner allocation.**
   - require non-zero `runner_id` and actual step execution.

2. **Issue #433 — re-enable Supabase per-PR preview creation.**
   - require a fresh writable preview for PR #438 or successor.

3. **Execute PR #438 SQL test on exact head.**
   - test must complete successfully and roll back.
   - if fixture/schema issue appears, repair test only; do not relax assertions.

4. **Then design the forward RLS remediation for #436/#437.**
   - current-schema semantics only;
   - no legacy `auth.uid() = bidder_id` mistakes;
   - preserve canonical assigned-driver/company/winning-carrier/Platform Owner behavior;
   - preserve restrictive pre-award Marketplace privacy guard;
   - job owner award flow should remain atomic RPC/governance path, not arbitrary raw bid UPDATE.

5. **Create the forward migration through approved repository/Supabase migration creation flow.**
   - do not invent a filename/timestamp if the proper tool/CLI is unavailable.

6. **Run fresh preview replay through latest migration.**

7. **Run PR #438 tests + existing Supabase SQL tests + Security Advisor.**

8. **Run exact-head canonical Netlify and real GitHub CI.**

9. **Merge security remediation only after all gates are real/green.**

10. **Verify new main and Production after approved deployment.**
    - confirm legacy Production-only policy names gone;
    - confirm negative RLS boundaries live;
    - confirm no Driver Mobile / Marketplace / Workspace / Super Admin regressions.

11. **Only after gate infrastructure is reliable, configure main branch protection/rulesets/required checks.**

12. **Then continue:**
    - Leaked Password Protection (#434)
    - duplicate indexes / RLS performance debt (#435)
    - remaining runtime E2E / release evidence.

---

## 12. Active references

Repo:
`LoadifyMarketLTD/xdrivelogistics.co.uk`

Production Supabase:
`jqxlauexhkonixtjvljw`

Current main:
`e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`

Issue #433:
`Restore CI runner startup and Supabase PR preview gates`

Issue #434:
Leaked Password Protection follow-up

Issue #435:
duplicate index/performance debt follow-up

Issue #436:
`P0: Remove Production-only broad jobs RLS exposure`

Issue #437:
`P0: Remove Production-only broad job_bids mutation policy`

PR #438:
`Add regression gates for Production RLS convergence`

PR #438 branch:
`test/p0-production-rls-convergence-20260831`

PR #438 head:
`a059e7950e158a1b76ffe413e4b177662576397e`

Checkpoint branch:
`docs/full-e2e-remediation-checkpoint-20260831-1430`

Checkpoint file:
`docs/checkpoints/XDRIVE_FULL_E2E_REMEDIATION_CONTINUITY_CHECKPOINT_2026-08-31_1430.md`
