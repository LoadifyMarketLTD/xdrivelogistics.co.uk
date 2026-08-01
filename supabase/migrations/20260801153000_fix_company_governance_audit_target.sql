-- Migration 20260801153000 — Narrow repair for company-governance owner_audit_log targets
--
-- Live runtime evidence confirmed the current owner_audit_log.target_type NOT NULL
-- violation is emitted by set_company_status_governance(uuid, uuid, text, text, text).
-- The canonical body in 075_super_admin_governance_layer.sql writes an audit row
-- without target_type, target_id, or target_name even though the live schema
-- requires those target columns.
--
-- This migration intentionally patches only set_company_status_governance while
-- preserving its business rules, SECURITY DEFINER posture, search_path, return
-- type, grants, and trigger-coupled behavior.

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
