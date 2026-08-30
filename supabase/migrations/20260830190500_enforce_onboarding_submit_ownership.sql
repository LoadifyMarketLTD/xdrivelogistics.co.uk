BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- P0-07: authenticated callers may submit only their own onboarding application.
-- The existing wrapper is SECURITY DEFINER and intentionally remains callable by
-- authenticated + service_role, but it must bind the target application to the
-- JWT actor before invoking the private base implementation.
CREATE OR REPLACE FUNCTION public.submit_onboarding_application(p_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
  v_caller_role text := COALESCE(auth.role(), '');
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

  -- Client authority is strictly self-scoped. Server-side service_role callers
  -- remain able to submit a validated target application on behalf of a user.
  IF v_caller_role <> 'service_role' THEN
    IF v_actor_user_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF v_app.user_id IS DISTINCT FROM v_actor_user_id THEN
      RAISE EXCEPTION 'Onboarding application access denied.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Preserve all existing submission side effects in the private implementation.
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
    PERFORM public.review_onboarding_application_atomic(
      p_application_id,
      v_app.user_id,
      'approve',
      v_auto_reason
    );

    UPDATE public.onboarding_applications
    SET reviewed_by = NULL,
        review_notes = v_auto_reason,
        last_activity_at = now()
    WHERE id = p_application_id;
  END IF;

  RETURN v_company_id;
END;
$$;

-- The preserved base implementation is private implementation detail only.
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM service_role;

REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid) TO authenticated, service_role;

DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.submit_onboarding_application(uuid)'::regprocedure)
  INTO v_definition;

  IF v_definition NOT ILIKE '%v_actor_user_id uuid := auth.uid()%'
     OR v_definition NOT ILIKE '%v_caller_role text := COALESCE(auth.role(), '''')%'
     OR v_definition NOT ILIKE '%v_app.user_id IS DISTINCT FROM v_actor_user_id%'
     OR v_definition NOT ILIKE '%Onboarding application access denied.%' THEN
    RAISE EXCEPTION 'Onboarding submission ownership guard is missing from the canonical wrapper.';
  END IF;

  IF has_function_privilege('anon', 'public.submit_onboarding_application(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute submit_onboarding_application(uuid).';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.submit_onboarding_application(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.submit_onboarding_application(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Canonical onboarding submit wrapper ACL is incomplete.';
  END IF;

  IF has_function_privilege('anon', 'public.submit_onboarding_application_base_v1(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.submit_onboarding_application_base_v1(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.submit_onboarding_application_base_v1(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Private onboarding submit base implementation remains externally executable.';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
