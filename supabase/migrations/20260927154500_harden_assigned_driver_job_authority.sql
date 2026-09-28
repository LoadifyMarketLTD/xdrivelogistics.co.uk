BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Assigned-driver RLS helpers previously checked only driver status/app_access.
-- A suspended company, inactive profile, or inactive company membership must
-- not keep job read/update authority through an old driver assignment.
CREATE OR REPLACE FUNCTION public.can_driver_access_job(jid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.drivers d
      ON d.id = j.assigned_driver_id
    JOIN public.profiles p
      ON p.user_id = d.user_id
    JOIN public.companies c
      ON c.id = d.company_id
    JOIN public.company_memberships cm
      ON cm.user_id = d.user_id
     AND cm.company_id = d.company_id
    WHERE j.id = jid
      AND d.user_id = auth.uid()
      AND COALESCE(d.app_access, true) = true
      AND COALESCE(d.status::text, '') = 'active'
      AND COALESCE(p.status::text, '') = 'active'
      AND c.status::text = 'active'
      AND cm.status::text = 'active'
      AND (
        j.company_id = d.company_id
        OR j.assigned_company_id = d.company_id
        OR j.awarded_carrier_company_id = d.company_id
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_driver_update_job(jid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT public.can_driver_access_job(jid);
$function$;

REVOKE ALL ON FUNCTION public.can_driver_access_job(uuid)
FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_driver_update_job(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_driver_access_job(uuid)
TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_driver_update_job(uuid)
TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
