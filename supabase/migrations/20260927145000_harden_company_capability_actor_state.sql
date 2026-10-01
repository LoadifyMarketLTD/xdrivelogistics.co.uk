BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- has_capability() is used by company RLS. Fresh databases do not contain the
-- hosted-only company_role_capabilities/member_capability_overrides tables at
-- this point in history, so reproduce the hosted default role/capability map
-- directly while binding authority to canonical active membership state.
CREATE OR REPLACE FUNCTION public.has_capability(
  _company_id uuid,
  _capability text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  WITH me AS (
    SELECT cm.role_in_company::text AS company_role
    FROM public.company_memberships cm
    JOIN public.companies c
      ON c.id = cm.company_id
    JOIN public.profiles p
      ON p.user_id = cm.user_id
    WHERE cm.company_id = _company_id
      AND cm.user_id = auth.uid()
      AND COALESCE(cm.status::text, '') = 'active'
      AND COALESCE(c.status::text, '') = 'active'
      AND COALESCE(p.status::text, '') = 'active'
    LIMIT 1
  )
  SELECT EXISTS (
    SELECT 1
    FROM me
    WHERE (company_role, _capability) IN (
      ('admin', 'company.manage_members'),
      ('admin', 'jobs.create'),
      ('admin', 'jobs.track'),
      ('broker_admin', 'jobs.create'),
      ('dispatcher', 'jobs.allocate'),
      ('dispatcher', 'jobs.track'),
      ('driver', 'jobs.update_driver_status'),
      ('owner', 'company.manage_members'),
      ('owner', 'company.manage_settings'),
      ('owner', 'jobs.create'),
      ('viewer', 'loads.view_own')
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.has_capability(uuid, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text)
TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
