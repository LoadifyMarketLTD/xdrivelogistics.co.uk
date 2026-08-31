# XDRIVE FULL E2E REMEDIATION — CONTINUITY CHECKPOINT

**Checkpoint time:** 2026-08-31 20:01 UTC / 21:01 Europe/London  
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`  
**Workstream:** Full E2E Remediation / Production RLS convergence / Supabase clean replay / release governance  

> **CONTINUE XDRIVE EXACTLY FROM THIS CHECKPOINT. DO NOT RESTART THE AUDIT FROM ZERO.**
>
> The active code PR is **#438**. Supabase exact-head replay and runtime RLS regression are already proven PASS. Do not redo the migration-history audit, PR #430/#432 work, or the #436/#437 discovery from scratch.

---

## 1. Canonical continuation state

This checkpoint supersedes the earlier same-day Full E2E remediation checkpoints, including:

- `docs/checkpoints/XDRIVE_FULL_E2E_REMEDIATION_CONTINUITY_CHECKPOINT_2026-08-31_0945.md`
- `docs/checkpoints/XDRIVE_FULL_E2E_REMEDIATION_CONTINUITY_CHECKPOINT_2026-08-31_1305.md`
- the later in-chat 13:45 state that introduced #436/#437.

The workstream has advanced materially since the 13:05 checkpoint:

- PR #432 is merged.
- `main` moved to `e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`.
- Production-only RLS drift was discovered on `jobs` and `job_bids`.
- Issues #436 and #437 were opened as P0 security findings.
- PR #438 now contains the forward-only remediation migration plus exact regression SQL.
- A fresh Supabase preview successfully replayed all 327 migrations through the PR migration.
- The exact regression contract executed successfully on a writable disposable preview.
- The disposable runtime-harness migration was subsequently removed by recreating the preview from Git.
- Production remains unchanged.
- GitHub Actions runner startup remains broken under #433.
- The canonical Netlify deploy preview on the exact PR #438 HEAD currently fails and is an active merge blocker.

---

## 2. Repository truth at this checkpoint

### Current `main`

Exact SHA:

`e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`

This is the merge of:

**PR #432 — Fail close clean-replay historical security artifacts**

`main` remains:

- unprotected
- no active repository ruleset enforcing required checks
- required checks not enforced

Do **not** enable required checks while GitHub Actions jobs still fail before runner allocation, otherwise merges can be deadlocked by infrastructure rather than code quality.

### Production Supabase

Project ref:

`jqxlauexhkonixtjvljw`

Current verified Production ledger:

- applied migrations: **326**
- max version: **`20260831104223`**

PR #438 migration is **not** applied to Production.

---

## 3. Already completed work — do not reopen without new evidence

### PR #423

**Harden onboarding review authority and expose owner queue** — merged.

Important authority rules remain canonical:

- explicit `onboarding_applications.company_id`
- no `companies.created_by` authority fallback
- no “most recent company” fallback
- active path rechecks compliance
- rejected/suspended/inactive fail closed
- authority-base EXECUTE restricted

### PR #424

Clean-replay repair for `job_bids.bidder_company_id` — merged.

Canonical current contract:

- `bidder_company_id uuid`
- `NOT NULL`
- no invented default
- no invented FK
- no invented unique constraint

### PR #430

**Recover remaining hosted mid-August migrations** — merged.

This restored missing hosted migration history and repaired the full clean-replay chain without importing PR #359 Workspace visuals.

### PR #432

**Fail close clean-replay historical security artifacts** — merged.

Merged `main` SHA:

`e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`

It fixed clean-history-only security drift:

- migration_068 snapshot tables fail closed with RLS / revoked client privileges
- `dashboard_stats` is recreated with `security_invoker=true`

Do not reopen these PRs unless a newer exact-head clean replay proves regression.

---

## 4. Release-governance infrastructure blocker — Issue #433

Issue:

**#433 — Restore CI runner startup and Supabase PR preview gates**

State at checkpoint:

**OPEN**

The Supabase preview side improved during this workstream: PR #438 can now obtain real fresh previews and full migration replay.

However the GitHub Actions runner-startup failure is still reproducible.

### Exact PR #438 evidence

PR #438 HEAD:

`8c8a5d069c37361f5c8d997784e799191a04a4e4`

Workflow:

`Validate Supabase Migration Files`

Run:

`33430743596`

Attempt 2 jobs:

- `Report migration version inventory`
- `Reject duplicate versions and UTF-8 BOM files`

Both show:

- `steps=[]`
- `runner_id=0`
- empty runner name
- failure within seconds

Classification remains:

**GitHub Actions infrastructure / runner allocation failure.**

Do not call these application or migration test failures because no workflow step executed. Also do not call them PASS; they did not execute.

### #433 exit condition relevant to #438

Before treating GitHub Actions as a real gate again, confirm at least representative workflows:

- acquire a non-zero runner
- contain actual executed steps
- migration inventory/duplicate-version validation actually runs
- CI/Build & Lint actually runs
- Visual Fixture Gate actually runs when relevant

Only after this infrastructure is functional should branch protection / required checks be enabled on `main`.

---

# ACTIVE P0 — PR #438

## 5. PR #438 exact state

PR:

**#438 — Converge Production jobs/job_bids RLS boundaries**

Branch:

`test/p0-production-rls-convergence-20260831`

Base:

`main @ e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`

Exact current HEAD:

**`8c8a5d069c37361f5c8d997784e799191a04a4e4`**

State:

- OPEN
- non-draft
- NOT MERGED

Changed files are intentionally limited to Supabase scope:

1. `supabase/migrations/20260831183805_reconcile_production_jobs_job_bids_rls.sql`
2. `supabase/tests/production_rls_convergence_jobs_and_bids.sql`

No Workspace UI changes.

No PR #359 visual changes.

No root package/lockfile changes.

No Driver app base changes.

No Production DDL/DML performed by the agent.

---

## 6. Why PR #438 exists — #436 and #437

### Issue #436 — Production-only broad `jobs` SELECT RLS drift

Production accumulated permissive policies not represented by the canonical clean-replay contract.

Target legacy policy names removed by #438:

- `drivers_select_all_jobs`
- `jobs_select_exchange_posted`
- `jobs_select_authenticated`
- `jobs_select_company_members_active`
- `jobs_select_owner`
- `jobs_select_assigned_driver_scoped`
- `jobs_driver_assigned_or_awarded_v1`

Important nuance already established:

- `jobs_preaward_marketplace_privacy_guard` is **RESTRICTIVE**.
- Therefore the finding was not “legacy permissive policies bypass pre-award privacy through OR”.
- The real concern is broad cross-company visibility outside the pre-award boundary, where the restrictive pre-award guard intentionally no longer blocks normal execution rows.

Canonical access that #438 preserves:

- assigned driver via `jobs_select_assigned_driver` / `can_driver_access_job(...)`
- non-driver company access via canonical scoped helper
- awarded-carrier access
- restrictive Marketplace pre-award privacy guard

### Issue #437 — Production-only broad `job_bids` mutation RLS drift

Production contained broad legacy client mutation policies including:

- `job_bids_insert_authenticated`
- `job_bids_update_authenticated`

and clean history still contained historical:

- `job_bids_update_bidder_or_admin`

The historical UPDATE logic was also semantically stale because it relied on `bidder_id = auth.uid()` even though current canonical meaning is:

- `bidder_user_id` = auth user UUID
- `bidder_driver_id` / `bidder_id` = named Driver identity / FK semantics

The P0 integrity concern was that a job-owning company could potentially target a competitor bid through raw authenticated UPDATE while the bid was still `submitted`.

Production had 3 current bids and all were already accepted at discovery time, so the issue was not an active mutation of a live submitted bid at that moment; the boundary still had to be fixed before commercial scale.

---

## 7. PR #438 migration contract

Migration file:

`supabase/migrations/20260831183805_reconcile_production_jobs_job_bids_rls.sql`

Version:

**`20260831183805`**

This version was generated through the Supabase migration flow on preview and then committed to Git. It was not manually invented.

### `jobs`

The migration drops only the identified broad/legacy Production policy names.

It preserves and fail-closed asserts:

`jobs_preaward_marketplace_privacy_guard`

as:

- SELECT
- role authenticated
- RESTRICTIVE

### `job_bids` INSERT

Drops broad legacy mutation policies and recreates:

`job_bids_exchange_insert`

for authenticated direct client insertion only when:

- `bidder_user_id = auth.uid()`
- `bidder_driver_id IS NOT NULL`
- `can_authenticated_driver_quote(bidder_driver_id, job_id, company_id)` succeeds

Company/Fleet server-side commercial routes remain authoritative and are not widened.

### `job_bids` UPDATE

The migration intentionally does **not** preserve table-wide client UPDATE.

It:

- revokes table-wide UPDATE from `PUBLIC`, `anon`, `authenticated`
- grants authenticated `UPDATE(status)` only
- creates `job_bids_self_withdraw`
- allows only the caller’s own `submitted -> withdrawn` transition

Protected fields remain non-updatable by direct authenticated client, including:

- `job_id`
- `company_id`
- `bidder_user_id`
- `bidder_driver_id`
- `amount`
- `bid_price_gbp`
- `message`

Trusted SECURITY DEFINER / service-role commercial paths remain separate.

### Migration safety

The migration contains catalog/privilege fail-closed assertions.

It mutates policy/grant metadata only.

It does **not** mutate business rows.

Do not execute this migration directly against Production from the agent. Production rollout must remain through the approved deployment / Supabase integration path after merge gates are satisfied.

---

## 8. Exact-head Supabase clean replay — PASS

Final clean PR #438 preview:

**project ref:** `tqqfveoosclwfaammokl`

Branch id:

`f6caae38-72b8-4afe-b46b-cf8d349156be`

Git branch:

`test/p0-production-rls-convergence-20260831`

PR:

`#438`

Preview state at checkpoint:

- `FUNCTIONS_DEPLOYED`
- `ACTIVE_HEALTHY`

Verified ledger on the final clean preview:

- applied migrations: **327**
- max migration: **`20260831183805`**

Important:

The temporary successful runtime test had previously been recorded by the Supabase migration action as:

`20260831192748_runtime_verify_p0_rls_exact_head_8c8a5d0`

That temporary version is **NOT present** in the final preview ledger.

The PR was recreated from Git after runtime validation specifically to remove the disposable test migration and leave only repository migrations.

Therefore the final Supabase preview is clean and suitable as exact-head replay evidence.

---

## 9. Exact-head final catalog / privilege state — PASS

On final preview `tqqfveoosclwfaammokl`:

- applied migrations = **327**
- max version = `20260831183805`
- target legacy `jobs` broad policy count = **0**
- target legacy `job_bids` broad mutation policy count = **0**
- authenticated table-wide `job_bids UPDATE` = **false**
- authenticated `UPDATE(status)` = **true**

This is current clean-preview evidence and should not be rerun from scratch unless PR #438 HEAD changes.

---

## 10. Exact-head runtime RLS regression — PASS

Regression file:

`supabase/tests/production_rls_convergence_jobs_and_bids.sql`

The exact regression contract from the PR HEAD was executed on a writable disposable Supabase preview after full replay.

### Runtime assertions proven PASS

#### #436

- `auth.uid()` resolves the synthetic driver JWT correctly.
- `can_driver_access_job(assigned_job_id)` returns true for the assigned driver.
- `can_read_marketplace_execution_job(assigned_job_id)` permits the allocated assigned-driver row.
- the assigned driver can read their own assigned job.
- the same driver cannot read an unrelated other-company delivered job.

#### #437

- job owner cannot alter protected competitor bid commercial/identity fields.
- job owner cannot raw-withdraw competitor submitted bid.
- competitor bid remains unchanged after denied attempts.
- the actual bidder can perform the one intentionally supported raw client mutation: own `submitted -> withdrawn`.
- company/identity/value/message fields remain unchanged through self-withdraw.

### Important fixture lessons already resolved

Do not rediscover these from scratch:

1. `trg_drivers_identity_gate` intentionally rewrites a newly inserted unverified driver to inactive/app_access=false/is_active=false.
2. Therefore the test fixture seeds synthetic driver/job/bid rows with business triggers bypassed only during privileged fixture creation (`session_replication_role=replica`) and restores `origin` before RLS assertions.
3. This bypass is test-fixture-only; Production behavior of the driver identity/compliance gate is correct and is not weakened.
4. The driver positive test was initially confounded by an alternative policy path when company membership was `owner`.
5. Codex review correctly flagged this as P2.
6. The final fixture uses a valid `company_role` value and removes the awarded-carrier alternative path so the positive assigned-driver read depends on the assigned-driver contract rather than another permissive policy.
7. Current `company_role` enum on clean replay is `owner/admin/dispatcher/member/viewer`; `driver` is not an enum value.
8. The final assigned-driver fixture uses `member` membership while the profile role remains `driver`, and the synthetic assigned job has `awarded_carrier_company_id = NULL` to isolate the assigned-driver route.
9. The P2 review thread was resolved after the test was corrected.

Do not weaken security policies because a future synthetic fixture is rejected by business triggers; first determine whether the fixture violates real schema/business gates.

---

## 11. Production safety — VERIFIED UNCHANGED

Production project:

`jqxlauexhkonixtjvljw`

Current verified state:

- applied migrations: **326**
- max version: **`20260831104223`**
- target legacy `jobs` policy count = **7**
- target broad `job_bids` policy count = **2**

This is expected **before** #438 rollout.

It proves:

- #438 has not been applied to Production
- the preview-only runtime harness did not touch Production
- Production still needs the forward migration after #438 is safely merged/deployed

Do not manually “fix” Production by dropping policies directly. Preserve migration-based convergence.

---

## 12. Security advisor state after #438 preview

Security advisor was run on the 327-migration preview after #438.

No #436/#437-specific new ERROR was introduced.

Known remaining advisor debt is separate from #438, including:

- `public.spatial_ref_sys` / PostGIS RLS ERROR/system-extension debt
- multiple RLS-enabled internal tables with no client policies (often intentional fail-closed service/internal tables; classify before changing)
- mutable function search_path WARNs
- SECURITY DEFINER execute-surface WARNs
- broader security/performance debt already tracked for follow-up

Do not bulk-clear advisor warnings. Classify each object as:

- public client API
- authenticated API
- service-role/internal
- trigger-only/internal helper
- extension-owned/system
- historical snapshot/audit artifact

Security hardening remains evidence-first.

---

# ACTIVE MERGE BLOCKERS

## 13. Canonical Netlify deploy preview — FAILURE

Exact PR #438 HEAD:

`8c8a5d069c37361f5c8d997784e799191a04a4e4`

Current GitHub commit statuses:

### Canonical product gate

`netlify/xdrivelogistics/deploy-preview`

State:

**FAILURE**

Description:

`Deploy Preview failed.`

Netlify deploy id/target observed from GitHub status:

`6a95d57fd1b6830008f3f57e`

### Secondary Netlify project

`netlify/silly-faloodeh-cea857/deploy-preview`

State:

**FAILURE**

This secondary status is not the canonical product gate, but it is also failing.

### Important rule

**DO NOT MERGE #438 while the canonical `netlify/xdrivelogistics/deploy-preview` status is failure.**

The exact Netlify failure details were not available through the connected GitHub status alone. Next chat must diagnose the canonical Netlify deploy log or rerun a clean exact-head deploy and prove success.

Do not infer that this is caused by SQL because the PR changes only a migration and SQL regression test. Diagnose the actual Netlify build/deploy evidence.

---

## 14. GitHub Actions — still infrastructure failure

Even though Supabase is now proven, GitHub Actions remain blocked under #433.

Exact-head run:

`33430743596`

Both migration validation jobs:

- have `steps=[]`
- have `runner_id=0`

Therefore the migration inventory / duplicate-version workflow has **not actually executed** on the exact PR HEAD.

Before merge, do not silently waive this gate. Either:

- #433 is restored and the exact-head workflow executes real steps successfully, or
- a formally approved release process explicitly handles the infrastructure exception with equivalent executed evidence.

The current workstream policy is to keep #438 OPEN / NOT MERGED until real gates execute.

---

# JOB_BIDS PHYSICAL/TRIGGER DEBT — NOT PART OF #438

## 15. Trigger inventory conclusions already reached

During #437 analysis, Production was found to have significantly more `job_bids` triggers than clean replay.

Do not mix this physical compatibility work into PR #438.

Production has legacy/extra trigger debt including objects such as:

- `trg_job_bids_autofill`
- `trg_job_bids_populate_fields`
- `trg_job_bids_fill_bid_price_gbp`
- `trg_set_job_bids_load_id`
- `trigger_sanitize_driver_bids`
- duplicate/legacy updated_at trigger history

Several have no current `main` source occurrence and are clear hosted drift.

However **do not bulk-drop them yet**.

### `quote_amount` compatibility exception

Production still has physical compatibility differences including `quote_amount NOT NULL`.

Current application bid creation writes canonical fields such as:

- `bid_price_gbp`
- `amount`
- driver snapshot / identity fields as applicable

It does not depend on writing physical `quote_amount` directly.

Clean replay/view logic can derive legacy-compatible values from canonical fields.

Therefore the quote_amount fill trigger behaves as a temporary hosted compatibility shim until physical schema/view convergence is deliberately performed.

Correct future order for this debt:

1. prove current consumers and views
2. rebuild views on canonical expressions where needed
3. reconcile physical legacy columns safely
4. then remove redundant compatibility triggers
5. validate on fresh preview
6. never drop the shim first while Production still enforces `quote_amount NOT NULL`

Track this separately from #438 P0 RLS closure.

---

## 16. Other tracked follow-up issues

### #434

Supabase Leaked Password Protection follow-up.

The connected Supabase tooling can diagnose Auth/database state but does not expose the required Auth control-plane mutation in the current connector surface. Treat as control-plane follow-up; do not pretend it is enabled unless verified.

### #435

Duplicate-index debt.

Previously identified:

- 15 duplicate index groups
- 16 redundant copies
- none of the inspected duplicates were constraint-backed
- approximately 208 kB at current scale

The primary concern is unnecessary write amplification and fragmented migration history, not disk space.

Do not delete indexes directly from Production. Use a validated forward migration and preserve the canonical copy in each group.

### #436 / #437

Remain tied to PR #438 until Production convergence is actually deployed and verified.

Do not close them merely because preview is green.

---

# EXACT CONTINUATION ORDER FOR THE NEXT CHAT

## 17. Immediate next action — start here

### Step 1 — Re-read this checkpoint, then verify real-time state only

First verify:

- `main` exact SHA
- PR #438 state / exact HEAD
- canonical Netlify status on the exact HEAD
- GitHub Actions runner allocation status
- Supabase preview project for #438 and ledger

Do not restart the migration audit.

Expected checkpoint values unless something changed after this document:

- `main = e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`
- `PR #438 HEAD = 8c8a5d069c37361f5c8d997784e799191a04a4e4`
- final clean preview = `tqqfveoosclwfaammokl`
- preview ledger = `327 / 20260831183805`
- Production ledger = `326 / 20260831104223`

### Step 2 — Diagnose canonical Netlify failure

Primary active product gate:

`netlify/xdrivelogistics/deploy-preview`

Current status at checkpoint:

FAILURE on exact HEAD `8c8a5d0...`.

Obtain real build/deploy log evidence if available through connected tooling/plugin or a legitimate Netlify integration.

Do not change SQL/RLS speculatively to fix Netlify.

If the failure is transient/infrastructure-only, rerun and require exact-head SUCCESS evidence.

If it is a real build error, fix only the actual cause, preserving PR scope unless a new shared-contract dependency is proven.

Any commit that changes HEAD invalidates exact-head product-gate evidence and requires a fresh Supabase preview/replay check. The existing runtime proof can be reused only if the security migration/test content is unchanged and equivalence is demonstrated; safest rule is revalidate changed security files.

### Step 3 — Recheck #433 / GitHub Actions runner startup

Inspect new exact-head workflow runs.

Required evidence of infrastructure recovery:

- runner_id > 0
- real step list exists
- steps execute

Then require at minimum:

- Validate Supabase Migration Files actual PASS
- CI / Build & Lint actual evidence
- other required repository gates relevant to the PR

Do not confuse instant `steps=[]` failures with code failures.

### Step 4 — Recheck PR #438 exact-head Supabase state after any HEAD change

If HEAD remains `8c8a5d0...`, the Supabase proof in this checkpoint is valid:

- 327 migrations
- max `20260831183805`
- legacy policy counts 0 on preview
- runtime regression PASS
- temporary test migration absent from final preview

If HEAD changes, obtain a new clean preview/replay and ensure no disposable runtime test version remains in its final ledger.

### Step 5 — Merge #438 only when product/release gates are truly satisfied

Do **not** merge solely because Supabase is green.

Before merge require:

- canonical Netlify exact-head PASS
- GitHub Actions runner infrastructure restored and required workflows actually execute, unless an explicitly approved equivalent release exception exists
- no unresolved security review finding
- PR exact HEAD verified immediately before merge

Use expected-head SHA when merging.

### Step 6 — Post-merge Production verification

After merge:

1. verify new `main` SHA
2. observe approved Supabase/main deployment behavior
3. do not manually apply the migration from the agent
4. verify Production ledger advances from 326 / `20260831104223` to include `20260831183805` when the approved deployment applies it
5. verify Production target policy counts converge:
   - legacy `jobs` policy count -> 0
   - legacy `job_bids` broad mutation policy count -> 0
6. verify authenticated `job_bids` UPDATE privileges:
   - table-wide UPDATE false
   - status UPDATE true
   - protected field UPDATE false
7. verify no business data mutation/regression
8. only then close #436/#437 as completed

If Production does not automatically apply the migration after merge, treat deployment as a separate controlled release step; do not improvise direct DDL.

### Step 7 — release governance after #433

Only once GitHub Actions reliably acquire runners and execute steps:

- define required checks
- configure branch protection/rulesets on `main`
- avoid rules that reference unreliable/nonexistent contexts

### Step 8 — continue security / performance debt

After #438 and governance blocker are closed, continue in this order unless newer evidence changes priority:

1. #434 leaked-password protection control-plane setting
2. security advisor SECURITY DEFINER execute surfaces / mutable search paths — classify before changing
3. #435 duplicate index convergence
4. `job_bids` physical column / trigger compatibility convergence
5. remaining RLS/performance policy debt
6. remaining runtime E2E / release evidence

---

## 18. Non-negotiable constraints

These remain in force for the next chat:

- Never relax RLS/auth/security to make a test pass.
- Never blindly rerun semantic migrations against Production.
- Never edit already-applied migration versions to create a new Production semantic change; use a forward migration.
- Historic migration/version recovery must remain evidence-based from Git/hosted history.
- Do not invent migration timestamps/versions.
- Do not execute #438 migration directly against Production from the agent.
- Do not declare skipped/queued/pre-runner GitHub checks green.
- `steps=[]` + `runner_id=0` means infrastructure did not execute the job.
- Do not enable required checks while the runner system is broken.
- Expo/React Native remains canonical Driver app architecture.
- Do not reintroduce Android-native/Kotlin as the Driver app base.
- Do not import PR #359 Workspace visual changes.
- Avoid Workspace UI changes unless an active functional requirement genuinely demands them.
- `/super-admin` may be changed when actually required for complete Super Admin E2E functionality; the old blanket prohibition was lifted.
- Production mutations must be fail-closed, evidence-based and intentionally deployed.
- Preview/database “ACTIVE_HEALTHY” metadata alone is not proof of replay; ledger evidence is required.
- Do not treat a temporary test migration recorded by `apply_migration` as repository history; clean/recreate the preview afterward.
- Do not close #436/#437 until Production is verified converged.

---

## 19. Copy/paste prompt for the next chat

Use exactly this continuation prompt:

**CONTINUĂ XDRIVE FULL E2E REMEDIATION EXACT DIN CHECKPOINT:**  
`docs/checkpoints/XDRIVE_FULL_E2E_REMEDIATION_CONTINUITY_CHECKPOINT_2026-08-31_2001.md`

Repo: `LoadifyMarketLTD/xdrivelogistics.co.uk`

Active PR: **#438 — Converge Production jobs/job_bids RLS boundaries**

Expected PR HEAD at checkpoint:  
`8c8a5d069c37361f5c8d997784e799191a04a4e4`

Checkpoint branch:  
`docs/full-e2e-remediation-checkpoint-20260831-2001`

**Citește checkpoint-ul integral. Nu relua auditul de la zero. Supabase exact-head replay și runtime RLS regression pentru #438 sunt deja PASS; Production este încă neatinsă. Continuă din blocker-ele active: diagnostichează canonical Netlify failure pe HEAD-ul exact, verifică #433 GitHub Actions runner startup, apoi merge #438 numai după gate-uri reale. Respectă toate limitele de securitate și Production din checkpoint.**

---

## 20. Truth snapshot

At checkpoint creation, the authoritative short state is:

- `main`: **`e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`**
- PR #438: **OPEN / NOT MERGED**
- PR #438 HEAD: **`8c8a5d069c37361f5c8d997784e799191a04a4e4`**
- PR #438 migration: **`20260831183805_reconcile_production_jobs_job_bids_rls.sql`**
- PR #438 clean Supabase preview: **`tqqfveoosclwfaammokl`**
- clean preview ledger: **327 / `20260831183805`**
- #438 runtime RLS regression: **PASS**
- temporary runtime harness migration: **absent from final preview ledger**
- Production ledger: **326 / `20260831104223`**
- Production #438 migration applied: **NO**
- Production target legacy `jobs` policies: **7 still present**
- Production target broad `job_bids` policies: **2 still present**
- #433: **OPEN**, GitHub Actions still `steps=[]`, `runner_id=0`
- exact-head canonical Netlify: **FAILURE**
- #438 merge: **BLOCKED** until real product/release gates pass

**DO NOT RESTART. CONTINUE FROM NETLIFY + #433, THEN #438 MERGE/PRODUCTION VERIFICATION.**
