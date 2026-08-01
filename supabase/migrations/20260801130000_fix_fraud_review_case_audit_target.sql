-- Migration 20260801130000 — Narrow repair for fraud-review owner_audit_log targets
--
-- Live production status: BLOCKED — the single-signature Production lookup has not yet
-- returned a result for owner_decide_fraud_review_case(uuid, uuid, text, text).
-- The repo-canonical body in 20260730100000 omits target_type and target_id from the
-- owner_audit_log INSERT — the same bug class as 078_marketplace_governance_atomic_action.
--
-- This migration MUST NOT be applied to Production until:
--   1. The Platform Owner runs the single-signature read-only lookup and archives the output.
--   2. The live body is confirmed to match the repo-canonical body (i.e., target_type absent).
--   3. Staging validation is completed using supabase/tests/fraud_review_case_audit_atomicity.sql.
--   4. Platform Owner explicitly approves Production application.
--
-- If the live lookup confirms the function does not exist, this migration is NOT APPLICABLE.
-- If the live body already includes target_type, this migration is NOT APPLICABLE.
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

BEGIN;

-- ── 1. Validate canonical owner_audit_log target columns ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'owner_audit_log'
      AND column_name  = 'target_type'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_type must exist before applying 20260801130000. Apply canonical target columns first.'
      USING ERRCODE = '23514';
  END IF;

  -- Confirm NOT NULL is enforced (migration 20260801091000 should already have set this)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'owner_audit_log'
      AND column_name  = 'target_type'
      AND is_nullable  = 'YES'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_type must be NOT NULL before applying 20260801130000.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'owner_audit_log'
      AND column_name  = 'target_id'
      AND udt_name     = 'uuid'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_id uuid must exist before applying 20260801130000.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'owner_audit_log'
      AND column_name  = 'target_name'
      AND data_type    = 'text'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_name text must exist before applying 20260801130000.'
      USING ERRCODE = '23514';
  END IF;
END $$;

-- ── 2. owner_decide_fraud_review_case — add missing audit target fields ───────
--
-- All business logic, guards, status transitions, atomicity, profile blocking,
-- onboarding-application updates, SECURITY DEFINER, search_path, return type,
-- and grants are preserved exactly from 20260730100000.
--
-- Only three columns are added to the owner_audit_log INSERT:
--   target_type  = 'fraud_case'
--   target_id    = p_case_id
--   target_name  = format('Fraud review case %s', p_case_id)
CREATE OR REPLACE FUNCTION public.owner_decide_fraud_review_case(
  p_actor_user_id uuid,
  p_case_id uuid,
  p_action text,
  p_reason text
)
RETURNS TABLE (case_id uuid, old_status text, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case public.fraud_review_cases%ROWTYPE;
  v_next_status text;
  v_unresolved_count bigint;
  v_profile_status text;
  v_profile_rows bigint;
BEGIN
  IF p_action NOT IN ('investigate', 'clear', 'confirm', 'dismiss') THEN
    RAISE EXCEPTION 'Unsupported fraud-case action.'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO v_case
  FROM public.fraud_review_cases case_row
  WHERE case_row.id = p_case_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fraud review case not found.' USING ERRCODE = 'P0002';
  END IF;

  v_next_status := CASE p_action
    WHEN 'investigate' THEN 'investigating'
    WHEN 'clear' THEN 'cleared'
    WHEN 'confirm' THEN 'confirmed'
    ELSE 'dismissed'
  END;

  IF p_action = 'confirm' THEN
    IF v_case.subject_user_id IS NULL THEN
      RAISE EXCEPTION 'Fraud confirmation requires a canonical subject_user_id.'
        USING ERRCODE = '23514';
    END IF;

    SELECT profile.status
    INTO v_profile_status
    FROM public.profiles profile
    WHERE profile.user_id = v_case.subject_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fraud confirmation requires an existing canonical profile for the subject user.'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF v_case.status IN ('cleared', 'confirmed', 'dismissed')
     AND v_case.status <> v_next_status
  THEN
    RAISE EXCEPTION 'Fraud review case is already finalised as %.', v_case.status
      USING ERRCODE = '23505';
  END IF;

  IF v_case.status = v_next_status
     AND COALESCE(v_case.decision_reason, '') = COALESCE(p_reason, '')
  THEN
    IF p_action = 'confirm' AND v_profile_status IS DISTINCT FROM 'blocked' THEN
      RAISE EXCEPTION 'Fraud case is already confirmed but subject profile is not blocked.'
        USING ERRCODE = '23514';
    END IF;

    RETURN QUERY SELECT v_case.id, v_case.status, v_case.status;
    RETURN;
  END IF;

  UPDATE public.fraud_review_cases
  SET status = v_next_status,
      decision_reason = p_reason,
      assigned_to = p_actor_user_id,
      decided_by = CASE WHEN p_action = 'investigate' THEN NULL ELSE p_actor_user_id END,
      decided_at = CASE WHEN p_action = 'investigate' THEN NULL ELSE now() END,
      updated_at = now()
  WHERE id = v_case.id;

  IF v_case.onboarding_application_id IS NOT NULL THEN
    IF p_action = 'confirm' THEN
      UPDATE public.onboarding_applications
      SET risk_status = 'confirmed_fraud',
          risk_reason = p_reason,
          risk_updated_at = now(),
          risk_reviewed_by = p_actor_user_id,
          status = 'rejected',
          reviewed_at = now(),
          reviewed_by = p_actor_user_id,
          review_notes = p_reason
      WHERE id = v_case.onboarding_application_id;
    ELSIF p_action IN ('clear', 'dismiss') THEN
      SELECT count(*)
      INTO v_unresolved_count
      FROM public.fraud_review_cases other_case
      WHERE other_case.onboarding_application_id = v_case.onboarding_application_id
        AND other_case.id <> v_case.id
        AND other_case.status IN ('open', 'investigating', 'confirmed');

      IF v_unresolved_count = 0 THEN
        UPDATE public.onboarding_applications
        SET risk_status = 'clear',
            risk_reason = NULL,
            risk_updated_at = now(),
            risk_reviewed_by = p_actor_user_id
        WHERE id = v_case.onboarding_application_id;
      END IF;
    END IF;
  END IF;

  IF p_action = 'confirm' THEN
    UPDATE public.profiles
    SET status = 'blocked'
    WHERE user_id = v_case.subject_user_id;

    GET DIAGNOSTICS v_profile_rows = ROW_COUNT;
    IF v_profile_rows <> 1 THEN
      RAISE EXCEPTION 'Fraud confirmation expected exactly one canonical profile update, got %.', v_profile_rows
        USING ERRCODE = '23514';
    END IF;
  END IF;

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
    metadata
  )
  VALUES (
    p_actor_user_id,
    'fraud_case',
    p_case_id,
    format('Fraud review case %s', p_case_id),
    v_case.subject_company_id,
    format('fraud_case_%s', p_action),
    v_case.status,
    v_next_status,
    p_reason,
    jsonb_build_object(
      'fraud_case_id', v_case.id,
      'subject_user_id', v_case.subject_user_id,
      'onboarding_application_id', v_case.onboarding_application_id
    )
  );

  RETURN QUERY SELECT v_case.id, v_case.status, v_next_status;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
