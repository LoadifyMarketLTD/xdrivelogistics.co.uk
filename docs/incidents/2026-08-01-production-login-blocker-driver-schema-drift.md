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

## Single safest next action

Run the next independent read-only Unit C statement (active company-bid duplicate compatibility) and archive the raw output before any index/RLS/RPC change.
