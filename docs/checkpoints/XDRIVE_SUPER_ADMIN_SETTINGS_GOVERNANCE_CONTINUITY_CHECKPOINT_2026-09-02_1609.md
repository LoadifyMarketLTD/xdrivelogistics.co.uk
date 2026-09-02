# XDRIVE SUPER ADMIN — SETTINGS GOVERNANCE CONTINUITY CHECKPOINT

**Checkpoint time:** 2026-09-02 16:09 UK local time  
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`

## NON-NEGOTIABLE CONTINUITY RULES

- DO NOT restart the audit from zero.
- DO NOT merge PR #431 directly. It remains a source/inventory branch only.
- DO NOT modify Production manually.
- DO NOT call `Supabase.merge_branch` for normal promotion.
- DO NOT use GitHub Actions as a release gate. The owner has explicitly stated that GitHub Actions are unavailable because there are no credits and no more money will be added for Actions. Use branch isolation, canonical Netlify, Supabase Preview, direct read-only schema/RPC checks, exact diff, 0-behind, mergeability and SHA-guarded merge instead.
- DO NOT push/merge anything to `main` unless its exact diff and runtime/schema impact are understood and rechecked.
- Do not copy stale #431 runtime files wholesale when current `main` has newer equivalents. Rebuild useful capability on top of current `main`.
- Preserve Platform Owner authority as distinct from tenant/company/broker authority.
- Deploy Preview Super Admin mutations must remain fail-closed.
- Protect onboarding, jobs, finance, auth, RLS, mobile and existing workspace functionality from regressions.

---

# 1. CURRENT REAL MAIN

Current verified `main` SHA:

`d62104bb8c0bbbed2b434ad4f50c849322542f83`

This is the merge commit from PR #464:

**Promote governed Platform Owner notification retry**

Current main already includes the following newly promoted Super Admin layers from this workstream:

- Case Centre: merged earlier via #453.
- Document Request backend: merged earlier via #455.
- Platform Owner POD Review: merged via #460.
- Finance Reconciliation: merged via #462.
- Notification Retry Governance: merged via #464.

Production migration history has already confirmed:

- `20260902084500 platform_pod_review`
- `20260902085000 platform_finance_reconciliation`
- `20260902091000 platform_notification_retry_governance`

These reached Production through normal GitHub/Supabase integration. They were NOT manually forced.

---

# 2. PR #431 — STILL SOURCE / INVENTORY ONLY

PR #431 remains the old large Super Admin visual/control-plane source branch.

Branch:

`preview/super-admin-visual-rebuild-20260831`

Rules:

- OPEN / DRAFT / NOT MERGED.
- Never direct merge.
- Old branch was previously measured as heavily diverged and behind current main.
- Continue extracting useful modules selectively.
- Useful modules already identified in #431 include POD Review, Finance Reconciliation, Notification Retry/Audit, Settings Governance, XDrive Enquiry Governance, Company 360, Global Search, platform entity inspectors/actions, compliance convergence, support truth, Case Centre, document completion, visual/control-plane work, etc.
- Company 360 and Global Search were already known to exist in current main; do not recreate them blindly.
- POD, Finance and Notification Retry have now been rebuilt safely and promoted.

Next major current module: **Settings Governance**.

After Settings, the next previously-audited major candidate is **XDrive Enquiry Governance**, which is valuable for atomicity/idempotency but MUST be rebuilt against the real current vehicle-type enum and current main contracts. Do not reuse the old #431 migration as-is.

---

# 3. CURRENT ACTIVE SETTINGS GOVERNANCE PR

PR:

**#465 — Harden Platform settings governance**

URL:

`https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk/pull/465`

Branch:

`feat/super-admin-settings-governance-20260902`

Current real PR state at checkpoint:

- OPEN
- DRAFT
- NOT MERGED
- mergeable: true at latest read
- base: `main`
- base SHA recorded by PR: `d62104bb8c0bbbed2b434ad4f50c849322542f83`
- current PR HEAD: `60dc80fde6a4a238b8657878271c835fafa08f84`
- changed files: 6
- commits: 13 on the validation branch

The PR MUST remain Draft / DO NOT MERGE until the Supabase migration-history issue below is resolved with clean evidence.

---

# 4. #465 INTENDED FUNCTIONAL SCOPE

Exactly six changed files at the current checkpoint:

1. `__tests__/superAdminSettingsFlags.test.ts`
2. `__tests__/superAdminSettingsGovernance.test.ts`
3. `app/api/super-admin/settings/route.ts`
4. `app/super-admin/settings/feature-flags/page.tsx`
5. `app/super-admin/settings/global/page.tsx`
6. `supabase/migrations/20260902103000_platform_settings_governance.sql`

Intended behaviour:

- Replace the local weak settings verifier with common `verifyPlatformOwner`.
- Require **active Platform Owner** authority.
- Feature flags and global settings mutate only through service-role-only RPC:
  `owner_update_platform_configuration(uuid, text, jsonb, text)`.
- Require written reason of at least 5 chars.
- One durable `owner_audit_log` row per changed key.
- Remove direct API `.upsert()` mutation paths.
- Keep `Roles & Permissions` read-only at settings API boundary.
- UI remains visually the existing Super Admin Settings UI, but Save opens `ActionConfirmModal` and requires a reason.
- Deploy Preview writes remain fail-closed via `verifyPlatformOwner`.
- Migration must NOT change existing settings/feature flag values.
- Existing consumers such as onboarding, quote guards, invoice generation and `platformFlags` remain read-compatible.

---

# 5. SETTINGS GOVERNANCE — WHY THE OLD #431 VERSION WAS NOT COPIED BLINDLY

Production audit found:

- `platform_settings` and `platform_feature_flags` both have broad table grants to anon/authenticated/service_role.
- RLS is therefore critical.
- `platform_settings` had direct write policy `platform_settings_write_owner` based on profile `role='owner'`, without active-status requirement and without reason/audit atomicity.
- `platform_feature_flags` also had a latent `platform_feature_flags_write_owner` policy discovered on the preview after the first governance replay.

The final governance migration is designed to close BOTH direct write policies:

- `DROP POLICY IF EXISTS platform_settings_write_owner ...`
- `DROP POLICY IF EXISTS platform_feature_flags_write_owner ...`

It also revokes INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER from anon/authenticated on both governance tables.

Reads are intentionally preserved.

Important: database functions that consume these settings continue to read the same tables directly, including onboarding logic using `company_approval_required`, marketplace quote guards, invoice-generation feature flag logic, and canonical `platformFlags` helpers.

No legitimate client-side writer was found outside the Super Admin settings endpoint.

---

# 6. PRODUCTION DATA FINGERPRINT BEFORE SETTINGS GOVERNANCE

Read-only fingerprint captured before any Settings Governance promotion:

- `platform_settings`: row_count = **0**
  - fingerprint = `d41d8cd98f00b204e9800998ecf8427e`
- `platform_feature_flags`: row_count = **12**
  - fingerprint = `2169f137c264f4ad17bfb01dd70d1d00`

Use this after eventual Production deployment to prove that the governance migration itself did not change stored values.

Do not expose or modify values merely to perform this check.

---

# 7. NETLIFY STATUS FOR #465

Canonical Netlify preview on current exact HEAD `60dc80fde6a4a238b8657878271c835fafa08f84`:

**SUCCESS**

Preview URL:

`https://deploy-preview-465--xdrivelogistics.netlify.app`

This is exact-head evidence for the current final Settings branch content.

GitHub Actions are NOT part of the gate and must not be checked/awaited in the next chat.

---

# 8. SUPABASE PREVIEW #465 — CURRENT BLOCKER

Supabase preview branch for #465:

- project ref: `focwhtyidvxyylsvyyxw`
- branch id: `4ac49b28-a59f-4d00-96c2-b577f5251c3d`
- git branch: `feat/super-admin-settings-governance-20260902`
- PR: #465
- preview project health: `ACTIVE_HEALTHY`
- current branch workflow status at checkpoint: **MIGRATIONS_FAILED**

Important chronology:

1. Initial settings migration version was `20260902102000_platform_settings_governance.sql`.
2. That migration replayed on preview and direct inspection showed:
   - `platform_settings_write_owner` had been removed;
   - BUT `platform_feature_flags_write_owner` still existed.
3. This was correctly treated as a latent bypass risk even though authenticated DML had already been revoked.
4. The migration was therefore corrected to also drop `platform_feature_flags_write_owner`.
5. To avoid falsely validating modified contents under an already-applied migration version, the old `20260902102000` migration file was removed from the branch and recreated as a new final version:
   `20260902103000_platform_settings_governance.sql`.
6. After that rename, Supabase Git integration reported:

`Remote migration versions not found in local migrations directory.`

This is currently the blocker.

Interpretation:

- The preview branch database had already recorded the old `20260902102000` version.
- The PR branch no longer contains that version because it was intentionally replaced with `20260902103000`.
- Supabase detects migration-history drift between that preview database and the current branch files.
- This is NOT evidence that the final `20260902103000` SQL itself is wrong.
- Do NOT "fix" Production migration history.
- Do NOT apply anything manually to Production.
- Do NOT declare Supabase PASS until a clean preview proves the final migration.

---

# 9. FIRST ACTION IN NEXT CHAT

DO NOT continue blindly from the old preview state.

Recommended safe sequence:

1. Re-read this checkpoint in full.
2. Verify actual current `main` SHA; do not assume it stayed `d62104bb...`.
3. Verify actual PR #465 HEAD/state and exact diff; do not assume no external changes occurred.
4. Verify current Netlify exact-head status.
5. Verify current Supabase #465 branch state.
6. Resolve the preview migration-history drift WITHOUT touching Production.

Preferred clean approach:

- Keep #465 Draft.
- Do not mutate Production migration history.
- Create a clean validation/promotion branch from current `main` containing the **final six-file tree** only, with the final migration version `20260902103000` present from the start.
- Open a fresh non-draft validation-only PR if needed so Supabase creates a brand-new preview database whose migration history starts from current Production and sees only the final new migration.
- This avoids carrying the stale preview branch history that knows about `20260902102000`.
- Validate the new preview fully.
- If the final clean branch is later used for promotion, rebuild it as one clean commit atop the then-current main, rather than merging #465's 13-commit validation history.

Do not close #465 until its role as validation/source is clearly superseded and the replacement branch is proven.

---

# 10. REQUIRED FINAL SUPABASE CHECKS FOR SETTINGS GOVERNANCE

On a CLEAN preview containing the final migration `20260902103000`, verify all of the following directly:

### Migration history

- final migration version appears exactly once:
  `20260902103000 platform_settings_governance`

### RLS/policies

- `platform_settings_write_owner` absent.
- `platform_feature_flags_write_owner` absent.
- read policies remain as required.
- no new tenant-side write policy exists.

### Effective privileges

For both `platform_settings` and `platform_feature_flags`:

- anon INSERT = false
- anon UPDATE = false
- anon DELETE = false
- authenticated INSERT = false
- authenticated UPDATE = false
- authenticated DELETE = false
- service_role retains required mutation capability

### RPC

`owner_update_platform_configuration(uuid,text,jsonb,text)`:

- exists
- SECURITY DEFINER
- `search_path=pg_catalog, public`
- PUBLIC execute = false
- anon execute = false
- authenticated execute = false
- service_role execute = true

### Contract

- active Platform Owner enforced by `assert_platform_owner_actor`.
- reason >= 5 chars.
- feature flag/global mutation only.
- roles mutation rejected/read-only.
- no direct API upsert path remains.
- durable audit entry per changed key.
- no mutation of unrelated tables.

### Advisors

Run Supabase security/performance advisors on the clean preview and identify only warnings introduced by the new migration. Do not misattribute preexisting warnings to this PR.

---

# 11. REQUIRED FINAL GITHUB/NETLIFY CHECKS BEFORE ANY MERGE

After clean Supabase validation:

- verify real current `main` again;
- compare promotion branch against `main`;
- require **0 behind**;
- require exact expected file set only;
- inspect deletions carefully;
- canonical Netlify must be SUCCESS on the exact promotion HEAD;
- PR must be mergeable;
- merge only with `expected_head_sha` SHA guard.

Do NOT use GitHub Actions as a gate.

After merge:

- verify resulting main commit;
- read Production migration history only;
- wait for normal Supabase integration;
- do NOT manually merge Supabase branch;
- once `20260902103000` appears in Production, re-check policies/RPC/grants read-only;
- re-run the Production fingerprints above and confirm stored settings/flag values were not changed by migration deployment itself.

---

# 12. PREVIOUSLY AUDITED NEXT MODULE — XDRIVE ENQUIRY GOVERNANCE

After Settings Governance is safely completed, resume #431 extraction with XDrive Enquiry Governance.

Do not reuse the old #431 migration as-is.

Known prior findings:

- Current/old public enquiry workflow can create a job and then fail updating the enquiry, causing split-brain state.
- Existing code had a weak idempotency fallback that could remove `creation_idempotency_key` and retry an insert, weakening duplicate protection.
- #431's atomic approach is valuable.
- BUT its vehicle-type compatibility layer is stale relative to current Production enum.
- Current application mapper can produce values such as `van_small`, `van_large`, `truck_7_5t`, while Production was observed to contain different canonical forms such as `small_van`, `large_van`, `7_5t` plus other granular values.
- Therefore rebuild against actual current enum and mapper at the time of implementation.
- The public enquiry source was verified to use collection/delivery postcode fields, so mapping those inputs to job postcodes is valid for that particular flow.

Same rules: audit first, no blind migration replay, isolated branch, Netlify + Supabase Preview + direct checks, 0-behind, SHA guard.

---

# 13. CONSOLIDATION / #431 CONTINUITY

Master consolidation branch created earlier:

`consolidate/super-admin-431-into-current-main-20260902`

It was originally created from old main and used to begin consolidation tracking. Do not assume it is current enough for promotion. Rebase/rebuild selectively against actual current main when returning to it.

PR #431 must remain available until all useful unique layers are classified/promoted or explicitly rejected.

Do not lose useful layers merely because #431 is stale.

---

# 14. USER RELEASE-GATE PREFERENCE — MUST PERSIST

The owner has repeated for a long period that GitHub Actions are unavailable due lack of credits and must not be used.

For this XDrive workstream, the active validation model is:

**isolated branch / PR**
→ **canonical Netlify exact-head**
→ **Supabase Preview migration replay**
→ **direct read-only schema/RPC/RLS/grant checks**
→ **security/performance advisors where relevant**
→ **exact diff**
→ **0 behind**
→ **mergeable**
→ **SHA-guarded merge**
→ **read-only Production verification after normal integration**.

GitHub Actions = NOT A GATE.

---

# 15. NEXT-CHAT START TEXT

Use this instruction in the new chat:

> **CONTINUĂ XDRIVE SUPER ADMIN EXACT DIN CHECKPOINT `docs/checkpoints/XDRIVE_SUPER_ADMIN_SETTINGS_GOVERNANCE_CONTINUITY_CHECKPOINT_2026-09-02_1609.md`. NU RELUA AUDITUL DE LA ZERO. Verifică mai întâi main real actual, PR #465 real, HEAD-ul și Netlify/Supabase. PR #465 rămâne DRAFT / DO NOT MERGE. Rezolvă blocajul de migration-history al preview-ului Settings Governance printr-un preview curat, fără nicio modificare manuală în Production. GitHub Actions NU se folosesc și NU sunt release gate. După validarea clean preview, construiește promotion PR curat, 0-behind, exact diff, canonical Netlify PASS + Supabase Preview PASS, apoi merge numai cu SHA guard. După Settings continuă cu XDrive Enquiry Governance din #431, reconstruit pe current main, nu copiat stale.**

---

# CHECKPOINT STATUS

**Checkpoint is continuity-only.**  
It does not authorize merging #465 and does not change Production.
