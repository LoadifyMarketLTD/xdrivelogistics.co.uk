-- Migration 20260801130000 — Narrow repair for fraud-review owner_audit_log targets
--
-- !! DO NOT APPLY — SUPERSEDED BY 20260801163000_p0_fix_fraud_review_case_audit_target_type.sql !!
--
-- Root-cause analysis (2026-08-01) confirmed owner_decide_fraud_review_case is the P0
-- caller producing "null value in column target_type".  Production schema confirmed
-- target_id and target_name are nullable (safe to add).  The safe fix is in 20260801163000.
--
-- This file is retained for audit history only.
--
-- Read-only Production lookup (run before any decision):
--
--   SELECT
--     p.oid::regprocedure AS function_signature,
--     pg_get_functiondef(p.oid) AS function_definition
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname = 'owner_decide_fraud_review_case'
--     AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, text';
--
-- This migration patches ONLY owner_decide_fraud_review_case.
-- It does NOT touch set_company_status_governance, owner_review_compliance_document,
-- apply_marketplace_governance_action, any table, any RLS policy, or any driver schema.

-- No-op body: this file is superseded by 20260801163000_p0_fix_fraud_review_case_audit_target_type.sql.
-- Executable SQL has been removed to prevent accidental execution during supabase db push.
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260801130000 superseded; no changes applied.';
END
$$;
