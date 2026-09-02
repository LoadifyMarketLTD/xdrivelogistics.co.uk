# XDRIVE SUPER ADMIN — PR #431 CONSOLIDATION CONTINUITY CHECKPOINT

**Date:** 2026-09-02 14:05 UK time  
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`  
**Checkpoint purpose:** exact continuation point for the Super Admin Control Plane / PR #431 consolidation workstream.  
**Do not restart the audit from zero.**

---

# 1. NON-NEGOTIABLE EXECUTION RULES

These rules were repeatedly confirmed by the owner and must be preserved in the next chat.

1. **Never push/merge blindly into `main`.** Every PR/file/migration must be checked twice for what it does and for whether it can regress or overwrite functionality already in `main`.
2. **Never merge stale/behind branches.** Rebuild useful functionality on top of current `main`, inspect exact diff, validate exact HEAD, confirm 0 behind, then merge only with SHA guard when appropriate.
3. **PR #431 is a source/inventory, not a merge candidate.** It is massively diverged and contains valuable Super Admin functionality mixed with stale history. Recover useful layers selectively.
4. **Production Supabase is not to be manually mutated as a shortcut.** Do not manually call branch merge into Production. GitHub/Supabase integration should apply migrations normally after a validated GitHub merge, then verify read-only in Production.
5. **Migrations are not to be run blindly.** Before promotion, audit impact on existing platform functionality: onboarding, auth, roles, jobs, invoices, payments, notifications, company flows, drivers, seller/customer workspaces, RLS, triggers, RPCs and any canonical runtime contract touched directly or indirectly.
6. If an old #431 implementation is useful as an idea but unsafe as written, **preserve the idea and rebuild it safely** rather than copying the old implementation.
7. **GitHub Actions is completely excluded from the XDrive release gate until the owner explicitly changes this.** The account has no Actions credits and the owner will not add money. Do not inspect, wait for, or use GitHub Actions as PASS/FAIL evidence.
8. Valid release evidence for this workstream is: dedicated branch/PR, canonical Netlify Deploy Preview on exact HEAD, Supabase Preview/migration replay, direct read-only schema/RLS/RPC/advisor checks, exact diff audit, 0 behind, mergeable state and SHA-guarded merge.
9. Do not claim E2E/write runtime PASS when the available connector is read-only and no actual mutation test has run.
10. Do not import visual differences from old stale visual branches wholesale. Preserve current `main` UI unless a scoped intentional change is necessary.

---

# 2. CURRENT MAIN

At checkpoint creation, current `main` is:

`d62104bb8c0bbbed2b434ad4f50c849322542f83`

This commit already includes the following Super Admin consolidation layers promoted during this continuation:

- Platform Case Centre / Action Centre foundation (earlier merge)
- Document Request backend (earlier merge)
- Platform Owner POD Review
- Platform Finance Reconciliation
- Platform Notification Retry Governance

Do not assume `main` remains on this SHA in the next chat. **First action must be to fetch real current `main` and compare it to this checkpoint.**

---

# 3. GITHUB ACTIONS — EXPLICITLY NOT A GATE

The owner has stated repeatedly for approximately a month that GitHub Actions is unavailable because there are no credits and no further money will be added.

Therefore:

- Do not check Actions.
- Do not wait for Actions.
- Do not call a workflow failure with `steps=[]` a code failure.
- Do not ask the owner about Actions again.
- Do not use Actions as a blocker for promotion.

Use Netlify + Supabase Preview + direct audits instead.

---

# 4. PR #431 — SOURCE OF TRUTH INVENTORY, NEVER DIRECT MERGE

PR #431: `Preview only: Super Admin visual control-room rebuild`

Mandatory state from the ongoing workstream:

- OPEN
- DRAFT
- NOT MERGED
- preview/source branch only
- never direct merge into `main`

Reason: #431 is heavily diverged from current `main` and historically contained hundreds of commits while being dozens of commits behind. It remains valuable because it contains many unique Super Admin capabilities.

Important functional areas inventoried from #431 include:

- Platform Case Centre
- Company 360
- Global Platform Search
- POD Review
- Finance Reconciliation
- Notification Retry/Audit Governance
- Settings Governance
- XDrive Enquiry Governance
- generic entity inspectors/actions
- marketplace governance
- compliance convergence
- support truth preservation
- platform-admin decision gate
- governance mutation atomicity
- notification entity links
- canonical users
- operations exception control
- document completion/remediation
- visual/control-plane system
- multiple operations/company/compliance/settings/support/user pages

Some of these are already in `main`; others remain to be selectively rebuilt.

Do not close #431 until all unique useful layers are classified and either promoted, superseded, or deliberately rejected with evidence.

---

# 5. CONSOLIDATION MASTER / TRACKING BRANCH

Earlier in this continuation a consolidation branch was created:

`consolidate/super-admin-431-into-current-main-20260902`

A matrix/checkpoint document was added there to track #431 → current-main classification.

That branch should remain a tracking/source branch, not a large final merge vehicle. Individual validated functional layers should continue to be promoted via smaller isolated PRs.

A separate paused validation branch also existed earlier:

`validate/super-admin-document-remediation-ui-20260902`

It contains three historical validation commits/files whose exact contents must be inspected before reuse. Do not merge it blindly.

---

# 6. POD REVIEW — COMPLETED AND PROMOTED

The old #431 POD design attempted to place Platform Owner review metadata directly on `jobs`.

Audit found that `authenticated` users have row-level read/update access to `jobs` under RLS, therefore internal `platform_pod_review_*` columns on `jobs` would have created a tenant-visible/tenant-modifiable governance boundary risk.

The design was rebuilt safely:

- separate internal table `platform_pod_reviews`
- service-role-only access
- no tenant policies
- Platform Owner mutation through semantic RPC
- `SECURITY DEFINER`
- hardened `search_path=pg_catalog, public`
- tenant anon/authenticated no table privileges
- owner reviewer FK changed to nullable + `ON DELETE SET NULL` so the audit record does not block account lifecycle
- reviewer index added
- no mutation of existing `jobs` schema for internal review metadata

Final migration:

`20260902084500_platform_pod_review`

Final promotion PR:

#460 — isolated Platform Owner POD Review

Merged with SHA guard.

Resulting `main` after that merge was:

`762fbeac322f27c02074c0a6a52b42127d91a7fa`

Production later confirmed migration `20260902084500 platform_pod_review` via normal integration.

No manual Production merge was used.

---

# 7. FINANCE RECONCILIATION — COMPLETED AND PROMOTED

Old #431 Finance Reconciliation had the same isolation problem: it stored Platform Owner reconciliation metadata directly on tenant-facing `invoices`.

Audit also found important integrity requirements:

- `invoice_payment_history` and invoice currency were not structurally guaranteed to match by a compound constraint.
- `invoice_payment_history.invoice_id` and `company_id` are separate FKs, so company consistency had to be checked explicitly.
- Production read-only checks showed **0 currency mismatches** and **0 company mismatches** at audit time.
- `fn_calculate_invoice_payment_status` is deterministic but intentionally currency-agnostic; therefore reconciliation must validate currency/company before using it.
- invoice update trigger audit showed no trigger that changes job lifecycle from `payment_status/paid_at`; `fn_assign_invoice_origin()` only maintains/normalizes `invoice_origin` and does not mutate commercial workflow state.

Safe redesign:

- internal Finance reconciliation registry separate from `invoices`
- service-role-only governance
- fail-closed if payment ledger currency differs from invoice currency
- fail-closed if payment history company differs from invoice company
- only derived invoice state may be reconciled: `payment_status` and `paid_at`
- do not alter invoice amount, VAT, client, job, payment history or settlement records

Final migration:

`20260902085000_platform_finance_reconciliation`

Final promotion PR:

#462

Final clean HEAD used for merge:

`866d65a28a2172a2e45e67424aaf4cbacaa81afe`

Merged with SHA guard.

Resulting `main`:

`82a24c6cb82a93760fd2e13f8c763b08b6a5a5b2`

Production later confirmed migration:

`20260902085000 platform_finance_reconciliation`

No manual Production merge was used.

---

# 8. NOTIFICATION RETRY / AUDIT GOVERNANCE — COMPLETED AND PROMOTED

Audit discovered that `main` already had notification retry behavior, but it was incomplete/unsafe:

- direct UPDATE into `notification_events`
- local weaker owner verifier
- no atomic audit governance
- retry did not explicitly clear notification lease state

Current notification claim contract was inspected in Production:

- claim function only picks `pending/failed` rows whose `next_attempt_at` is due and whose lease expired
- worker sets/uses lease token + lease expiry
- retry history uses `attempt_count`/`last_attempt_at`

Safe retry semantics were established:

- `status = pending`
- `processed_at = NULL`
- `last_error = NULL`
- `next_attempt_at = now()`
- `lease_token = NULL`
- `lease_expires_at = NULL`
- preserve `attempt_count`
- preserve `last_attempt_at`
- require written reason
- Platform Owner active authority
- atomic durable audit
- no direct update fallback

A historical Supabase replay failure occurred on preview because of an unrelated old duplicate migration version `20260721221000`; the new retry migration itself was later present and directly validated on preview.

A clean promotion PR was created:

#464

Final HEAD:

`b7fed8c5...` initially clean commit, then final merge head validated before merge.

Netlify canonical PASS and Supabase Preview healthy with direct RPC checks.

PR #464 was merged with SHA guard.

Resulting current `main`:

`d62104bb8c0bbbed2b434ad4f50c849322542f83`

Production now confirms:

`20260902091000 platform_notification_retry_governance`

No manual Production merge was used.

---

# 9. SETTINGS GOVERNANCE — CURRENT ACTIVE WORK, NOT MERGED

This is the exact active continuation point.

Branch:

`feat/super-admin-settings-governance-20260902`

PR:

#465 — `Harden Platform settings governance`

State at checkpoint:

- OPEN
- DRAFT
- DO NOT MERGE YET
- base `main`: `d62104bb8c0bbbed2b434ad4f50c849322542f83`
- current branch is 0 behind at last compare
- changed files: exactly 6
- current PR HEAD: `60dc80fde6a4a238b8657878271c835fafa08f84`

Exact diff files at current branch:

1. `__tests__/superAdminSettingsFlags.test.ts`
2. `__tests__/superAdminSettingsGovernance.test.ts`
3. `app/api/super-admin/settings/route.ts`
4. `app/super-admin/settings/feature-flags/page.tsx`
5. `app/super-admin/settings/global/page.tsx`
6. `supabase/migrations/20260902103000_platform_settings_governance.sql`

Current branch compare before checkpoint:

- ahead by 13 commits
- behind by 0
- exact six-file scope above

Do not promote the multi-commit Draft directly. After final validation, rebuild a clean one-commit promotion branch from real current `main`, preserving exact validated tree, then run fresh Netlify/Supabase evidence on that promotion PR.

## 9.1 Why Settings Governance is needed

Current `main` settings endpoint had three mutations:

- feature flags
- global settings
- latent `roles` mutation

All were using direct Supabase upserts and a local verifier checking only `role='owner'`.

The current `Roles & Permissions` UI is actually read-only; the latent API mutation is therefore unnecessary and creates an unwanted bypass.

Production audit showed:

- `platform_settings` has RLS enabled
- direct owner write policy existed: `platform_settings_write_owner`
- that policy checked only `profiles.role='owner'`, not active status, reason or audit atomicity
- table-level grants for anon/authenticated were broad in the historical schema
- `platform_feature_flags` also had historical owner write policy in preview replay

Canonical DB consumers of settings/flags include important runtime logic:

- onboarding (`company_approval_required`)
- quote guards (`max_bids_per_job` etc.)
- invoice generation feature flag
- shared `platformFlags` consumer

Therefore Settings Governance must close browser/client writes **without breaking DB reads used by runtime logic**.

## 9.2 Intended final Settings design

- `verifyPlatformOwner` common verifier for active Platform Owner
- Deploy Preview writes fail closed through that verifier
- feature flags/global settings mutations require explicit written reason
- mutations go only through `owner_update_platform_configuration(...)`
- RPC is `SECURITY DEFINER`
- search path `pg_catalog, public`
- RPC execution: service-role only
- one durable `owner_audit_log` row per changed key
- feature/global no-op values do not create fake changes
- roles mutation is explicitly blocked/read-only
- UI layout preserved
- Feature Flags and Global Settings use existing `ActionConfirmModal`
- save requires written reason
- existing actual stored values are not changed by migration

## 9.3 Important audit finding after first #465 preview

Initial migration version was:

`20260902102000_platform_settings_governance.sql`

Initial #465 preview reached:

- Supabase FUNCTIONS_DEPLOYED / ACTIVE_HEALTHY
- canonical Netlify SUCCESS

Direct preview inspection then found a latent historical policy:

`platform_feature_flags_write_owner`

The first migration removed `platform_settings_write_owner` and revoked DML, but did **not** explicitly drop this feature-flags write policy.

Even though authenticated DML had been revoked and the policy could not currently write, leaving the policy would create a latent bypass if grants were ever restored.

Therefore the first migration version was deliberately rejected for final promotion.

## 9.4 Final migration version change

The old branch migration file `20260902102000_platform_settings_governance.sql` was deleted from the branch.

A final new version was created:

`20260902103000_platform_settings_governance.sql`

It must explicitly drop BOTH direct owner write policies:

- `platform_settings_write_owner`
- `platform_feature_flags_write_owner`

and revoke direct anon/authenticated DML while preserving read compatibility for internal DB consumers.

The contract test was then updated in commit:

`60dc80fde6a4a238b8657878271c835fafa08f84`

Commit message:

`Point Settings governance test at final migration version`

That test now points to `20260902103000_platform_settings_governance.sql` and asserts both write policies are dropped.

## 9.5 Current exact gate state for #465 at checkpoint

On current final HEAD `60dc80fde6a4a238b8657878271c835fafa08f84`:

**Netlify canonical:** SUCCESS  
Preview URL: `https://deploy-preview-465--xdrivelogistics.netlify.app`

**Supabase Preview project ref:** `focwhtyidvxyylsvyyxw`

**Supabase current branch status at checkpoint:** `MIGRATIONS_FAILED` while preview project itself reports `ACTIVE_HEALTHY`.

This `MIGRATIONS_FAILED` happened after the migration-version replacement/finalization. **Do not merge. Diagnose this first in the next chat.**

Important: the earlier Supabase PASS belonged to the previous migration content/version (`20260902102000`) and cannot be reused as proof for the final `20260902103000` content.

Next chat must inspect the actual Supabase PR comment/error for #465 and determine whether:

- failure is another historical replay/version issue, or
- the final migration itself has an error.

Do not modify Production to bypass this.

## 9.6 Production fingerprint captured before Settings merge

A read-only fingerprint was captured before any Settings migration reaches Production:

- `platform_settings`: row count `0`, fingerprint `d41d8cd98f00b204e9800998ecf8427e`
- `platform_feature_flags`: row count `12`, fingerprint `2169f137c264f4ad17bfb01dd70d1d00`

After a future validated Settings merge and normal Production migration deployment, recompute the same fingerprint and confirm values were not unexpectedly changed by the governance migration.

---

# 10. SETTINGS GOVERNANCE — NEXT EXACT STEPS

Do these in order in the next chat:

1. Fetch real current `main`; do not assume checkpoint SHA is still current.
2. Fetch real PR #465 state/head and compare to current `main`.
3. Confirm #465 still has exactly the six intended files and no extra migration remnants.
4. Inspect Supabase integration error/comment for #465 current HEAD `60dc80...` and final migration `20260902103000`.
5. Do **not** use GitHub Actions.
6. If Supabase failure is historical/infrastructure and final migration is actually present, validate directly on preview where possible: policies, grants, RPC, migration history, advisor output.
7. If final migration is genuinely broken, fix on #465 Draft, bump migration version again if the previous version has already been recorded in the preview, and rerun exact-head evidence.
8. Required final preview proof:
   - migration final version present
   - `platform_settings_write_owner` absent
   - `platform_feature_flags_write_owner` absent
   - anon/authenticated cannot INSERT/UPDATE/DELETE on both tables
   - required reads/internal DB runtime remain functional
   - RPC `owner_update_platform_configuration(uuid,text,jsonb,text)` is SECURITY DEFINER
   - search path hardened
   - anon/authenticated cannot execute RPC
   - service_role can execute
   - roles PATCH blocked/read-only
   - canonical Netlify exact-head SUCCESS
   - 0 behind
   - exact six-file diff or an intentionally reduced clean equivalent
9. Do not merge #465 Draft with 13+ historical branch commits. Build a clean one-commit promotion branch from real current `main` using the exact validated tree.
10. Open non-draft promotion PR, rerun Netlify + Supabase Preview on the promotion SHA, re-check 0 behind/diff, then merge with expected head SHA only if everything remains clean.
11. After merge, wait for normal Supabase Production integration; do not manually merge branch.
12. Read-only verify Production migration and repeat the settings/feature-flags fingerprint.

---

# 11. XDRIVE ENQUIRY GOVERNANCE — AUDITED, NOT YET IMPLEMENTED

This remains one of the next important #431 functional layers after Settings.

Useful #431 idea:

- make enquiry decision/job creation/publication atomic
- preserve idempotency
- prevent split-brain where job gets created but enquiry state update fails

Current-main audit found a real weakness in the existing flow:

- job can be created and a later enquiry update may fail
- historical handling around `creation_idempotency_key` could weaken anti-duplicate protection by removing the key and retrying insert

However old #431 migration cannot be copied as-is because vehicle-type compatibility assumptions are stale.

Production vehicle type enum currently differs from old #431 assumptions and from some application labels. The existing application mapping produces labels such as:

- `van_small`
- `van_large`
- `truck_7_5t`

while Production includes canonical values such as:

- `small_van`
- `large_van`
- `7_5t`

plus other granular values.

Therefore XDrive Enquiry Governance must be rebuilt against the **real current Production enum and current app mapper**, not copied from #431.

Public enquiry form audit confirmed `pickupLocation` and `deliveryLocation` in this specific flow are collection/delivery postcodes, so writing them to postcode fields is semantically valid for this workflow.

Do not implement this until Settings Governance is closed/promoted or deliberately parked cleanly.

---

# 12. DOCUMENT REMEDIATION UI — HISTORICAL AUDIT, STILL NOT PROMOTED

Old #444 remains a source only. Important findings from earlier audit:

- applicant endpoint design was caller-scoped but GET had a hidden side effect resolving requests when no missing docs remained
- do not copy a mutating GET
- checklist polling concept is useful
- old Company Verification UI would wholesale replace current company verification and lose existing functionality
- correct future design is additive
- preserve current company verification semantics and add document remediation separately/on top
- if automatic resolution is needed, use explicit semantic POST/idempotent server-verified action, not GET side effects

A paused branch `validate/super-admin-document-remediation-ui-20260902` contains three historical created files; inspect before reuse.

---

# 13. #438 RLS — STILL DEFERRED, DO NOT FORGET

Old PR #438 covered Production jobs/job_bids RLS convergence.

It was closed without merge to free preview capacity, branch retained as source.

Do not forget it. Rebuild/rebase separately on current main when returning to that release/security workstream.

GitHub Actions is no longer a valid blocker/gate; use the currently agreed Netlify/Supabase/direct-audit strategy when revisiting.

---

# 14. PRODUCTION SUPABASE

Production/default project:

`jqxlauexhkonixtjvljw`

Region historically: `eu-west-2`

Current Production migration history at checkpoint includes:

- `20260831235940 platform_case_centre`
- `20260831235945 platform_document_completion_requests`
- `20260902084500 platform_pod_review`
- `20260902085000 platform_finance_reconciliation`
- `20260902091000 platform_notification_retry_governance`

Settings Governance is **NOT** confirmed in Production and must not be manually applied while #465 is still Draft/failing migration gate.

Read-only Production SQL is allowed for truth checks. Do not execute Production DDL/DML unless explicitly justified and authorized; normal promotion path is GitHub merge → Supabase integration → read-only verification.

---

# 15. RELEASE-GATE STANDARD GOING FORWARD

For every remaining #431 layer:

1. audit source #431 against real current `main`
2. audit Production schema/read contracts read-only
3. identify stale assumptions and indirect trigger/RLS effects
4. design smallest safe change
5. branch from exact current `main`
6. keep scope isolated
7. Netlify canonical exact HEAD
8. Supabase Preview replay
9. direct schema/RLS/RPC/privilege/advisor checks
10. exact diff + 0 behind
11. if validation branch has multiple cleanup commits, rebuild clean one-commit promotion PR from current main
12. fresh gates on promotion SHA
13. SHA-guarded merge
14. wait for normal Production migration integration
15. read-only Production verification

**No GitHub Actions.**

---

# 16. DO NOT LOSE THE OWNER'S CORE PRODUCT INTENT

The owner wants a powerful Super Admin control plane, but not at the cost of existing platform functionality.

Every new governance capability must:

- add operational control without weakening tenant boundaries
- keep Platform Owner authority distinct from company/broker authority
- preserve current onboarding
- preserve current driver/customer/company flows
- preserve finance invariants
- preserve marketplace/job lifecycle invariants
- preserve current visual system unless intentional scoped UI change is necessary
- fail closed in Deploy Preview for mutations
- produce durable audit evidence for privileged changes

If safety and speed conflict, choose safety and prove the change before `main`.

---

# 17. CHECKPOINT BRANCH / COMMIT

Checkpoint branch:

`docs/super-admin-continuity-checkpoint-20260902-1405`

Checkpoint file:

`docs/checkpoints/XDRIVE_SUPER_ADMIN_431_CONSOLIDATION_CONTINUITY_CHECKPOINT_2026-09-02_1405.md`

The next agent should read this file **in full** before making any code/database change.

---

# 18. FIRST COMMAND/INSTRUCTION FOR NEXT CHAT

Continue XDrive Super Admin from this checkpoint. Do not restart from zero. First verify real current `main`, real PR #465 HEAD/diff, and diagnose the Supabase `MIGRATIONS_FAILED` on the final Settings migration `20260902103000` before making any merge decision. GitHub Actions is not used at all.