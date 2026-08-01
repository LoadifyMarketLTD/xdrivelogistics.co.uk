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

The middleware fix can protect login from a missing-column regression, but the live Production database now requires a read-only reconciliation flow instead of a replay migration.

The exact concern-by-concern status, evidence, and next actions now live in:

`/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/ops/production-driver-commercial-reconciliation-runbook.md`

Until that drift ledger is populated with raw Production query output and staging validation evidence, this incident remains open.

---

## Single safest next action

Run the read-only audit package against Production, archive the raw outputs, and update the reconciliation runbook before approving any narrow unit for staging or Production.
