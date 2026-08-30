BEGIN;

-- P0-07: canonical onboarding submission authority/state-machine repair.
--
-- Historical drift introduced two defects in the same authority surface:
-- 1. the public one-argument SECURITY DEFINER wrapper was executable by
--    authenticated users but did not bind p_application_id to auth.uid();
-- 2. the preserved submit base still writes legacy status `submitted`, while
--    the canonical state machine removed that value in migration 102.
--
-- Keep the currently deployed one-argument wrapper service-role-only during the
-- web rollout, add an actor-bound canonical RPC, and normalize any legacy submit
-- state to canonical `under_review` before the table constraint is evaluated.

CREATE OR REPLACE FUNCTION public.normalize_onboarding_status_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('submitted', 'compliance_review', 'admin_approval') THEN
    NEW.status := 'under_review';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_onboarding_status_before_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_onboarding_status_before_write() FROM anon;
REVOKE ALL ON FUNCTION public.normalize_onboarding_status_before_write() FROM authenticated;

DROP TRIGGER IF EXISTS trg_normalize_onboarding_status_before_write
  ON public.onboarding_applications;
CREATE TRIGGER trg_normalize_onboarding_status_before_write
BEFORE INSERT OR UPDATE OF status
ON public.onboarding_applications
FOR EACH ROW
EXECUTE FUNCTION public.normalize_onboarding_status_before_write();

CREATE OR REPLACE FUNCTION public.submit_onboarding_application(
  p_application_id uuid,
  p_actor_user_id uuid
)
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
  IF p_application_id IS NULL OR p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Application id and actor user id are required.'
      USING ERRCODE = '23502';
  END IF;

  SELECT *
  INTO v_app
  FROM public.onboarding_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_app.user_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'Forbidden: onboarding application belongs to another user.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_actor_user_id) THEN
    RAISE EXCEPTION 'Onboarding actor does not exist.' USING ERRCODE = '42501';
  END IF;

  v_company_id := public.submit_onboarding_application_base_v1(p_application_id);

  IF v_app.account_type <> 'customer_shipper' THEN
    SELECT ps.value, ps.value_type
    INTO v_setting_value, v_setting_type
    FROM public.platform_settings ps
    WHERE ps.key = 'company_approval_required'
    LIMIT 1;

    v_auto_approve := FOUND
      AND lower(trim(COALESCE(v_setting_type, ''))) = 'boolean'
      AND lower(trim(COALESCE(v_setting_value, ''))) = 'false';
  END IF;

  IF v_auto_approve THEN
    PERFORM public.review_onboarding_application_atomic(
      p_application_id,
      p_actor_user_id,
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

-- The current deployed web server still calls the one-argument wrapper with the
-- service role. Remove all direct browser/authenticated execution immediately,
-- but keep service_role compatibility until the web code has moved to the
-- actor-bound two-argument RPC.
REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid, uuid) TO service_role;

-- Preserved base is private to its SECURITY DEFINER wrappers.
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid) FROM service_role;

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.submit_onboarding_application(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated still has direct one-argument onboarding submit authority.';
  END IF;

  IF has_function_privilege('authenticated', 'public.submit_onboarding_application(uuid,uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated still has direct actor-bound onboarding submit authority.';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.submit_onboarding_application(uuid,uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'Service role cannot execute canonical actor-bound onboarding submission.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
