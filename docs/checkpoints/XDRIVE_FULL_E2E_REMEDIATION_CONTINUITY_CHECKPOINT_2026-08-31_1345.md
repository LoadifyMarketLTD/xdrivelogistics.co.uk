# XDRIVE FULL E2E REMEDIATION — CONTINUITY CHECKPOINT

**Checkpoint time:** 2026-08-31 13:45 UTC  
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`  
**Workstream:** Full E2E Remediation / Production RLS convergence / release governance  

> **CONTINUE EXACTLY FROM THIS CHECKPOINT. DO NOT RESTART THE AUDIT FROM ZERO.**

---

## 1. Canonical continuation state

This checkpoint supersedes the active-state portions of:

`docs/checkpoints/XDRIVE_FULL_E2E_REMEDIATION_CONTINUITY_CHECKPOINT_2026-08-31_1305.md`

The 13:05 checkpoint remains useful for detailed PR #430/#432 migration-history context, but it is stale because PR #432 is now merged and a new Production RLS P0 has been discovered.

Current canonical `main` exact SHA:

`e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`

This is the merge commit of PR #432.

Production Supabase project:

`jqxlauexhkonixtjvljw`

---

## 2. PR #430 — CLOSED / MERGED

**PR #430 — Recover remaining hosted mid-August migrations**

Merge commit:

`8f3774558912f830daab8dee17fb5471d05165c1`

Outcome:
- hosted migration history recovered;
- clean replay reached the canonical latest migration chain;
- legacy `sync_job_bid_price()` and `trg_sync_job_bid_price` retired;
- no PR #359 Workspace visual changes imported.

---

## 3. PR #432 — CLOSED / MERGED

**PR #432 — Fail close clean-replay historical security artifacts**

Exact validated head before merge:

`afde9cefa38f9616d8f098d36999f1300efece87`

Merge commit / current `main`:

`e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`

Exact-head validation before merge:
- Supabase Preview check: **SUCCESS**;
- preview project: `qdcrhustidqllfmvgdhd`;
- migration ledger: **326 applied**;
- max migration: **`20260831104223`**;
- `public.dashboard_stats`: `security_invoker=true` on clean replay;
- `migration_068_profile_snapshot`, `migration_068_membership_snapshot`, `migration_068_company_snapshot`: RLS enabled and anon/authenticated privileges revoked;
- the four targeted clean-replay Security Advisor ERRORs disappeared;
- canonical Netlify `xdrivelogistics` deploy preview: SUCCESS.

Post-merge Production intentionally remained unchanged:
- ledger: **326**;
- max migration: **`20260831104223`**;
- `dashboard_stats` absent;
- the three migration_068 snapshot tables absent;
- legacy `sync_job_bid_price()` absent;
- legacy `trg_sync_job_bid_price` absent.

This was correct because #432 repaired historical clean-replay artifacts, not live Production objects.

---

## 4. Issue #433 — OPEN — RELEASE-GOVERNANCE / CI INFRA BLOCKER

**Issue #433 — Restore CI runner startup and Supabase PR preview gates**

Supabase preview creation/replay recovered sufficiently to validate and merge #432.

The remaining active blocker is GitHub Actions runner startup.

Evidence:
- reruns of CI, migration inventory and Visual Fixture workflows still fail in ~2–3 seconds;
- jobs have no meaningful executed steps (`steps=[]` / `steps=null` / no runner execution);
- current `main` `e28b6990...` also triggered a staging workflow that failed before real steps.

Interpretation:
- this is infrastructure evidence, not a code/test failure;
- do not call those workflows green;
- do not enable required checks / branch protection while jobs cannot obtain runners, because doing so may deadlock merges.

Current governance state:
- `main` remains unprotected;
- no required checks/rulesets have been enabled yet;
- this is intentional until real gates function.

#433 was updated again after the new P0 #436 because runner failure now directly blocks a security-remediation migration from receiving required exact-head evidence.

---

## 5. Issue #434 — OPEN — SUPABASE LEAKED-PASSWORD CONTROL-PLANE ACTION

**Issue #434 — Enable Supabase leaked-password protection**

Production Security Advisor reports:

`auth_leaked_password_protection` — **Leaked Password Protection Disabled**

Organization plan is Supabase Pro, so the feature is available.

Current connected Supabase tooling can diagnose Auth/advisor state but does not expose the hosted Auth-settings mutation required to enable this flag. No alternative installed Supabase/Auth connector was found.

Required action when a compatible control plane is available:
- enable only **Prevent the use of leaked passwords**;
- do not silently change password length, character policy, OAuth, SMTP, confirmation, redirects, sessions or JWT settings;
- rerun Production Security Advisor and require the warning to disappear.

Do not invent a database migration for a hosted Auth setting.

---

## 6. Issue #435 — OPEN — EXACT DUPLICATE INDEX DEBT

**Issue #435 — Consolidate exact duplicate indexes without changing constraints**

Read-only Production catalog audit proved:
- **15 exact duplicate index groups**;
- **16 redundant index copies**;
- approximately **208 kB** current redundant storage;
- **none** of the duplicate indexes backs a PK / UNIQUE constraint / exclusion constraint.

The main concern is repeated index maintenance on writes, not current disk size.

Exact groups are recorded in #435.

Historical cause was confirmed for active `job_bids` uniqueness indexes: different historical migrations created the same business predicate under different index names.

Required remediation:
- new forward migration only;
- use the repository-approved Supabase migration creation flow;
- choose one canonical survivor per exact group;
- assert expected definitions;
- drop only structurally identical copies;
- do not change uniqueness predicates, RLS or data semantics;
- fresh preview + Performance Advisor + Security Advisor;
- Production only through the approved migration pipeline after real gates exist.

No Production DDL was executed.

---

# 7. NEW ACTIVE P0 — ISSUE #436

## P0: Production-only broad `jobs` RLS exposure

**Issue #436 — P0: Remove Production-only broad jobs RLS exposure**

This is the highest-priority newly discovered remediation item.

### 7.1 Confirmed Production policy

Production has a policy on `public.jobs`:

`drivers_select_all_jobs`

Properties:
- command: SELECT;
- role: authenticated;
- type: **PERMISSIVE**;
- predicate is equivalent to:

```sql
EXISTS (
  SELECT 1
  FROM public.drivers d
  WHERE d.user_id = auth.uid()
    AND COALESCE(d.app_access, true) = true
)
```

The predicate is not correlated to the current `jobs` row.

Therefore, once applicable restrictive policies also pass, an authenticated app-access driver satisfies this permissive SELECT policy for every `jobs` row.

Exact current-main Git code search for `drivers_select_all_jobs` returned **0 results**.

This is Production-only legacy RLS drift, not canonical current migration state.

### 7.2 Important correction: pre-award guard is RESTRICTIVE

Do **not** repeat the earlier tentative statement that permissive policies automatically bypass the Marketplace privacy guard.

Canonical migration:

`supabase/migrations/20260815091500_marketplace_preaward_privacy_guard.sql`

creates:

`jobs_preaward_marketplace_privacy_guard`

as **RESTRICTIVE**.

Therefore `drivers_select_all_jobs` does **not** bypass the raw-row privacy boundary while the job is canonically pre-award (`posted`/`quoted`, no authoritative award, exchange/direct context).

The canonical function intentionally returns true outside that pre-award boundary. The exposure then becomes relevant post-award/runtime/completed: the broad Production-only permissive driver policy can make unrelated jobs selectable across company boundaries.

### 7.3 Canonical driver security contract

Current migration history is explicit:

- `029_driver_jobs_rls.sql`: drivers should read/update only their own assigned jobs;
- `033_tighten_driver_rls.sql`: drivers are restricted to assigned-job access;
- `044_driver_runtime_rls_and_legacy_schema_guard.sql`: `jobs_select_assigned_driver` uses `can_driver_access_job(id)` and preserves company isolation;
- `20260816103000_marketplace_preaward_privacy_boundary.sql`: raw pre-award bypasses are closed; Marketplace browsing uses quote-safe server projections; legitimate raw access remains owned/post-award/assigned/winning-carrier scoped.

`drivers_select_all_jobs` conflicts with that canonical contract.

### 7.4 Live-condition evidence — aggregate only

Read-only Production aggregates:
- app-access driver users: **1**;
- jobs outside canonical pre-award boundary: **4**;
- distinct job-owning companies: **2**.

No private row contents or user identities were surfaced.

A direct identity-level RLS simulation was attempted only as a read-only aggregate, but the connector rejected `SET ROLE authenticated` with `42501 permission denied to set role`.

Therefore:
- structural risk + live conditions are confirmed;
- identity-level exploit execution is **NOT claimed as completed**;
- a fresh preview negative-test is mandatory before merge/deploy.

### 7.5 Additional Production-only jobs SELECT policy drift

Production also contains these permissive policy names, all with **0 exact-name results in current `main`**:

- `jobs_select_exchange_posted`
- `jobs_select_authenticated`
- `jobs_select_company_members_active`
- `jobs_select_owner`
- `jobs_select_assigned_driver_scoped`
- `jobs_driver_assigned_or_awarded_v1`

Do not call all of these vulnerabilities.

Classification so far:
- several are row/company/assigned/owner scoped and may only be redundant legacy drift;
- `jobs_select_exchange_posted` is broad for owner/broker profiles but is still subject to the canonical RESTRICTIVE pre-award guard, so no raw pre-award bypass is currently claimed;
- reconcile them against the canonical policy set in the same forward migration, preserving legitimate access.

### 7.6 Important non-finding

`jobs_awarded_update_only_awarded_carrier` is **RESTRICTIVE** in canonical migration `108_p0_p1_launch_hardening.sql`.

Its predicate:

`awarded_carrier_company_id IS NULL OR is_company_operator(awarded_carrier_company_id)`

is not an independent permissive UPDATE grant.

Do not misclassify it as an open-update vulnerability.

### 7.7 Required #436 remediation

Create a **new forward migration** using the approved Supabase migration creation flow.

Do not:
- edit already-applied Production migrations for this forward repair;
- invent a migration timestamp manually;
- execute direct Production DDL from the agent;
- weaken RLS/security to make tests pass.

Required migration outcome:
1. remove `drivers_select_all_jobs` fail-closed;
2. reconcile Production-only legacy `jobs` policies against the canonical set;
3. preserve Platform Owner access;
4. preserve job-owning company/operator access;
5. preserve assigned-driver access;
6. preserve awarded/winning-carrier access;
7. preserve quote-safe Marketplace discovery;
8. keep `jobs_preaward_marketplace_privacy_guard` RESTRICTIVE and intact.

Mandatory negative tests:
- app-access Driver A cannot SELECT unrelated Company B post-award/completed job;
- assigned driver can SELECT their own assigned job;
- winning carrier/company can SELECT authorised awarded job;
- competing pre-award user cannot SELECT raw private execution row;
- Platform Owner remains authorised.

Then:
- fresh Supabase preview / clean replay;
- Security Advisor;
- exact-head Netlify where relevant;
- real migration/test workflows once #433 is fixed;
- Production deployment only via approved path.

---

## 8. PR #428 / Super Admin isolation note

Supabase branch still visible:

`feat/super-admin-control-plane-e2e-20260831`

Preview project:

`bewydwcwfhccwnjsqwyn`

It contains additional Super Admin migrations through `20260831235930`, so it is not a pure `main` baseline.

However, full PR #428 patch inspection found no `CREATE POLICY` or `DROP POLICY` changes for this jobs/job_bids RLS layer. Therefore the leaner policy state seen in its preview is not explained by Super Admin policy rewrites.

Do not mix the #436 remediation with unrelated Super Admin UI/control-plane changes.

---

## 9. PR #359 visual boundary

Continue to preserve the visual constraint:
- do not import PR #359 Workspace visual differences;
- no Workspace visual redesign as part of this security/performance workstream;
- SQL/RLS/security/runtime fixes must remain functionally scoped.

---

## 10. Migration/tooling boundary

The repo's Supabase agent-scope rules prohibit agent-run Production migrations/DML and require normal migration validation before merge.

The local Supabase CLI was previously unavailable and `npx` timed out.

Therefore:
- do not fabricate a timestamped migration filename;
- do not replace the approved migration-generation flow with guessed filenames;
- if the approved migration creation command cannot run in the available execution surface, keep #436 as a tracked P0 and continue all safe read-only analysis until tooling/gates are available.

---

# 11. Exact continuation order

Continue in this order unless new evidence raises an even higher-severity blocker:

1. **P0 #436 — finish classification of Production-only `jobs` and related `job_bids` RLS drift.**
2. Identify the exact canonical policy set that should survive after convergence.
3. Search for any other row-unscoped permissive Production policies on operational/security-sensitive tables before treating the advisor warnings as mere performance debt.
4. Keep #436 forward-migration design ready, but do not invent a migration timestamp or execute Production DDL.
5. Continue attempting to restore/verify GitHub Actions runner startup under #433.
6. Once an approved migration creation + real validation path is available, implement #436 first.
7. Require negative RLS tests + clean replay + Security Advisor + exact-head evidence.
8. Deploy #436 to Production only through the approved path, then verify the legacy policy names are absent and authorised flows still work.
9. Enable leaked-password protection (#434) when a compatible Supabase Auth control plane is available; rerun advisor.
10. Resume exact duplicate-index consolidation (#435) only after the P0 RLS boundary is closed.
11. Then address unindexed FKs, auth RLS init-plan warnings, overlapping permissive-policy performance debt, unused indexes and other advisor debt one evidence-backed class at a time.
12. Only after GitHub runner gates are genuinely functional, configure `main` branch protection/rulesets/required checks.
13. Resume remaining runtime E2E/release evidence: Driver/Marketplace/Workspace/Super Admin integration, tracking, POD/offline, finance/invoices, lifecycle, notifications and final release gates.

---

## 12. Truth rules for the next chat

- Do not restart the audit from zero.
- Do not claim #436 has been exploited identity-level; the connector could not run `SET ROLE authenticated`.
- Do state that the broad Production policy is structurally unsafe against the canonical assigned-driver/company-isolation contract and live conditions exist.
- Do not claim `jobs_select_exchange_posted` bypasses pre-award privacy while the RESTRICTIVE guard exists.
- Do not call `jobs_awarded_update_only_awarded_carrier` a permissive open-update policy; it is RESTRICTIVE.
- Do not call GitHub workflow failures code failures while jobs do not acquire runners/execute steps.
- Do not enable required checks until runners work.
- Do not run Production migrations directly.
- Do not relax RLS/security.
- Do not import PR #359 visuals.
- Expo/React Native remains canonical Driver app.

---

## 13. Active issue map

- **#433 OPEN** — GitHub runner startup / release gates.
- **#434 OPEN** — Supabase leaked-password protection control-plane action.
- **#435 OPEN** — exact duplicate-index consolidation.
- **#436 OPEN / P0** — Production-only broad `jobs` RLS exposure and policy convergence.

PR #430: MERGED.  
PR #432: MERGED.  
Current `main`: `e28b6990e1f96a80ecbe5ea0a6a394acb3c0384d`.

---

**END CHECKPOINT**
