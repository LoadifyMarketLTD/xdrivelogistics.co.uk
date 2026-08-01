-- Historical candidate patch SQL has been preserved at:
--   docs/ops/20260801163000_p0_fix_fraud_review_case_audit_target_type.historical.sql
--
-- Production evidence closure (2026-08-01):
-- - to_regprocedure('public.owner_decide_fraud_review_case(uuid,uuid,text,text)') returned zero rows
-- - information_schema.tables returned only profiles and onboarding_applications; fraud_review_cases is absent
--
-- This migration is archived as NOT APPLICABLE and remains an executable no-op so
-- the automatic migration chain cannot attempt function rewrites, DDL, DML, or grants.

BEGIN;

DO $$
BEGIN
  RAISE NOTICE
    '20260801163000_p0_fix_fraud_review_case_audit_target_type.sql is archived as NOT APPLICABLE and intentionally performs no schema or data changes. See docs/ops for the historical candidate patch SQL.';
END;
$$;

COMMIT;
