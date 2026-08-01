-- Migration 20260801091000 — Fix owner_audit_log target_type NOT NULL violation
--
-- Problem: target_type was added to owner_audit_log as NOT NULL (no DEFAULT),
-- but the following callers omit it:
--   • set_company_status_governance (migration 075)
--   • apply_marketplace_governance_action (migration 078)
--   • owner_review_compliance_document (migration 20260801080500)
--   • owner_decide_fraud_review_case (migration 20260730100000)
--
-- Fix:
--   1. Ensure target_type exists as NOT NULL with no DEFAULT.
--      An empty-string DEFAULT would silently hide future defective callers;
--      every caller must supply a meaningful semantic value.
--   2. Redefine all four DB functions to explicitly supply target_type.

BEGIN;

-- ── 1. Ensure target_type column exists as NOT NULL with no DEFAULT ──────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'owner_audit_log'
      AND column_name  = 'target_type'
  ) THEN
    ALTER TABLE public.owner_audit_log
      ADD COLUMN target_type text NOT NULL;
  ELSE
    -- Column exists — remove any DEFAULT so every caller is forced to supply
    -- a semantic value.  The four functions below all do so explicitly.
    ALTER TABLE public.owner_audit_log
      ALTER COLUMN target_type DROP DEFAULT;
  END IF;
END $$;

-- ── 2. set_company_status_governance (migration 075) ─────────────────────────
CREATE OR REPLACE FUNCTION public.set_company_status_governance(
  p_actor_user_id uuid,
  p_target_company_id uuid,
  p_action_type text,
  p_new_status text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (
  company_id uuid,
  old_status text,
  new_status text
)
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

-- ── 3. apply_marketplace_governance_action (migration 078) ───────────────────
CREATE OR REPLACE FUNCTION public.apply_marketplace_governance_action(
  p_actor_user_id uuid,
  p_job_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  status text,
  company_id uuid,
  exchange_visibility text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text := lower(trim(COALESCE(p_action, '')));
  v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'Marketplace governance action executed by owner.');
  v_current_status text;
  v_current_visibility text;
  v_company_id uuid;
  v_old_value text;
  v_new_value text;
  v_audit_action_type text;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_user_id is required for marketplace governance updates.'
      USING ERRCODE = '23502';
  END IF;

  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'job_id is required for marketplace governance updates.'
      USING ERRCODE = '23502';
  END IF;

  IF v_action NOT IN ('publish_to_exchange', 'hide_from_exchange', 'force_dispute', 'force_cancel') THEN
    RAISE EXCEPTION 'Invalid marketplace governance action: %', v_action
      USING ERRCODE = '23514';
  END IF;

  SELECT
    lower(trim(j.status::text)),
    lower(trim(j.exchange_visibility::text)),
    j.company_id
  INTO
    v_current_status,
    v_current_visibility,
    v_company_id
  FROM public.jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Marketplace job not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_action = 'publish_to_exchange' THEN
    IF v_current_status NOT IN ('draft', 'posted') THEN
      RAISE EXCEPTION 'Cannot publish job in "%" status to exchange.', v_current_status
        USING ERRCODE = '23514';
    END IF;
    IF v_current_visibility = 'exchange' THEN
      RAISE EXCEPTION 'Job is already visible on exchange.'
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.jobs
    SET exchange_visibility = 'exchange',
        exchange_posted_at = now()
    WHERE id = p_job_id;

    v_old_value := 'visibility:' || v_current_visibility;
    v_new_value := 'visibility:exchange';
    v_audit_action_type := 'marketplace_published';
  ELSIF v_action = 'hide_from_exchange' THEN
    IF v_current_visibility <> 'exchange' THEN
      RAISE EXCEPTION 'Job visibility is "%", not exchange.', v_current_visibility
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.jobs
    SET exchange_visibility = 'private'
    WHERE id = p_job_id;

    v_old_value := 'visibility:exchange';
    v_new_value := 'visibility:private';
    v_audit_action_type := 'marketplace_hidden';
  ELSIF v_action = 'force_dispute' THEN
    IF v_current_status NOT IN ('draft', 'posted', 'allocated', 'in_transit') THEN
      RAISE EXCEPTION 'Cannot change status from "%".', v_current_status
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.jobs
    SET status = 'disputed'
    WHERE id = p_job_id;

    v_old_value := v_current_status;
    v_new_value := 'disputed';
    v_audit_action_type := 'marketplace_job_disputed';
  ELSE
    IF v_current_status NOT IN ('draft', 'posted', 'allocated', 'in_transit') THEN
      RAISE EXCEPTION 'Cannot change status from "%".', v_current_status
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.jobs
    SET status = 'cancelled'
    WHERE id = p_job_id;

    v_old_value := v_current_status;
    v_new_value := 'cancelled';
    v_audit_action_type := 'marketplace_job_cancelled';
  END IF;

  INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_type,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    created_at
  )
  VALUES (
    p_actor_user_id,
    'job',
    v_company_id,
    v_audit_action_type,
    v_old_value,
    v_new_value,
    v_reason,
    now()
  );

  RETURN QUERY
  SELECT
    j.id,
    j.status::text,
    j.company_id,
    j.exchange_visibility::text
  FROM public.jobs j
  WHERE j.id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text) TO service_role;

-- ── 4. owner_review_compliance_document (migration 20260801080500) ───────────
CREATE OR REPLACE FUNCTION public.owner_review_compliance_document(
  p_actor_user_id uuid,
  p_document_family text,
  p_document_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (document_id uuid, old_status text, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table text;
  v_status_column text;
  v_reviewer_column text;
  v_reviewed_at_column text;
  v_reason_column text;
  v_old_status text;
  v_next_status text;
  v_reason text;
BEGIN
  IF p_document_family NOT IN ('driver', 'vehicle', 'company', 'identity') THEN
    RAISE EXCEPTION 'Unsupported document family.'
      USING ERRCODE = '23514';
  END IF;

  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Unsupported document review action.'
      USING ERRCODE = '23514';
  END IF;

  IF p_document_family = 'driver' THEN
    v_table := 'driver_documents';
    v_status_column := 'status';
    v_reviewer_column := 'verified_by';
    v_reviewed_at_column := 'verified_at';
    v_reason_column := 'rejection_reason';
    v_next_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;
  ELSIF p_document_family = 'vehicle' THEN
    v_table := 'vehicle_documents';
    v_status_column := 'status';
    v_reviewer_column := 'verified_by';
    v_reviewed_at_column := 'verified_at';
    v_reason_column := 'rejection_reason';
    v_next_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;
  ELSIF p_document_family = 'company' THEN
    v_table := 'company_documents';
    v_status_column := 'status';
    v_reviewer_column := 'reviewed_by';
    v_reviewed_at_column := 'reviewed_at';
    v_reason_column := 'review_notes';
    v_next_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;
  ELSE
    v_table := 'driver_identity_documents';
    v_status_column := 'verification_status';
    v_reviewer_column := 'reviewed_by';
    v_reviewed_at_column := 'reviewed_at';
    v_reason_column := 'review_notes';
    v_next_status := CASE WHEN p_action = 'approve' THEN 'verified' ELSE 'rejected' END;
  END IF;

  EXECUTE format(
    'SELECT %1$I FROM public.%2$I WHERE id = $1 FOR UPDATE',
    v_status_column,
    v_table
  )
  INTO v_old_status
  USING p_document_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0002';
  END IF;

  v_reason := CASE
    WHEN p_action = 'reject' THEN COALESCE(NULLIF(trim(p_reason), ''), 'Rejected by platform compliance review.')
    ELSE NULL
  END;

  EXECUTE format(
    'UPDATE public.%1$I
     SET %2$I = $2,
         %3$I = $3,
         %4$I = now(),
         %5$I = $4
     WHERE id = $1',
    v_table,
    v_status_column,
    v_reviewer_column,
    v_reviewed_at_column,
    v_reason_column
  )
  USING p_document_id, v_next_status, p_actor_user_id, v_reason;

  INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_type,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    metadata
  )
  VALUES (
    p_actor_user_id,
    p_document_family || '_document',
    NULL,
    CASE WHEN p_action = 'approve' THEN 'document_approved' ELSE 'document_rejected' END,
    v_old_status,
    v_next_status,
    COALESCE(NULLIF(trim(p_reason), ''), format('%s document %s %s by platform compliance.', p_document_family, p_document_id, v_next_status)),
    jsonb_build_object(
      'document_id', p_document_id,
      'document_family', p_document_family
    )
  );

  RETURN QUERY SELECT p_document_id, v_old_status, v_next_status;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_review_compliance_document(uuid, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_review_compliance_document(uuid, text, uuid, text, text) TO service_role;

-- ── 5. owner_decide_fraud_review_case (migration 20260730100000) ─────────────
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
