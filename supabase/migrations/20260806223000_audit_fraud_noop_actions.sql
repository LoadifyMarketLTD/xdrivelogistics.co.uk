-- Guarantee an audit record for every successful Platform Owner fraud action.
--
-- The previous canonical function returned success without inserting an audit row
-- when the requested action, resulting status and written reason were identical to
-- the current case state. This patch preserves idempotent business-state behaviour
-- while recording that repeated confirmed action with metadata.no_state_change=true.
--
-- This migration is committed only; it is not applied to any environment here.

BEGIN;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'fraud_review_cases'
      AND table_type = 'BASE TABLE'
  ) THEN
    RAISE NOTICE
      '20260806223000: public.fraud_review_cases does not exist; no function changes applied.';
    RETURN;
  END IF;

  IF to_regprocedure(
    'public.owner_decide_fraud_review_case(uuid,uuid,text,text)'
  ) IS NULL THEN
    RAISE NOTICE
      '20260806223000: public.owner_decide_fraud_review_case does not exist; no function changes applied.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'target_type'
      AND data_type = 'text'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'owner_audit_log.target_type text NOT NULL is required.'
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
    RAISE EXCEPTION 'owner_audit_log.target_id uuid is required.'
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
    RAISE EXCEPTION 'owner_audit_log.target_name text is required.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owner_audit_log'
      AND column_name = 'metadata'
      AND udt_name = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'owner_audit_log.metadata jsonb is required.'
      USING ERRCODE = '23514';
  END IF;

  EXECUTE $FUNCTION$
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
    AS $body$
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
          v_case.status,
          p_reason,
          jsonb_build_object(
            'fraud_case_id', v_case.id,
            'subject_user_id', v_case.subject_user_id,
            'onboarding_application_id', v_case.onboarding_application_id,
            'no_state_change', true
          )
        );

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
    $body$
  $FUNCTION$;

  EXECUTE $REVOKE_PUBLIC$
    REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) FROM PUBLIC
  $REVOKE_PUBLIC$;

  EXECUTE $REVOKE_AUTHENTICATED$
    REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) FROM authenticated
  $REVOKE_AUTHENTICATED$;

  EXECUTE $REVOKE_ANON$
    REVOKE ALL ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) FROM anon
  $REVOKE_ANON$;

  EXECUTE $GRANT_SERVICE_ROLE$
    GRANT EXECUTE ON FUNCTION public.owner_decide_fraud_review_case(uuid, uuid, text, text) TO service_role
  $GRANT_SERVICE_ROLE$;

  RAISE NOTICE
    '20260806223000: repeated successful fraud actions now create an explicit no-state-change audit record.';
END;
$migration$;

COMMIT;

NOTIFY pgrst, 'reload schema';
