# Final Production Release Checklist — PR #326

**PR:** [#326](https://github.com/LoadifyMarketLTD/xdrivelogistics.co.uk/pull/326)
**Status:** READY FOR REVIEW — DO NOT MERGE
**Generated:** 2026-08-01
**Current local head while editing:** `cdb3ad9ba55bcd053367b19780be2c9226b6e830`

---

## Section 1 — Canonical PR scope

The current GitHub title/body are aligned with the actual PR scope. PR #326 now spans web, Supabase, CI, governance, CSP, middleware, feature flags, incidents, staged runbooks, and audit evidence.

### Current PR title

`chore: finalize audit evidence, CI governance, CSP hardening, middleware compatibility, and staged Supabase runbooks`

### Current PR body topics

The GitHub PR body explicitly covers all of the following:

- automated audit runner and generated evidence
- monorepo governance / `CODEOWNERS` / PR template / CI filters
- CSP nonce and robots hardening
- middleware and driver-schema compatibility work
- identity / compliance and `owner_audit_log` repairs
- Feature Flags `is_enabled` fix
- marketplace / company / fraud governance migrations
- explicit Production safety section
- superseded / no-op migrations
- remaining manual / live gates

### Canonical reviewer-facing scope summary

- Automated audit runner plus generated static evidence under `docs/audit/`
- Monorepo governance updates: `.github/CODEOWNERS`, `.github/pull_request_template.md`, CI filter changes
- Security header hardening: nonce-based CSP handling and robots protection
- Middleware compatibility work for Production schema drift around `drivers.can_commercial_bid`
- Identity/compliance route and migration repairs
- `owner_audit_log` remediation package split into marketplace, company-governance, and fraud-review tracks
- Feature Flags `is_enabled` contract fix across API/UI/tests
- Driver-commercial incident packet, reconciliation runbook, staged narrow migrations, and blocked Production gates

---

## Section 2 — Canonical migration inventory for PR #326

Each migration below is classified as exactly one of the required labels.

| Migration | Classification | Production interpretation / merge gate note |
|---|---|---|
| `20260801000000_p0_driver_commercial_columns_catchup.sql` | **DO NOT APPLY** | Repository copy is now an executable no-op; the retired broad catch-up SQL is archived under `docs/ops/20260801000000_p0_driver_commercial_columns_catchup.historical.sql` and must not be used for Production. |
| `20260801080000_canonical_owner_audit_log_target_columns.sql` | **ACTIVE — candidate for later controlled apply** | Canonical schema normalization for `owner_audit_log.target_type`, `target_id`, and `target_name`; required before later repo function repairs but still needs staging validation and Platform Owner approval before any Production apply. |
| `20260801080500_fix_owner_review_compliance_document_function.sql` | **ACTIVE — candidate for later controlled apply** | Repo repair remains available, but Production runtime evidence for any manual equivalent is still incomplete. |
| `20260801091000_fix_owner_audit_log_target_type.sql` | **ACTIVE — candidate for later controlled apply** | Confirmed narrow patch for `apply_marketplace_governance_action`; requires staging evidence and Platform Owner approval before Production apply. |
| `20260801120000_driver_columns_constraints_reconciliation_only.sql` | **ALREADY APPLIED MANUALLY** | Its Production intent is already satisfied by confirmed manual driver-column repairs and the manual `drivers_driver_type_check` apply. |
| `20260801121000_job_bids_active_uniqueness_indexes_only.sql` | **ACTIVE — candidate for later controlled apply** | Apply only after duplicate preflights C1/C2 return zero rows and staging validation is archived. |
| `20260801122000_job_bids_exchange_insert_policy_only.sql` | **ACTIVE — candidate for later controlled apply** | Requires live `pg_policies` evidence plus disposable validation; no Production apply yet. |
| `20260801123000_review_onboarding_application_atomic_business_logic_only.sql` | **ACTIVE — candidate for later controlled apply** | Requires live function-body comparison and disposable validation; no Production apply yet. |
| `20260801124000_restore_company_membership_job_bids_policy.sql` | **ACTIVE — candidate for later controlled apply** | Keep as a later controlled unit only if live policy evidence shows it is still needed. |
| `20260801130000_fix_fraud_review_case_audit_target.sql` | **SUPERSEDED NO-OP** | Must remain an executable no-op. Superseded by `20260801163000_p0_fix_fraud_review_case_audit_target_type.sql`. |
| `20260801153000_fix_company_governance_audit_target.sql` | **SUPERSEDED NO-OP** | Must remain an executable no-op. Superseded by `20260801160500_safe_company_governance_audit_enrichment.sql`. |
| `20260801160500_safe_company_governance_audit_enrichment.sql` | **ACTIVE — candidate for later controlled apply** | Observability-only enrichment for `set_company_status_governance`; only relevant if Platform Owner wants the extra audit fields after live column/nullability confirmation. |
| `20260801163000_p0_fix_fraud_review_case_audit_target_type.sql` | **NOT APPLICABLE / ARCHIVED NO-OP** | Production evidence is decisive: `to_regprocedure('public.owner_decide_fraud_review_case(uuid,uuid,text,text)')` returned zero rows and `information_schema.tables` showed only `profiles` and `onboarding_applications` (no `fraud_review_cases`). The automatic-chain migration is now notice-only no-op; candidate SQL is archived at `docs/ops/20260801163000_p0_fix_fraud_review_case_audit_target_type.historical.sql`. |

### Superseded / no-op migrations that must remain non-destructive

- `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801130000_fix_fraud_review_case_audit_target.sql`
- `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801153000_fix_company_governance_audit_target.sql`

Both files must stay executable no-ops and must never be recommended for Production apply.

---

## Section 3 — `owner_audit_log` caller reconciliation

The following status language is canonical for PR #326 and must stay consistent across the incident doc, runbooks, and this release checklist.

| Function | Canonical status | Evidence summary | Production action |
|---|---|---|---|
| `owner_review_compliance_document(uuid,text,uuid,text,text)` | **ALIGNED** | Repo repair explicitly writes `target_type`, `target_id`, and `target_name`; no contradictory live evidence has been captured. | No claim that Production P0 is closed; keep as a controlled migration candidate only if rollout is still needed. |
| `apply_marketplace_governance_action(uuid,uuid,text,text)` | **DIVERGENT — PATCH STAGED** | Live Production evidence shows the audit INSERT omits `target_type`; `20260801091000` is the narrow repair. | Staging validation + Platform Owner approval required before any Production SQL. |
| `set_company_status_governance(uuid,uuid,text,text,text)` | **PARTIAL / OPTIONAL LATER ENRICHMENT** | Live body already writes `target_type='company'`, but omits `target_id`/`target_name`; old patch `20260801153000` was unsafe and is now superseded by no-op. `20260801160500` is an optional later enrichment only. | Run the `owner_audit_log` column-nullability query first. If `target_id` is nullable, Production SQL is not required. If not, treat `20260801160500` as a later controlled enhancement candidate only after staging. |
| `owner_decide_fraud_review_case(uuid,uuid,text,text)` | **NOT APPLICABLE (PRODUCTION) / ARCHIVED NO-OP (AUTOMATIC CHAIN)** | Exact Production lookup via `to_regprocedure('public.owner_decide_fraud_review_case(uuid,uuid,text,text)')` returned zero rows; `information_schema.tables` returned only `profiles` and `onboarding_applications`, so `fraud_review_cases` is absent. `20260801163000` is archived as no-op and its candidate SQL is preserved historically. | No staging or Production approval is required for this migration because there is no live target object to patch. Do not apply patch SQL. |

---

## Section 4 — Closure evidence for `20260801163000`

### Captured Production outputs (decisive)

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE oid = to_regprocedure(
  'public.owner_decide_fraud_review_case(uuid,uuid,text,text)'
);
-- Result: zero rows (no matching function signature in Production)
```

```sql
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('fraud_review_cases', 'profiles', 'onboarding_applications')
ORDER BY table_name;
-- Result: profiles, onboarding_applications only; fraud_review_cases absent
```

### Final classification

- Migration status: **NOT APPLICABLE / archived / automatic-chain no-op**
- Runtime apply status: **must not be applied**
- Approval requirement: **no staging or Production approval required for this migration** because there is no live target object to patch.

---

## Section 5 — Final Production runbooks

Production SQL guidance for this PR is split into narrow, evidence-driven runbooks only:

- Marketplace governance: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/ops/marketplace-governance-production-runbook.md`
- Driver-commercial reconciliation: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/ops/production-driver-commercial-reconciliation-runbook.md`
- Fraud review audit-target patch: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/ops/fraud-review-case-audit-target-production-runbook.md`

**Production safety rule:** no generic `supabase db push` recommendation is allowed for this PR.

---

## Section 6 — Review comments and contradiction reconciliation

### Required consistency claims

- Every previous **ALIGNED / PARTIAL / DIVERGENT / BLOCKED** statement for the `owner_audit_log` tracks is now normalized to Section 3 above.
- No document in the updated closure packet recommends applying `20260801130000` or `20260801153000`.
- No updated closure document claims the `target_type` P0 is closed in Production before runtime evidence and staging proof exist.
- The fraud-review path is documented as **NOT APPLICABLE / archived no-op** with decisive Production evidence.

### Open reviewer gates that still block merge confidence

As of this task, PR review threads still include unresolved comments about:

1. release checklist / PR-scope reconciliation against the final diff
2. CSP request-header forwarding
3. broker customer query decoding
4. migration-chain safety around canonical `owner_audit_log` target columns
5. broad driver catch-up semantics
6. CI path filtering for Expo checks
7. automated audit secrets-history command correctness
8. any remaining outdated-but-unresolved comment metadata in GitHub

Those threads are not treated as accepted here unless the Platform Owner resolves or explicitly waives them in writing.

---

## Section 7 — Final CI and merge gate

Before merge can be considered, all of the following must be true:

- [x] GitHub PR title/body aligned with the canonical scope above
- [ ] Final head SHA recorded after the last documentation commit
- [ ] CI rerun on the final head and all required workflows conclude green
- [ ] `20260801130000` still remains an executable no-op
- [ ] `20260801153000` still remains an executable no-op
- [x] Raw Production evidence for `20260801163000` is attached and the migration is marked NOT APPLICABLE / archived no-op
- [ ] Staging/disposable validation is attached for every still-active Production migration candidate
- [ ] Unresolved review threads are either fixed or explicitly waived in writing by the Platform Owner
- [ ] `mergeable_state` remains clean and no conflict with `main` is reported

**Current verdict:** **NO GO — DO NOT MERGE.**
