# XDRIVE FULL E2E REMEDIATION — CONTINUITY CHECKPOINT

**Checkpoint time:** 2026-08-31 13:05 UTC  
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`  
**Workstream:** Full E2E Remediation / Supabase clean-replay convergence / release governance  

> **CONTINUE EXACTLY FROM THIS CHECKPOINT. DO NOT RESTART THE AUDIT FROM ZERO.**

---

## 1. Canonical continuation state

This checkpoint supersedes:

`docs/checkpoints/XDRIVE_FULL_E2E_REMEDIATION_CONTINUITY_CHECKPOINT_2026-08-31_0945.md`

Original checkpoint branch:

`docs/full-e2e-remediation-checkpoint-20260831-0945`

Original checkpoint commit:

`1575959be9f12e62bd074c6ebb406c4b8d2a30a4`

The active blocker at that older checkpoint was PR #424. That blocker and the subsequent migration-history recovery work are now closed as described below.

---

## 2. Repository truth at this checkpoint

Current `main` exact SHA:

`8f3774558912f830daab8dee17fb5471d05165c1`

Latest merge on `main`:

**PR #430 — Recover remaining hosted mid-August migrations**

Merge SHA:

`8f3774558912f830daab8dee17fb5471d05165c1`

Production Supabase project ref:

`jqxlauexhkonixtjvljw`

Release-governance state:

- `main` branch protection: **disabled**
- repository rulesets: **none**
- required checks: **not enforced**
- do **not** enable required checks until the GitHub Actions runner-startup blocker described in Issue #433 is resolved, otherwise routine merges may be deadlocked by infrastructure rather than code/test failures.

---

## 3. Previously completed P0 remediation

Do not reopen these unless new evidence proves a regression.

- P0-01 → P0-10: **CLOSED / PASS / merged**
- P0-11: **CLOSED / merged**
- P0-12: **CLOSED / merged**

Important already-merged PRs in the latest clean-replay sequence:

### PR #424

Repaired `job_bids.bidder_company_id` clean replay and other historical schema dependencies.

Merged at:

`ab76de8133ddeb2589d0ad072f8260fb7e758fc0`

Canonical `job_bids.bidder_company_id` contract recovered from Production:

- type: `uuid`
- `NOT NULL`
- no invented default
- no invented FK
- no invented unique constraint
- no invented duplicate index/backfill

### PR #423

**Harden onboarding review authority and expose owner queue**

Merged to main at:

`b1e0d9a2b21b1b054fb1b0d57f5d1f62fadcaebe`

Authority semantics:

- explicit `onboarding_applications.company_id`
- no `companies.created_by` authority fallback
- no "most recent company" fallback
- active path rechecks compliance
- rejected/suspended/inactive fail closed
- authority-base EXECUTE revoked from anon/authenticated/service_role
- outer RPC service-role only

### PR #429

Recovered hosted Supabase migration history sufficiently to expose the final set of missing mid-August versions. It did not by itself clear the entire clean-replay chain; PR #430 completed that work.

---

## 4. PR #430 — CLOSED / MERGED

PR:

**#430 — Recover remaining hosted mid-August migrations**

Branch:

`fix/recover-mid-august-hosted-migrations-20260831`

Final PR HEAD before merge:

`446d0ef98f0b48cf6d83d18f1dc4b8878f6a5e16`

Merge commit / current main:

`8f3774558912f830daab8dee17fb5471d05165c1`

State:

- CLOSED
- MERGED
- non-draft

### 12 hosted migration versions restored

The following Production-ledger versions were absent from `main` and were restored from repository history, without reintroducing PR #359 UI/Workspace changes:

1. `20260813192458` — `20260813_add_company_enabled_workspaces`
2. `20260813192511` — `20260813_validate_company_enabled_workspaces`
3. `20260813193908` — `cleanup_abandoned_enabled_workspaces`
4. `20260813202002` — `canonical_company_membership_workspace_access`
5. `20260813202107` — `grant_xdrive_owner_broker_workspace`
6. `20260814103042` — `align_return_journeys_runtime_schema`
7. `20260814120544` — `align_canonical_driver_job_lifecycle`
8. `20260818092418` — `driver_workspace_detail_read_contract_20260818`
9. `20260818124500` — `live_schema_contract_reconciliation`
10. `20260818125000` — `disable_legacy_completion_invoice_trigger`
11. `20260818125500` — `canonical_marketplace_invoice_on_delivery`
12. `20260818130000` — `driver_diary_read_contract`

These files existed in Git history before:

`76f9e1e119d5ae39dc77ba9b285c72adbad5d9a3`

commit message:

`restore(main): exact PR #357 state without PR #359`

No visual Workspace code from PR #359 was imported.

### Important historical correction

`20260813202002_canonical_company_membership_workspace_access.sql` was restored at its last safe Git state, preserving its hosted version while avoiding the previously identified invalid workspace-registry foreign key.

---

## 5. PR #430 clean-replay blockers that were repaired

### A. `jobs.status` enum → text bridge

Fresh replay originally failed at:

`20260819145000_bridge_jobs_status_enum_to_text_view_dependencies.sql`

because the restored canonical Marketplace invoice trigger:

`trg_generate_invoice_on_job_completion`

had a hard dependency on `jobs.status`.

The bridge was repaired to:

- detect the canonical invoice trigger
- drop it only around the physical type conversion
- perform the enum → text conversion
- recreate the same canonical invoice trigger afterwards
- preserve invoice semantics
- use no CASCADE
- fail closed on unexpected dependencies

This repair passed clean replay.

### B. P0-09 verification fixture / legacy bid identity drift

Fresh replay then failed at:

`20260830194200_verify_finance_vat_snapshot_runtime.sql`

with:

`job_bids_bidder_id_fkey`

because legacy `sync_job_bid_price()` copied `bidder_user_id` into `bidder_id`.

Canonical meaning is:

- `bidder_user_id` = auth user identity
- `bidder_id` = optional named Driver FK to `public.drivers(id)`

Production evidence proved:

- `public.sync_job_bid_price()` does **not** exist
- `trg_sync_job_bid_price` does **not** exist

Therefore the correct fix was not to relax the FK and not to weaken the P0-09 proof fixture.

The clean-history reconciliation migration:

`supabase/migrations/20260818124500_live_schema_contract_reconciliation.sql`

now explicitly retires:

- `trg_sync_job_bid_price`
- `public.sync_job_bid_price()`

as part of reconciling the legacy bootstrap schema to the canonical Production contract.

This passed fresh replay.

---

## 6. Supabase clean-replay gate after PR #430

Fresh preview replay reached the end of the migration chain:

- applied migration count: **326**
- max migration version: **`20260831104223`**

The exact PR #430 HEAD Supabase Preview concluded **SUCCESS**.

After merge, exact `main` commit:

`8f3774558912f830daab8dee17fb5471d05165c1`

also received Supabase Preview **SUCCESS**.

Production verification after merge:

- migration ledger count: **326**
- max version: `20260831104223`
- `sync_job_bid_price()` absent
- `trg_sync_job_bid_price` absent

Do not reopen the migration-history blocker from PR #430 unless a newer exact-head clean replay proves regression.

---

## 7. Netlify / product check truth for PR #430

At PR #430 exact HEAD before merge:

- canonical XDrive deploy preview = **SUCCESS**
- secondary Netlify deploy preview = **SUCCESS**

These are historical exact-head results. Any future changed HEAD must be rechecked independently.

---

## 8. GitHub Actions infrastructure blocker

Multiple workflows on both PR #430 and merged `main` failed **before executing any step**.

Exact merged-main evidence at:

`8f3774558912f830daab8dee17fb5471d05165c1`

CI run:

`33393965165`

Observed jobs included:

- Build & Lint
- Public E2E Smoke
- Detect Expo Driver Changes
- CodeQL JS/TS/actions
- CodeQL java-kotlin

Failure signature:

- `steps=[]`
- `runner_id=0`
- no runner name
- completion within approximately 1–2 seconds

The same pattern reproduced on PR #432.

Classification:

**GitHub Actions runner-startup infrastructure failure, not code/test failure.**

Do not mark application tests as failed based on these runs, but also do not claim those tests passed. They were not executed.

---

## 9. ACTIVE PR — #432

PR:

**#432 — Fail close clean-replay historical security artifacts**

Branch:

`fix/clean-replay-security-drift-20260831`

Base:

`main @ 8f3774558912f830daab8dee17fb5471d05165c1`

Exact HEAD:

`afde9cefa38f9616d8f098d36999f1300efece87`

State at checkpoint:

- OPEN
- NOT MERGED
- non-draft
- mergeable
- 3 commits
- 3 changed files
- +17 / -2

### Scope

Only historical SQL files:

1. `supabase/migrations/068_targeted_data_repair_current_accounts.sql`
2. `supabase/migrations/014_add_invoices_table.sql`
3. `supabase/migrations/20260819145000_bridge_jobs_status_enum_to_text_view_dependencies.sql`

No UI / Workspace changes.

No PR #359 visual changes.

No new migration version invented.

### Why PR #432 exists

Once PR #430 made clean replay complete, Supabase security advisor exposed four clean-preview-only ERRORs that do not exist on current Production:

1. `migration_068_profile_snapshot` — RLS disabled
2. `migration_068_membership_snapshot` — RLS disabled
3. `migration_068_company_snapshot` — RLS disabled
4. `dashboard_stats` — view using owner/definer semantics instead of security-invoker semantics

### PR #432 changes

#### `068_targeted_data_repair_current_accounts.sql`

After creating the three one-off migration snapshot tables:

- enable RLS
- revoke all privileges from `anon`
- revoke all privileges from `authenticated`

These are migration audit artifacts, not public runtime API tables. The desired behavior is fail closed.

#### `014_add_invoices_table.sql`

Create `public.dashboard_stats` using:

`WITH (security_invoker = true)`

#### `20260819145000_bridge_jobs_status_enum_to_text_view_dependencies.sql`

When the bridge recreates `dashboard_stats`, preserve:

`WITH (security_invoker = true)`

### Production impact expectation

The edited migration versions are already applied in Production, so this PR is intended to modify **fresh/clean replay behavior only**, not schedule new Production DDL.

Do not merge solely on that expectation; exact-head replay proof is still mandatory.

---

## 10. PR #432 ACTIVE BLOCKER — Supabase preview infrastructure

PR #432 exact-head Supabase GitHub check is currently **SKIPPED** with:

`Creating a new preview branch per PR is disabled. You can re-enable it in Project Integrations Settings.`

Supabase nevertheless exposes a branch object:

- branch name: `fix/clean-replay-security-drift-20260831`
- branch id: `a1bdd447-5118-4094-8161-e3020c23b85a`
- project ref: `qdcrhustidqllfmvgdhd`
- PR: #432

But this branch is **not a valid clean-replay proof**:

- its database has no usable `supabase_migrations.schema_migrations` chain
- reset API cannot treat it as a normal preview branch
- therefore its `ACTIVE_HEALTHY` metadata must not be mistaken for successful migration replay

A controlled transactional DDL validation attempt on another healthy preview was also blocked because the MCP transaction is read-only for ALTER TABLE.

Therefore:

**PR #432 MUST REMAIN OPEN / NOT MERGED until an actual fresh preview replay executes on its exact HEAD and reaches the latest migration.**

### PR #432 exit criteria

1. Supabase per-PR preview creation/replay works again.
2. Exact-head PR #432 fresh replay reaches `20260831104223` or whatever newer latest version exists at that time.
3. The four preview-only security ERRORs are gone.
4. No new security regression is introduced.
5. Production ledger/schema remains unchanged except for independently intended newer migrations.
6. Netlify/product gates are evaluated on exact HEAD.
7. GitHub Actions infrastructure failures remain classified separately until jobs actually execute steps.

Only then merge PR #432.

---

## 11. Issue #433 — ACTIVE RELEASE-GOVERNANCE BLOCKER

Issue:

**#433 — Restore CI runner startup and Supabase PR preview gates**

It records two independent infrastructure failures:

### GitHub Actions

- jobs do not acquire runners
- `runner_id=0`
- `steps=[]`
- multiple unrelated workflows affected

### Supabase GitHub integration

- new preview branch per PR is disabled
- PR #432 therefore cannot obtain the required clean-replay evidence

### Issue #433 exit criteria

- GitHub-hosted jobs acquire a non-zero runner and execute real steps
- CI / migration inventory / Visual Fixture workflows produce actual code/test evidence
- Supabase per-PR previews are re-enabled and fresh replay works
- PR #432 proves its hardening on exact HEAD
- only after those conditions are true should `main` branch protection / rulesets / required checks be configured

Do not close Issue #433 merely because a single workflow succeeds; verify runner allocation and multiple representative gates.

---

## 12. Security advisor state

### Production

Production does **not** exhibit the four PR #432 clean-preview-only ERRORs above.

Previously known Production advisor debt includes, among other items:

- leaked-password protection disabled
- performance/index/policy debt

Do not blindly remediate advisor findings without classifying whether they are:

- real application security defects
- intentional internal/service-role contracts
- extension-owned objects such as PostGIS
- historical backup/snapshot artifacts
- performance-only warnings

Security must be tightened evidence-first; never relax RLS/auth to clear a test.

### Clean replay

Before PR #432 hardening, clean replay exposed the four ERRORs listed above.

PR #432 is specifically scoped to remove those clean-history errors while failing closed.

---

## 13. Release-governance ordering

Current correct order:

1. Restore GitHub Actions runner startup.
2. Re-enable/restore Supabase per-PR preview replay.
3. Validate PR #432 exact HEAD from a true fresh replay.
4. Confirm the four clean-preview security ERRORs are gone.
5. Re-check exact-head Netlify and any now-executing CI gates.
6. Merge PR #432 only if all required evidence is clean.
7. Verify new `main` exact SHA and Supabase post-merge state.
8. Then configure `main` branch protection / rulesets / required checks.
9. Continue remaining security advisor, performance/index/policy and runtime E2E backlog.
10. Build final release evidence only from executed gates, never inferred/queued/skipped checks.

---

## 14. Non-negotiable project constraints

These remain in force:

- never relax RLS/auth/security to make tests pass
- do not blindly rerun semantic migrations against Production
- historic migration naming/version drift must be reconciled from verified Git/hosted history
- Expo/React Native remains the canonical Driver app
- do not reintroduce Android-native/Kotlin as the app base
- PR #359 visual Workspace changes remain excluded
- do not modify Workspace visual/UI layer as collateral damage
- `/super-admin` may be modified when genuinely required for functional Super Admin E2E behavior; the old blanket restriction is lifted
- GitHub Action `steps=[]`, `runner_id=0` failures are infrastructure, not code signal
- do not claim a gate is green unless exact-head evidence proves it
- use connected GitHub/Supabase tools for repo/database truth
- Production mutations must be fail-closed and evidence-based

---

## 15. Exact next action for continuation

**Do not restart migration audit. Do not revisit PR #424/#423/#430 as open blockers.**

Start from:

### Primary active task

**Issue #433 / infrastructure recovery**

Check whether:

1. GitHub Actions jobs now acquire runners and execute steps.
2. Supabase per-PR preview creation/replay is enabled again.

If infrastructure is restored:

1. force/trigger a real fresh replay for PR #432 exact HEAD `afde9cefa38f9616d8f098d36999f1300efece87` or whatever newer exact HEAD exists
2. confirm full migration chain reaches latest version
3. run security advisor against that clean preview
4. verify the four historical clean-replay ERRORs are gone
5. verify Netlify/product exact-head state
6. merge PR #432 only after the above is proven

If infrastructure is **not** restored:

- leave PR #432 OPEN / NOT MERGED
- do not weaken gates
- continue only with independent backlog work that cannot invalidate PR #432 or Production safety
- keep Issue #433 as the release-governance blocker

---

## 16. Checkpoint branch

Checkpoint branch:

`docs/full-e2e-remediation-checkpoint-20260831-1305`

Checkpoint file:

`docs/checkpoints/XDRIVE_FULL_E2E_REMEDIATION_CONTINUITY_CHECKPOINT_2026-08-31_1305.md`

The commit containing this file is the canonical documentation checkpoint for the next continuation.
