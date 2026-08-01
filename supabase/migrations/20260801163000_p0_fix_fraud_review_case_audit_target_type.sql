-- Migration 20260801163000 — P0 fix: owner_decide_fraud_review_case missing target_type
--
-- !! DO NOT APPLY until the two open evidence gaps below are resolved. !!
--
-- Root-cause analysis (2026-08-01):
--
-- Four functions INSERT into owner_audit_log.  owner_audit_log.target_type is NOT NULL
-- with no default.  Repo-canonical analysis identifies owner_decide_fraud_review_case
-- (body in 20260730100000) as the sole remaining function whose INSERT omits target_type.
--
--   Function                            | Fix migration     | Status
--   ------------------------------------+-------------------+------------------
--   apply_marketplace_governance_action | 20260801091000    | Applied ✓
--   owner_review_compliance_document    | 20260801080500    | Applied ✓
--   set_company_status_governance       | live body in 20260801153000 header | Repo evidence only — see GAP 1
--   owner_decide_fraud_review_case      | 20260801130000    | BLOCKED — this file
--
-- ── UNRESOLVED EVIDENCE GAPS (must be cleared before Production apply) ─────────
--
-- GAP 1 — Live body of owner_decide_fraud_review_case not confirmed.
--   The claim that this function is the P0 caller is based on repo-canonical migration
--   history (20260730100000), not on a live pg_get_functiondef result.  Before applying
--   this migration, the Platform Owner MUST run:
--
--     SELECT pg_get_functiondef(p.oid)
--     FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--     WHERE n.nspname = 'public'
--       AND p.proname = 'owner_decide_fraud_review_case'
--       AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, text';
--
--   If the live body already contains target_type = 'fraud_case', this migration is
--   NOT APPLICABLE.  If the function does not exist, this migration is NOT APPLICABLE.
--   Only proceed if the live body matches 20260730100000 (no target_type in INSERT).
--
-- GAP 2 — public.fraud_review_cases schema cache warning.
--   Production previously reported: "Could not find the table 'public.fraud_review_cases'
--   in the schema cache."  This migration references fraud_review_cases%ROWTYPE and
--   performs SELECT/UPDATE on that table.  If the table is absent from the live schema,
--   CREATE OR REPLACE FUNCTION will fail at compile time.
--   Before applying, the Platform Owner MUST run:
--
--     SELECT table_name, table_type
--     FROM information_schema.tables
--     WHERE table_schema = 'public'
--       AND table_name = 'fraud_review_cases';
--
--   The preflight in section 2 below will also catch this at migration time.
--
-- ── Summary ──────────────────────────────────────────────────────────────────
--
-- The SQL is correct as written.  The only change vs 20260730100000 is three fields
-- added to the owner_audit_log INSERT:
--
--   target_type  = 'fraud_case'                              ← fixes P0 NOT NULL violation
--   target_id    = p_case_id                                 ← audit observability
--   target_name  = format('Fraud review case %s', p_case_id) ← audit observability
--
-- Unlike set_company_status_governance there are no enum cast concerns.
-- All business logic is preserved exactly from 20260730100000.
--
-- This migration SUPERSEDES 20260801130000_fix_fraud_review_case_audit_target.sql.
-- That file MUST NOT be applied — it is superseded by this migration.

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

-- ── 2. Validate dependent tables and key columns (GAP 2 guard) ───────────────
--
-- CREATE OR REPLACE FUNCTION will fail at compile time if fraud_review_cases does
-- not exist (the function body references fraud_review_cases%ROWTYPE).  The guards
-- below surface a clear error before the function creation is attempted.
DO $$
BEGIN
  -- 2a. fraud_review_cases — table and all columns written or read by the function
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fraud_review_cases'
  ) THEN
    RAISE EXCEPTION
      'public.fraud_review_cases does not exist. Resolve GAP 2 (schema cache warning) before applying 20260801163000.'
      USING ERRCODE = '42P01';
  END IF;

  -- Columns read by the function
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fraud_review_cases' AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'fraud_review_cases.status must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fraud_review_cases' AND column_name = 'subject_user_id'
  ) THEN
    RAISE EXCEPTION 'fraud_review_cases.subject_user_id must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fraud_review_cases' AND column_name = 'subject_company_id'
  ) THEN
    RAISE EXCEPTION 'fraud_review_cases.subject_company_id must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fraud_review_cases' AND column_name = 'onboarding_application_id'
  ) THEN
    RAISE EXCEPTION 'fraud_review_cases.onboarding_application_id must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fraud_review_cases' AND column_name = 'decision_reason'
  ) THEN
    RAISE EXCEPTION 'fraud_review_cases.decision_reason must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  -- Columns written by the function
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fraud_review_cases' AND column_name = 'assigned_to'
  ) THEN
    RAISE EXCEPTION 'fraud_review_cases.assigned_to must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fraud_review_cases' AND column_name = 'decided_by'
  ) THEN
    RAISE EXCEPTION 'fraud_review_cases.decided_by must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fraud_review_cases' AND column_name = 'decided_at'
  ) THEN
    RAISE EXCEPTION 'fraud_review_cases.decided_at must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fraud_review_cases' AND column_name = 'updated_at'
  ) THEN
    RAISE EXCEPTION 'fraud_review_cases.updated_at must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  -- 2b. profiles — table and columns read/written by the confirm branch
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION 'public.profiles does not exist. Required by fraud confirm branch in 20260801163000.'
      USING ERRCODE = '42P01';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'profiles.user_id must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'profiles.status must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  -- 2c. onboarding_applications — table and columns written by confirm/clear/dismiss branches
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'onboarding_applications'
  ) THEN
    RAISE EXCEPTION 'public.onboarding_applications does not exist. Required by onboarding backfill branch in 20260801163000.'
      USING ERRCODE = '42P01';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'onboarding_applications' AND column_name = 'risk_status'
  ) THEN
    RAISE EXCEPTION 'onboarding_applications.risk_status must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'onboarding_applications' AND column_name = 'risk_reason'
  ) THEN
    RAISE EXCEPTION 'onboarding_applications.risk_reason must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'onboarding_applications' AND column_name = 'risk_updated_at'
  ) THEN
    RAISE EXCEPTION 'onboarding_applications.risk_updated_at must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'onboarding_applications' AND column_name = 'risk_reviewed_by'
  ) THEN
    RAISE EXCEPTION 'onboarding_applications.risk_reviewed_by must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'onboarding_applications' AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'onboarding_applications.status must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'onboarding_applications' AND column_name = 'reviewed_at'
  ) THEN
    RAISE EXCEPTION 'onboarding_applications.reviewed_at must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'onboarding_applications' AND column_name = 'reviewed_by'
  ) THEN
    RAISE EXCEPTION 'onboarding_applications.reviewed_by must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'onboarding_applications' AND column_name = 'review_notes'
  ) THEN
    RAISE EXCEPTION 'onboarding_applications.review_notes must exist before applying 20260801163000.'
      USING ERRCODE = '42703';
  END IF;
END $$;

-- ── 3. owner_decide_fraud_review_case — add missing target_type (P0 fix) ─────
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
