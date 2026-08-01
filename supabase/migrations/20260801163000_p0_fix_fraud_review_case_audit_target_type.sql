-- Migration 20260801163000 — P0 fix: owner_decide_fraud_review_case missing target_type
--
-- Root-cause analysis (2026-08-01):
--
-- Four functions INSERT into owner_audit_log.  owner_audit_log.target_type is NOT NULL
-- with no default.  The ongoing P0 error "null value in column target_type" is produced by
-- the one remaining function that omits target_type from its INSERT:
--
--   Function                         | Fix migration         | Status
--   ---------------------------------+-----------------------+------------------
--   apply_marketplace_governance_action | 20260801091000     | Applied ✓
--   owner_review_compliance_document    | 20260801080500     | Applied ✓
--   set_company_status_governance       | live body confirmed | Already present ✓
--   owner_decide_fraud_review_case      | 20260801130000     | BLOCKED — this file
--
-- This migration is the P0 fix.  Migration 20260801130000 was blocked pending live-body
-- confirmation.  The Production schema (confirmed 2026-08-01) shows target_id and
-- target_name are both nullable, so adding them alongside target_type is safe.
--
-- Unlike set_company_status_governance, owner_decide_fraud_review_case contains no
-- dynamic SQL with enum casts — there are no dangerous DIFF A / DIFF B concerns.
-- The full business logic from 20260730100000 is preserved exactly; the only change
-- is the addition of three fields to the owner_audit_log INSERT:
--
--   target_type  = 'fraud_case'                          ← fixes P0 NOT NULL violation
--   target_id    = p_case_id                             ← audit observability
--   target_name  = format('Fraud review case %s', p_case_id)  ← audit observability
--
-- This migration SUPERSEDES 20260801130000_fix_fraud_review_case_audit_target.sql.
-- That file MUST NOT be applied — it is now superseded by this migration.

BEGIN;

-- ── 1. Validate canonical owner_audit_log target columns ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'owner_audit_log'
      AND column_name  = 'target_type'
      AND data_type    = 'text'
      AND is_nullable  = 'NO'
  ) THEN
    RAISE EXCEPTION
      'owner_audit_log.target_type text NOT NULL must exist before applying 20260801163000.'
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
      'owner_audit_log.target_id uuid must exist before applying 20260801163000.'
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
      'owner_audit_log.target_name text must exist before applying 20260801163000.'
      USING ERRCODE = '23514';
  END IF;
END $$;

-- ── 2. owner_decide_fraud_review_case — add missing target_type (P0 fix) ─────
--
-- All business logic is preserved exactly from 20260730100000:
--   - Action validation ('investigate', 'clear', 'confirm', 'dismiss')
--   - Idempotency guard (same status + same reason = early return)
--   - fraud_review_cases status update with decided_by / decided_at
--   - onboarding_applications risk_status backfill on confirm/clear/dismiss
--   - profiles.status = 'blocked' on confirm with ROW_COUNT assertion
--   - SECURITY DEFINER, search_path, return type, grants
--
-- Only the owner_audit_log INSERT gains three fields:
--   target_type = 'fraud_case'  ← P0 fix
--   target_id   = p_case_id     ← observability
--   target_name = format(...)   ← observability
CREATE OR REPLACE FUNCTION public.owner_decide_fraud_review_case(
  p_actor_user_id uuid,
  p_case_id       uuid,
  p_action        text,
  p_reason        text
)
RETURNS TABLE (case_id uuid, old_status text, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case              public.fraud_review_cases%ROWTYPE;
  v_next_status       text;
  v_unresolved_count  bigint;
  v_profile_status    text;
  v_profile_rows      bigint;
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
    WHEN 'clear'       THEN 'cleared'
    WHEN 'confirm'     THEN 'confirmed'
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
  SET status          = v_next_status,
      decision_reason = p_reason,
      assigned_to     = p_actor_user_id,
      decided_by      = CASE WHEN p_action = 'investigate' THEN NULL ELSE p_actor_user_id END,
      decided_at      = CASE WHEN p_action = 'investigate' THEN NULL ELSE now() END,
      updated_at      = now()
  WHERE id = v_case.id;

  IF v_case.onboarding_application_id IS NOT NULL THEN
    IF p_action = 'confirm' THEN
      UPDATE public.onboarding_applications
      SET risk_status      = 'confirmed_fraud',
          risk_reason      = p_reason,
          risk_updated_at  = now(),
          risk_reviewed_by = p_actor_user_id,
          status           = 'rejected',
          reviewed_at      = now(),
          reviewed_by      = p_actor_user_id,
          review_notes     = p_reason
      WHERE id = v_case.onboarding_application_id;
    ELSIF p_action IN ('clear', 'dismiss') THEN
      SELECT count(*)
      INTO v_unresolved_count
      FROM public.fraud_review_cases other_case
      WHERE other_case.onboarding_application_id = v_case.onboarding_application_id
        AND other_case.id    <> v_case.id
        AND other_case.status IN ('open', 'investigating', 'confirmed');

      IF v_unresolved_count = 0 THEN
        UPDATE public.onboarding_applications
        SET risk_status      = 'clear',
            risk_reason      = NULL,
            risk_updated_at  = now(),
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

  -- target_type = 'fraud_case' is the P0 fix; target_id and target_name are observability enrichment
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
      'fraud_case_id',              v_case.id,
      'subject_user_id',            v_case.subject_user_id,
      'onboarding_application_id',  v_case.onboarding_application_id
    )
  );

  RETURN QUERY SELECT v_case.id, v_case.status, v_next_status;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
