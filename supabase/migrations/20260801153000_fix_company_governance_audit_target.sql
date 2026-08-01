-- Migration 20260801153000 — Narrow repair for company-governance owner_audit_log targets
--
-- !! DO NOT APPLY TO PRODUCTION !!
-- This migration has NOT been validated against the live Production function body.
-- The claim of "live runtime evidence confirmed" was incorrect at time of authoring.
-- Contradictory evidence exists in the repo:
--   - docs/audit/20-production-release-checklist-final.md and
--     docs/incidents/2026-08-01-production-login-blocker-driver-schema-drift.md and
--     supabase/ops/production-driver-commercial-reconciliation-runbook.md
--   all claimed set_company_status_governance was ALIGNED (target_type already present).
--   Those ALIGNED claims have been retracted — the live body has never been captured.
--
-- Repo-canonical analysis (075_super_admin_governance_layer.sql:150-167) shows the
-- function body omits target_type, target_id, and target_name from the owner_audit_log
-- INSERT, which would emit a NOT NULL violation.  However, it is unknown whether the
-- live Production function matches that repo body or has already been corrected manually.
--
-- Required before this migration may be applied:
--   1. Capture the exact live Production function body with the read-only SQL below.
--   2. Diff the live body line-by-line against this migration.
--   3. Prove the failing action path from the Production error log.
--   4. Validate on a disposable/staging database loaded with the captured live body.
--   5. Obtain Platform Owner written approval.
--
-- Read-only SQL to run first (archive raw output before proceeding):
--
--   SELECT
--     p.oid::regprocedure AS function_signature,
--     pg_get_function_arguments(p.oid) AS arguments,
--     pg_get_function_result(p.oid) AS returns,
--     p.prosecdef AS security_definer,
--     array_to_string(p.proconfig, E'\n') AS proc_config,
--     pg_get_functiondef(p.oid) AS function_definition
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname = 'set_company_status_governance'
--     AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, text, text';
--
-- This migration intentionally patches only set_company_status_governance while
-- preserving its business rules, SECURITY DEFINER posture, search_path, return
-- type, grants, and trigger-coupled behavior — subject to live-body validation.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_type'
      AND data_type = 'text'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_type text NOT NULL must exist before applying 20260801153000_fix_company_governance_audit_target.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_id'
      AND udt_name = 'uuid'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_id uuid must exist before applying 20260801153000_fix_company_governance_audit_target.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_name'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_name text must exist before applying 20260801153000_fix_company_governance_audit_target.'
      USING ERRCODE = '23514';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_company_status_governance(
  p_actor_user_id uuid,
  p_target_company_id uuid,
  p_action_type text,
  p_new_status text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (company_id uuid, old_status text, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_new_status text := lower(trim(COALESCE(p_new_status, '')));
  v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'No reason provided.');
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_user_id is required for governance status updates.'
      USING ERRCODE = '23502';
  END IF;

  SELECT c.status
  INTO v_old_status
  FROM public.companies c
  WHERE c.id = p_target_company_id
  FOR UPDATE;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Company not found for governance status update.'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.assert_company_status_transition(v_old_status, v_new_status);
  PERFORM set_config('app.company_status_change_context', 'governance_api', true);

  EXECUTE 'UPDATE public.companies SET status = $1 WHERE id = $2'
  USING v_new_status, p_target_company_id;

  INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_type,
    target_id,
    target_name,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    created_at
  )
  VALUES (
    p_actor_user_id,
    'company',
    p_target_company_id,
    format('Company %s', p_target_company_id),
    p_target_company_id,
    p_action_type,
    lower(trim(v_old_status)),
    v_new_status,
    v_reason,
    now()
  );

  RETURN QUERY
  SELECT p_target_company_id, lower(trim(v_old_status)), v_new_status;
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_company_status_governance(uuid, uuid, text, text, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
