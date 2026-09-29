BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Driver presence must not survive suspension or loss of tenant membership.
CREATE OR REPLACE FUNCTION public.driver_go_online()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_driver_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'driver_go_online: not authenticated (auth.uid() is null)'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.id
  INTO v_profile_id
  FROM public.profiles p
  WHERE p.user_id = v_user_id
    AND COALESCE(p.status::text, '') = 'active'
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Driver profile is not active.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.drivers d
  SET
    is_active = true,
    availability_status = 'available',
    last_app_login = now(),
    updated_at = now()
  FROM public.companies c
  WHERE d.user_id = v_user_id
    AND c.id = d.company_id
    AND c.status::text = 'active'
    AND COALESCE(d.status::text, '') = 'active'
    AND COALESCE(d.app_access, false) = true
    AND EXISTS (
      SELECT 1
      FROM public.company_memberships cm
      WHERE cm.user_id = v_user_id
        AND cm.company_id = d.company_id
        AND cm.status::text = 'active'
    )
  RETURNING d.id INTO v_driver_id;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Driver account is not approved for active-company app access.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.driver_availability_slots s
  SET
    available = true,
    updated_at = now()
  WHERE s.driver_id = v_profile_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.driver_go_online()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_go_online()
TO authenticated, service_role;

-- Commercial quote authority must include active profile identity before the
-- deeper operational-eligibility contract is evaluated.
CREATE OR REPLACE FUNCTION public.can_authenticated_driver_quote(
  p_driver_id uuid,
  p_job_id uuid,
  p_company_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_ready boolean := false;
  v_driver_company_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR p_driver_id IS NULL
     OR p_job_id IS NULL
     OR p_company_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT d.company_id
  INTO v_driver_company_id
  FROM public.drivers d
  JOIN public.profiles p
    ON p.user_id = d.user_id
  WHERE d.id = p_driver_id
    AND d.user_id = auth.uid()
    AND COALESCE(p.status::text, '') = 'active';

  IF NOT FOUND OR v_driver_company_id IS DISTINCT FROM p_company_id THEN
    RETURN false;
  END IF;

  SELECT readiness.eligible
  INTO v_ready
  FROM public.driver_operational_eligibility(p_driver_id) readiness;

  RETURN COALESCE(v_ready, false)
    AND public.can_quote_marketplace_job(p_job_id, p_company_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.can_authenticated_driver_quote(uuid, uuid, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_authenticated_driver_quote(uuid, uuid, uuid)
TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
