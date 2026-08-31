# XDRIVE FULL E2E REMEDIATION — CONTINUITY CHECKPOINT

**Checkpoint time:** 2026-08-31 09:45 UTC  
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`  
**Workstream:** Full E2E Remediation / Supabase clean-replay convergence  

> **CONTINUE EXACTLY FROM THIS CHECKPOINT. DO NOT RESTART THE AUDIT FROM ZERO.**

---

## 1. Repository truth at checkpoint

- `main` exact SHA: `dd6f7ce68168e10f1780602171a5081287bb3a64`
- `main` latest merge: PR #422 — `Resolve remaining legacy Fleet onboarding authority`
- `main` branch protection is currently **disabled** and there are no enforced required status checks. This is a release-governance backlog item, not a reason to weaken application/security gates.
- Production Supabase project ref: `jqxlauexhkonixtjvljw`

Canonical earlier checkpoint:

- `docs/checkpoints/XDRIVE_FULL_E2E_REMEDIATION_CONTINUITY_CHECKPOINT_2026-08-30_2140.md`
- checkpoint commit: `5c1368b4a7820cd833596481a10025900d4013bf`

This document supersedes that checkpoint for continuation state, but the older checkpoint remains useful for the full historical P0 backlog and rationale.

---

## 2. Production remediation already completed

### P0-01 → P0-10

CLOSED / PASS / merged before this clean-replay workstream.

### P0-11

PR #420 — `Converge legacy Fleet onboarding bindings`

- merged to `main`
- production reconciliation completed
- historical Fleet account type converged to canonical `fleet_courier`
- 4 strong bindings reconciled
- 5 historical Fleet applications intentionally remained unbound because there was not sufficient provenance
- no security relaxation

### P0-12

PR #422 — `Resolve remaining legacy Fleet onboarding authority`

- merged to `main` at `dd6f7ce68168e10f1780602171a5081287bb3a64`
- production result:
  - 3 `KEEP` — unbound / no-company provenance
  - 2 `MIGRATE` — dependency-free legacy company shells suspended and kept unbound
  - 0 active memberships created
  - 0 registration claims fabricated
- `is_company_creator` is bootstrap-only for `pending_approval`
- verified company registration RPC remains server/service-role only

**Important distinction:** P0-11 and P0-12 business remediation are closed in Production. The current active work is the **repository clean-replay gate** needed to prove that a fresh Supabase project can reconstruct the same canonical runtime safely.

---

## 3. ACTIVE PR — #424

PR #424 — `Repair Supabase clean replay drift and legacy hardening dependencies`

- branch: `fix/supabase-clean-replay-posted-company-drift-20260830`
- base: `main`
- base SHA: `dd6f7ce68168e10f1780602171a5081287bb3a64`
- exact HEAD at checkpoint: `f31f9d69e72e74e9f6674225ba657ad2bb043945`
- state: **OPEN**
- draft: **false**
- mergeable: **true**
- merged: **false**
- commits: 67
- changed files: 38

### Exact-head Netlify gate

For `f31f9d69e72e74e9f6674225ba657ad2bb043945`:

- `netlify/xdrivelogistics/deploy-preview` = **SUCCESS**
- secondary Netlify preview status also = **SUCCESS**
- canonical deploy preview: `https://deploy-preview-424--xdrivelogistics.netlify.app`
- latest reported Lighthouse on canonical preview:
  - Performance 100
  - Accessibility 97
  - Best Practices 83
  - SEO 100
  - PWA 100

Therefore **Netlify is green on the current exact HEAD**. Do not inherit this success if HEAD changes again; re-check exact-head status after every new commit.

---

## 4. Supabase Preview truth — ACTIVE BLOCKER

Current PR #424 Supabase Preview branch:

- branch id: `bc4dcb1b-7c46-463e-8292-0befd4769aea`
- project ref: `ohcdxymodzpmkpdrbkru`
- git branch: `fix/supabase-clean-replay-posted-company-drift-20260830`
- PR: #424
- status at checkpoint: **MIGRATIONS_FAILED**
- preview project health: `ACTIVE_HEALTHY`

### Latest exact branch error

The latest fresh replay on current HEAD stopped at P0-12 with:

```text
ERROR: column x.bidder_company_id does not exist (SQLSTATE 42703)
At statement: 11
-- MIGRATE: a pre-governance ACTIVE shell exists, but only a dependency-free shell ...
```

The failing migration is:

`supabase/migrations/20260830211000_resolve_remaining_legacy_fleet_company_shells.sql`

This is now the **first active task** for the next chat.

### Classification of `job_bids.bidder_company_id`

Do **not** treat `bidder_company_id` as hosted-only legacy and do not simply hide the reference behind `to_regclass`.

Evidence already established:

- Production has `public.job_bids.bidder_company_id`.
- Production column snapshot shows it as `UUID`, currently non-nullable in the hosted schema.
- Current repository/runtime uses this field, including current marketplace/workspace bid identity paths and multiple canonical migrations.
- GitHub search shows active references in, among others:
  - `app/api/workspace/bids/identities/route.ts`
  - `app/admin/bids/page.tsx`
  - `supabase/migrations/20260815091500_marketplace_preaward_privacy_guard.sql`
  - `supabase/migrations/20260815115500_named_driver_award_semantics.sql`
  - other bid/award migrations and contract tests.

Therefore this is a **canonical runtime schema dependency omitted by the clean migration chain**.

### Required next action

1. Inspect Production exact physical contract for `job_bids.bidder_company_id`:
   - data type
   - nullability
   - default
   - FK presence/absence
   - indexes/uniqueness
   - any trigger/view/function dependency.
2. Locate the earliest repository migration that should have established the field before its first canonical use.
3. Reconstruct **only the observed Production contract**, preferably by editing an already-applied historical migration body rather than adding a new retroactive migration version.
4. Do not invent a FK/index/backfill not present in Production.
5. Add/adjust a source-contract test so clean replay cannot silently lose this column again.
6. Close/reopen PR #424 to force a fresh Supabase project replay because edits to historical migration files are not automatically re-applied to an already-created preview database.
7. Re-run from zero and continue until the full chain completes.

---

## 5. Clean-replay repairs already proven / incorporated in PR #424

The PR now carries a large historical-chain convergence patch. Do not re-audit these from scratch unless a new replay proves a regression.

### Core schema/privilege drift already repaired

1. `jobs.posted_by_company_id` reconstructed before first use.
2. Hosted-only `expire_invites()` hardening made conditional.
3. Hosted-only legacy `update_vehicle_location(uuid,text,text,text)` hardening made conditional.
4. custom function `search_path` hardening made signature-safe.
5. legacy provisioning RPC retirement now handles existing overloads without requiring obsolete enum signatures to parse.
6. legacy `accept_driver_invite()` hardening is conditional and does not recreate retired tables.
7. PostGIS is reconstructed in schema `public` before geography migrations.
8. `driver_locations.location geography(Point,4326) NOT NULL` reconstructed from lat/lng before telematics sync.
9. `job_bids.quote_vehicle_id` reconstructed with the observed Production contract.
10. hosted-only empty `vehicle_tracking_history` is guarded dynamically rather than recreated.
11. hosted `status_enum ('active','inactive','suspended')` contract reconstructed.
12. hosted `profiles.status` physical `user_status ('pending','active','blocked')` contract reconstructed.
13. `company_memberships.status` converged to final canonical text contract from the beginning of fresh replay.
14. onboarding evidence raw-table ACLs (`driver_identity_documents`, `company_documents`) are explicitly closed to `anon`/`authenticated`, with service-role retained.
15. `invoice_documents` raw-table ACL is similarly closed and Storage access stays behind the narrow helper/policy path.
16. P0-06 runtime proof now uses synthetic rollback fixtures instead of private Production users.
17. `profiles.id` legacy dependency reconstructed where the historical sync migration genuinely writes it.
18. P0-07 onboarding submit verifier now uses synthetic rollback fixtures.
19. `jobs.is_test` reconstructed exactly before P0-08.
20. `jobs.cancellation_reason` reconstructed exactly before P0-08.
21. invoice snapshot fields / VAT physical contracts reconstructed for P0-09.
22. invoice status enum canonical lowercase values restored before later finance migrations.
23. P0-09 verifier now uses synthetic rollback fixtures.
24. `get_missing_onboarding_documents()` fresh definition converged with Production Owner Driver evidence equivalence and service-role-only ACL.
25. P0-10 clean replay has already passed on a fresh preview.
26. `companies.updated_at` reconstructed for P0-11 as Production `TIMESTAMPTZ NOT NULL DEFAULT now()`.
27. P0-11 source-contract test updated accordingly.

### Important correction made during this workstream

Earlier classification of `proof_of_delivery` and `job_cancellation_requests` as legacy-only was **wrong and has been corrected**.

Current Owner Job API / atomic guards still query these tables, so a fresh database must have them.

Migration updated:

`supabase/migrations/20260830122049_repair_owner_job_delete_atomic_guard.sql`

It now reconstructs the observed Production contracts for:

- `public.proof_of_delivery`
- `public.job_cancellation_requests`

including the observed foreign keys, indexes, RLS activation, raw `anon`/`authenticated` privilege revocation, `service_role` access, and the hosted POD `updated_at` trigger helper. Contract coverage is in:

`__tests__/ownerAtomicDeleteMigrationContract.test.ts`

### Hosted-only P0-12 dependency guards

The following Production tables are treated as hosted/legacy evidence dependencies and are **not recreated solely to make P0-12 parse**:

- `company_members`
- `company_business_types`
- `invites`
- `workspace_switch_audit`

P0-12 now uses migration-scoped dynamic dependency checks via:

`p0_12_optional_dependency_exists(...)`

with `to_regclass(...)`, and drops the helper before commit. Contract coverage is in:

`__tests__/remainingLegacyFleetResolution.test.ts`

Do not reverse this decision unless new current runtime evidence proves one of those tables is canonical and required.

---

## 6. PR #424 changed-file scope at checkpoint

Exactly 38 changed files were reported on current HEAD:

### Tests

- `__tests__/cleanReplayProfileLegacyIdContract.test.ts`
- `__tests__/cleanReplayStatusEnumContract.test.ts`
- `__tests__/financeVatSnapshotIntegrity.test.ts`
- `__tests__/jobAwardLifecycleIntegrity.test.ts`
- `__tests__/legacyFleetOnboardingConvergence.test.ts`
- `__tests__/onboardingSubmitAuthorityContract.test.ts`
- `__tests__/ownerAtomicDeleteMigrationContract.test.ts`
- `__tests__/remainingLegacyFleetResolution.test.ts`
- `__tests__/storageObjectPathRlsRepair.test.ts`

### Migrations

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/014_add_invoices_table.sql`
- `supabase/migrations/027_add_profiles_status_column.sql`
- `supabase/migrations/048_split_driver_availability_from_employment_status.sql`
- `supabase/migrations/091_fix_driver_exchange_rls.sql`
- `supabase/migrations/20260723111000_add_missing_invoice_status_pending.sql`
- `supabase/migrations/20260818172000_harden_postgis_spatial_ref_sys.sql`
- `supabase/migrations/20260819154500_reconcile_vehicle_readiness_physical_contract.sql`
- `supabase/migrations/20260820105000_canonical_xdrive_payment_terms_and_special_extension.sql`
- `supabase/migrations/20260821124443_fix_profile_sync_legacy_id.sql`
- `supabase/migrations/20260827061500_restrict_server_trigger_rpc_execution.sql`
- `supabase/migrations/20260827063000_close_legacy_security_definer_rpc_gaps.sql`
- `supabase/migrations/20260827070000_lock_custom_function_search_paths.sql`
- `supabase/migrations/20260827073000_retire_legacy_profile_company_provisioning_rpcs.sql`
- `supabase/migrations/20260827074500_bind_driver_invites_to_authenticated_identity.sql`
- `supabase/migrations/20260829192805_telematics_location_source_foundation.sql`
- `supabase/migrations/20260830122049_repair_owner_job_delete_atomic_guard.sql`
- `supabase/migrations/20260830174500_vehicle_driver_company_integrity.sql`
- `supabase/migrations/20260830175600_verify_canonical_driver_identity_runtime.sql`
- `supabase/migrations/20260830184530_repair_onboarding_storage_reviewer_rls.sql`
- `supabase/migrations/20260830184540_repair_invoice_storage_member_rls_dependency.sql`
- `supabase/migrations/20260830184600_verify_storage_object_path_rls_runtime.sql`
- `supabase/migrations/20260830191900_verify_onboarding_submit_authority_runtime.sql`
- `supabase/migrations/20260830192000_reconcile_job_award_lifecycle_integrity.sql`
- `supabase/migrations/20260830194000_reconcile_finance_vat_snapshot_integrity.sql`
- `supabase/migrations/20260830194200_verify_finance_vat_snapshot_runtime.sql`
- `supabase/migrations/20260830201500_reconcile_company_compliance_contract.sql`
- `supabase/migrations/20260830204000_reconcile_legacy_fleet_onboarding_bindings.sql`
- `supabase/migrations/20260830211000_resolve_remaining_legacy_fleet_company_shells.sql`

No application/UI file is changed by PR #424.

---

## 7. Fresh replay finish line for PR #424

PR #424 is **NOT PASS** and must **NOT be merged** until a fresh zero-data preview reaches the current `main` migration tail without `MIGRATIONS_FAILED`.

At minimum explicitly confirm migration history contains and has passed:

- `20260830204000_reconcile_legacy_fleet_onboarding_bindings`
- P0-11 verifier around `20260830204100...`
- `20260830211000_resolve_remaining_legacy_fleet_company_shells`
- `20260830211030_harden_verified_company_registration_after_legacy_fleet_quarantine`
- `20260830211100_verify_remaining_legacy_fleet_resolution`

For every new failure:

1. read the exact Supabase `Branch Error`;
2. inspect the fresh preview schema if queryable;
3. compare with Production `jqxlauexhkonixtjvljw`;
4. search current repo/runtime call-sites;
5. classify:
   - **canonical required runtime structure** → reconstruct exact observed contract before first reference;
   - **hosted/retired/no-current-caller drift** → conditional/dynamic guard; do not recreate retired schema;
6. update a contract test;
7. close/reopen #424 for a true zero replay;
8. repeat until the entire chain is green.

After the DB is green, re-check exact current #424 HEAD:

- PR OPEN / mergeable
- base still the intended `main`
- canonical Netlify SUCCESS on exact HEAD
- no unintended application/UI changes
- changed files limited to intended migration/test clean-replay work
- no new retroactive migration versions inserted merely to bridge hosted history

Only then merge #424 with expected-head/SHA protection.

---

## 8. PR #423 — waiting behind #424

PR #423 — `Harden onboarding review authority and expose owner queue`

- branch: `fix/super-admin-onboarding-review-gate-20260830`
- current HEAD: `341281094a62aecd4bc4a910d181d5132fa99bdc`
- state: OPEN
- non-draft
- mergeable
- NOT MERGED
- exactly 6 changed files

Purpose:

- harden onboarding review company binding
- remove dangerous `companies.created_by` fallback
- keep review RPC service-role only
- add owner-only Super Admin onboarding review queue under `Super Admin → Compliance → Document Review`
- no Driver Workspace visual changes

Production DB hardening for #423 has already been applied and verified. The queue correctly blocks historical individual-driver applications with missing evidence rather than inventing compliance.

### Netlify diagnostic already solved

#423 previously failed Netlify because TypeScript narrowing of nullable module-level `supabaseAdmin` was lost inside an async `Promise.all` closure.

The proven fix is:

- after configuration guard, capture `const admin = supabaseAdmin`
- use `admin.rpc(...)` inside the async closure

Diagnostic PR #425 proved the fix and was closed without merge.

Current #423 preview Supabase branch:

- project ref `onxfeklnhokyufiigllu`
- currently `MIGRATIONS_FAILED`

This is expected because #423 was created before the #424 historical clean-replay convergence.

### Required order after #424 merge

1. capture new `main` SHA after #424 merge;
2. rebase/update #423 onto that new `main`;
3. recreate/reset #423 Supabase preview so it inherits the corrected historical migration chain;
4. require full Supabase preview green;
5. require canonical Netlify green on exact #423 HEAD;
6. re-check production onboarding authority invariants read-only;
7. confirm exactly intended Super Admin files/no unrelated Workspace visual changes;
8. merge #423 SHA-guarded;
9. do post-merge production read-only verification.

Do **not** merge #423 before #424.

---

## 9. Historical PR #405

PR #405 was stale and superseded.

Its Driver remediation API/UI/role exception was classified REMOVE/SUPERSEDED because canonical onboarding and operational document routes already exist and current main is more mature.

Only the unique authorized Super Admin onboarding review queue was replayed, minimally, through #423.

PR #405 was closed and its stale Supabase preview branch was thereby removed.

Do not reopen or wholesale replay #405.

---

## 10. Security / governance constraints

Keep all of these boundaries:

- no RLS relaxation;
- no public/authenticated raw-table privilege expansion;
- no fabricated company/user/document/compliance state;
- no private third-party Production users as mutation fixtures;
- prefer synthetic rollback fixtures for runtime proofs;
- no invented FK/index/default/backfill without Production evidence;
- do not recreate retired legacy tables/RPCs solely to make migrations parse;
- no new retroactive migration version merely as a bridge when the historical body can be made reproducible safely;
- current Driver app base remains Expo/React Native;
- do not reintroduce Android-native/Kotlin as the Driver application;
- do not import PR #359 Workspace visual changes;
- do not alter Workspace visuals as part of this remediation;
- `/super-admin` may be modified where genuinely necessary for the complete Super Admin control plane, but current #423 scope should remain minimal and functional rather than importing unrelated UI changes.

### Supabase advisor residual

Production advisor still reports `public.spatial_ref_sys` with RLS disabled. Do **not** auto-enable RLS blindly: PostGIS ownership/access semantics must be considered and enabling RLS without suitable policies can break expected access.

Fresh previews may also surface historical migration snapshot tables with RLS disabled. Treat advisor output as a separate security backlog to audit deliberately after the migration chain itself is reproducible.

---

## 11. GitHub Actions truth

Some GitHub Actions runs have historically shown failure while their jobs contained no executed steps/logs. Treat these as **NOT EXECUTED / runner-startup infrastructure failures**, not application test failures, unless actual job logs/steps prove otherwise.

Branch protection / required checks remain a release-governance backlog item after #424/#423 convergence.

---

## 12. PowerShell/local validation rule

Continue autonomously through GitHub + Supabase first.

PowerShell/local clone is only a **final safety net** if a local gate still remains after remote validation. Do not interrupt the clean-replay loop now to ask for local commands.

Previously prepared clean-clone approach can be reused at the final gate if required.

---

## 13. Exact continuation order for the next chat

**Start here — no re-audit from zero:**

1. Re-fetch PR #424 metadata and assert HEAD is still `f31f9d69e72e74e9f6674225ba657ad2bb043945` or explicitly account for any movement.
2. Re-fetch Supabase #424 branch status and latest `Branch Error`.
3. Active blocker at checkpoint is `job_bids.bidder_company_id` missing in clean replay during `20260830211000`.
4. Audit exact Production physical contract + repository first-use chain for `bidder_company_id`.
5. Because current runtime uses this field, reconstruct the canonical Production contract before first required reference; do not hide it as optional legacy drift.
6. Add/adjust a source-contract test.
7. Close/reopen #424 to force a completely fresh Supabase replay.
8. Repeat exact-error → Production comparison → minimal repair until the chain passes all P0-11/P0-12 tail migrations.
9. Revalidate exact-head canonical Netlify after final code HEAD.
10. If both DB replay and Netlify are green, merge #424 with expected-head SHA guard.
11. Capture new `main` SHA.
12. Rebase/update #423 on new main.
13. Recreate/reset #423 Supabase preview and require full clean replay green.
14. Revalidate #423 exact-head Netlify + production authority invariants.
15. Merge #423 SHA-guarded.
16. Post-merge production read-only verification.
17. Then continue release/governance backlog:
    - branch protection / required checks
    - GitHub Actions runner-startup issue
    - Supabase security/performance advisors
    - runtime E2E gates: operational instruction, physical Expo multi-drop, POD, live GPS, ETA/share token, telematics, load alerts, live PAF, push, Return Journey, payments, disputes, reviews, support tickets.
18. PowerShell only at the final local safety gate if still necessary.

---

## 14. PASS definition

Do not call PR #424 PASS because Netlify is green alone.

PR #424 is PASS only when:

- exact-head Netlify is green;
- a **fresh zero-data Supabase Preview** replays the entire repository migration chain through the P0-12 tail with no `MIGRATIONS_FAILED`;
- no security boundary was weakened;
- the diff remains intentional and migration/test-only;
- PR is mergeable against the expected `main`.

Then and only then merge #424 and proceed to #423.
