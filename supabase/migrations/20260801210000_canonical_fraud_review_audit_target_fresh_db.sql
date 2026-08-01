-- Migration 20260801210000 — Canonical fresh-DB fix: owner_decide_fraud_review_case target_type
--
-- Context
-- -------
-- Migration 20260801163000 was archived as NOT APPLICABLE because production evidence
-- showed public.fraud_review_cases was absent and owner_decide_fraud_review_case did not
-- exist in the live schema cache.  However, on a fresh supabase db reset, the full
-- migration chain runs from migration 001 onwards:
--
--   20260729161000 creates both public.fraud_review_cases and owner_decide_fraud_review_case
--   20260730100000 updates owner_decide_fraud_review_case — still omitting target_type
--   20260801080000 adds target_type NOT NULL (no default) to owner_audit_log
--   20260801163000 is a no-op → owner_decide_fraud_review_case remains broken on fresh DB
--
-- After migration 20260801080000 any call to owner_decide_fraud_review_case on a fresh-DB
-- environment raises:
--   null value in column "target_type" of relation "owner_audit_log" violates not-null constraint
--
-- This migration resolves that gap with the following semantics:
--
--   Production (fraud_review_cases absent):  NOTICE + no-op.
--   Fresh DB  (fraud_review_cases present):  CREATE OR REPLACE with target_type = 'fraud_case'.
--
-- The fix is semantically identical to the candidate SQL preserved in
--   docs/ops/20260801163000_p0_fix_fraud_review_case_audit_target_type.historical.sql
-- with one change: the strict RAISE EXCEPTION preflight for the table's existence is
-- replaced by a graceful NOTICE so production environments are not blocked.
--
-- Design constraints (from issue #327)
-- -------------------------------------
--   - No column DEFAULT on owner_audit_log.target_type.
--   - No trigger that auto-populates target_type.
--   - All callers supply an explicit semantic value; this migration is not a backstop.
--   - All business logic from migration 20260730100000 is preserved exactly.
--   - Only the three audit fields gain new values:
--       target_type  = 'fraud_case'                               ← P0 fix
--       target_id    = p_case_id                                  ← observability
--       target_name  = format('Fraud review case %s', p_case_id) ← observability

BEGIN;

-- ── 1. Validate owner_audit_log canonical target columns ──────────────────────
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
      'owner_audit_log.target_type text NOT NULL must exist before applying 20260801210000. Apply 20260801080000 first.'
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
      'owner_audit_log.target_id uuid must exist before applying 20260801210000.'
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
      'owner_audit_log.target_name text must exist before applying 20260801210000.'
      USING ERRCODE = '23514';
  END IF;
END $$;

-- ── 2. Conditionally patch owner_decide_fraud_review_case ─────────────────────
--
-- The function references fraud_review_cases%ROWTYPE, so CREATE OR REPLACE will
-- fail at compile time if the table is absent.  Use EXECUTE to defer compilation
-- to runtime, after confirming both preconditions hold.
DO $$
BEGIN
  -- Precondition A: fraud_review_cases must be an updatable base table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'fraud_review_cases'
      AND table_type   = 'BASE TABLE'
  ) THEN
    RAISE NOTICE
      '20260801210000: public.fraud_review_cases does not exist (production environment); no function changes applied.';
    RETURN;
  END IF;

  -- Precondition B: function must exist (created by 20260729161000 / 20260730100000)
  IF to_regprocedure('public.owner_decide_fraud_review_case(uuid,uuid,text,text)') IS NULL THEN
    RAISE NOTICE
      '20260801210000: public.owner_decide_fraud_review_case does not exist; no function changes applied.';
    RETURN;
  END IF;

  -- Both preconditions met: apply fix via EXECUTE to defer compile-time table reference
  EXECUTE $FUNC$
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
    AS $body$
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
            AND other_case.id     <> v_case.id
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
          'fraud_case_id',             v_case.id,
          'subject_user_id',           v_case.subject_user_id,
          'onboarding_application_id', v_case.onboarding_application_id
        )
      );

      RETURN QUERY SELECT v_case.id, v_case.status, v_next_status;
    END;
    $body$
  $FUNC$;

  EXECUTE $REVOKE$
    REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) FROM PUBLIC
  $REVOKE$;

  EXECUTE $GRANT$
    GRANT EXECUTE ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) TO service_role
  $GRANT$;

  RAISE NOTICE '20260801210000: owner_decide_fraud_review_case patched; target_type = ''fraud_case'' is now included in the audit INSERT.';
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
