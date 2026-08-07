BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- Preserve the existing submission implementation as a private base function.
-- The wrapper below keeps the public RPC name stable while applying the
-- company_approval_required policy in the same database transaction.
DO $$
BEGIN
  IF to_regprocedure('public.submit_onboarding_application_base_v1(uuid)') IS NULL THEN
    ALTER FUNCTION public.submit_onboarding_application(uuid)
      RENAME TO submit_onboarding_application_base_v1;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_onboarding_application(p_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app public.onboarding_applications%ROWTYPE;
  v_company_id uuid;
  v_setting_value text;
  v_setting_type text;
  v_auto_approve boolean := false;
  v_auto_reason text := 'Automatic approval: company_approval_required=false';
BEGIN
  SELECT *
  INTO v_app
  FROM public.onboarding_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Keep the original ownership/service-role checks and all existing submission
  -- side effects in the preserved base implementation.
  v_company_id := public.submit_onboarding_application_base_v1(p_application_id);

  -- Customer/shipper onboarding is already auto-approved by the canonical
  -- submit implementation. This policy only changes the manual-review path.
  IF v_app.account_type <> 'customer_shipper' THEN
    SELECT ps.value, ps.value_type
    INTO v_setting_value, v_setting_type
    FROM public.platform_settings ps
    WHERE ps.key = 'company_approval_required'
    LIMIT 1;

    -- Fail safe: only an explicit, correctly typed boolean false disables
    -- manual approval. Missing, malformed or unexpected values keep the
    -- application under review.
    v_auto_approve := FOUND
      AND lower(trim(COALESCE(v_setting_type, ''))) = 'boolean'
      AND lower(trim(COALESCE(v_setting_value, ''))) = 'false';
  END IF;

  IF v_auto_approve THEN
    -- Reuse the canonical atomic approval path so the company transition,
    -- governance audit record, membership update, driver approval side effects
    -- and approval notification all succeed or roll back together with submit.
    PERFORM public.review_onboarding_application_atomic(
      p_application_id,
      v_app.user_id,
      'approve',
      v_auto_reason
    );

    -- Automatic approval has no human reviewer. The requester remains recorded
    -- as the initiating actor in owner_audit_log, with the explicit automatic
    -- reason above, while reviewed_by remains reserved for human review.
    UPDATE public.onboarding_applications
    SET reviewed_by = NULL,
        review_notes = v_auto_reason,
        last_activity_at = now()
    WHERE id = p_application_id;
  END IF;

  RETURN v_company_id;
END;
$$;

-- Do not leave a callable bypass around the policy wrapper after renaming the
-- previous implementation. The SECURITY DEFINER wrapper can still invoke it.
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM service_role;

REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
