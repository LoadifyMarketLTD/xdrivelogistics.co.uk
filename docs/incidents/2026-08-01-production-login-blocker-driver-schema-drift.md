# Incident: Production Login Blocker — Driver Schema Drift

**Date opened:** 2026-08-01  
**Severity:** P0 — Production Critical  
**Status:** MITIGATED FOR LOGIN / OPEN FOR RECONCILIATION  
**Defect register:** DEF-009 in `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/docs/audit/11-defect-report.md`  
**PR:** #326 (keep Draft until Production read-only evidence and staging validation exist)

---

## Summary

The original incident was a Production login blocker caused by missing driver-commercial schema. The middleware compatibility fix reduced the immediate login blast radius, but the original broad database catch-up plan is no longer acceptable for Production.

Production emergency repairs have already changed live state:

- `public.drivers.driver_type` added manually
- `public.drivers.can_commercial_bid` added manually
- `public.company_documents.issued_date` added manually
- `public.driver_identity_documents.issued_date` added manually
- one duplicate submitted bid was changed to `withdrawn` while the canonical accepted bid was preserved
- `owner_review_compliance_document` may already have been corrected manually

Confirmed Production evidence now captured from Platform Owner (manual SQL, one statement at a time):

- Column inventory:
  - `drivers.can_commercial_bid` → `boolean`, `NOT NULL`, default `true`
  - `drivers.driver_type` → `text`, `NOT NULL`, default `'company_driver'`
- Constraint inventory: no prior `driver_type` constraint was present.
- Manual narrow apply executed successfully:
  - `alter table public.drivers add constraint drivers_driver_type_check check (driver_type in ('owner_driver', 'company_driver'));`
- `driver_type` data distribution: `company_driver = 5`, `owner_driver = 0`, legacy/non-canonical = `0`, `NULL = 0`.
- `can_commercial_bid` distribution: `true = 5`, `false = 0`, `NULL = 0`.

Because of those manual changes, `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801000000_p0_driver_commercial_columns_catchup.sql` must **not** be applied to Production.

It is not a narrow schema catch-up. It mixes:

- driver column creation/backfill
- global `can_commercial_bid` rewrites
- uniqueness index creation
- `job_bids` RLS replacement
- `review_onboarding_application_atomic` replacement
- company/membership activation side effects
- `notification_events` emission

---

## Production rule

Do **not** instruct the Platform Owner to apply:

`/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801000000_p0_driver_commercial_columns_catchup.sql`

Do **not** run:

- `supabase db push`
- migration repair
- Production SQL that mixes schema, data, RLS, RPC, and notification behavior

---

## Replacement artifacts in this PR

- Read-only audit package: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/ops/production_driver_commercial_reconciliation_audit.sql`
- False-row classification worksheet: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/ops/can_commercial_bid_false_row_classification.sql`
- Reconciliation runbook: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/ops/production-driver-commercial-reconciliation-runbook.md`
- Narrow schema unit: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801120000_driver_columns_constraints_reconciliation_only.sql`
- Narrow index unit: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801121000_job_bids_active_uniqueness_indexes_only.sql`
- Narrow RLS unit: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801122000_job_bids_exchange_insert_policy_only.sql`
- Narrow RPC unit: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801123000_review_onboarding_application_atomic_business_logic_only.sql`

---

## Current finding

The middleware fix protects login from missing-column regressions, and Unit A (driver column defaults/nullability + canonical `driver_type` constraint) is now aligned in Production from the confirmed manual narrow apply.

The exact concern-by-concern status, evidence, and next actions now live in:

`/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/ops/production-driver-commercial-reconciliation-runbook.md`

This incident remains open for reconciliation of the remaining independent units (indexes, RLS, RPC side effects, notifications).

---

## Related P0 runtime defect — `owner_audit_log.target_type`

> **Live body captured 2026-08-01.** The live Production `set_company_status_governance` already inserts `target_type = 'company'`. The function is PARTIALLY ALIGNED: `target_type` is correct; `target_id` and `target_name` are absent from the INSERT; the live body has two enum casts (`::text` on SELECT, `::company_status` on UPDATE) that the staged patch `20260801153000` would silently drop. The full diff is archived in the `20260801153000` migration header. The next required action is the `owner_audit_log` column nullability query below — not the function-definition query, which is now complete.

Live Production evidence for the `owner_audit_log.target_type NOT NULL` failure:

| Function / concern | Live Production evidence | Repo-canonical evidence | Status | Safest next action |
|---|---|---|---|---|
| `set_company_status_governance(uuid,uuid,text,text,text)` | **Live body captured 2026-08-01.** Already inserts `target_type = 'company'`. Omits `target_id` and `target_name`. Live body has two enum casts (`SELECT c.status::text`, `UPDATE ... status = $1::company_status`) absent from repo baseline and from migration `20260801153000`. | `075_super_admin_governance_layer.sql:150-167` omits `target_type`, `target_id`, `target_name`; omits both enum casts. Migration `20260801153000` adds target fields but drops both live enum casts — **UNSAFE AS WRITTEN**. | **PARTIALLY ALIGNED / PATCH UNSAFE** | Run `owner_audit_log` column nullability query (Section 2.2 of checklist). If `target_id` NOT NULL: author reworked patch preserving both live enum casts, add only `target_id`+`target_name` to INSERT, stage-validate, obtain approval. If `target_id` nullable: no patch needed; mark ALIGNED; retire `20260801153000`. |
| `owner_review_compliance_document(uuid,text,uuid,text,text)` | Explicitly inserts `target_type`, `target_id = p_document_id`, and `target_name`. Live semantic value is `compliance_document`. | Consistent with live. | **ALIGNED** | Preserve the live semantic contract unless separately approved. |
| `apply_marketplace_governance_action(uuid,uuid,text,text)` | Live `owner_audit_log` INSERT omits `target_type` and `target_id`, emitting NOT NULL violation. | Migration `078` contains the same bug; migration `20260801091000` provides the narrow patch. | **DIVERGENT — PATCH STAGED** | Apply only `supabase/migrations/20260801091000_fix_owner_audit_log_target_type.sql` after staging validation and Platform Owner approval. Full runbook: `supabase/ops/marketplace-governance-production-runbook.md`. |
| `owner_decide_fraud_review_case(uuid,uuid,text,text)` | Not returned by the Production read-only function query. Live status cannot be confirmed without re-running the single-signature lookup. | Migration `20260730100000` defines the function with an `owner_audit_log` INSERT that **also omits `target_type` and `target_id`** — same bug class as the marketplace function. If this migration was applied to Production, the function is broken. If it was not applied, the function may not exist live. | **BLOCKED (PRODUCTION) / DIVERGENT (REPO-CANONICAL)** | 1. Run the single-signature lookup below to determine live status. 2. If the function exists live and omits `target_type`, author a narrow patch analogous to `20260801091000` (adding `target_type = 'fraud_case'` and `target_id = p_case_id`). 3. Do not author or apply any patch without live evidence of the current function body. |

Read-only query for `owner_audit_log` column nullability — run and archive output (this is the next required step for `set_company_status_governance`):

```sql
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'owner_audit_log'
ORDER BY ordinal_position;
```

Single read-only SQL for `owner_decide_fraud_review_case` (run once, archive raw output):

```sql
SELECT
  p.oid::regprocedure AS function_signature,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'owner_decide_fraud_review_case'
  AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, text';
```

Expected outcomes and required next steps for `owner_decide_fraud_review_case`:

| Query result | Interpretation | Required action |
|---|---|---|
| Returns one row whose body includes `target_type` in the audit INSERT | Function already patched or uses a different INSERT path. | Confirm value is non-empty and matches expected semantics; no further patch needed. |
| Returns one row whose body does **not** include `target_type` | Same bug as marketplace function; Migration `20260730100000` was applied. | Author a narrow patch (same pattern as `20260801091000`) adding `target_type = 'fraud_case'` and `target_id = p_case_id`. Stage and validate before Production. |
| Returns zero rows | Function does not exist with this exact signature. | Confirm via `p.proname = 'owner_decide_fraud_review_case'` without arg filter whether any overload exists. If absent, no patch needed; document as not yet applied to Production. |

`owner_audit_log.target_type` remediation status summary: one confirmed broken (marketplace — patch staged), one unverified (fraud review — lookup pending), one partially aligned (`set_company_status_governance` — `target_type` correct, `target_id`/`target_name` absent, column nullability query pending, patch `20260801153000` unsafe as written).

---

## Single safest next action

Run the `owner_audit_log` column nullability query above and archive the output. Then run the next independent read-only Unit C statement (active company-bid duplicate compatibility).
