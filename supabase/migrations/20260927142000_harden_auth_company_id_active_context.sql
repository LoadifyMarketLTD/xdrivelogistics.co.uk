BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- auth_company_id() is referenced by multiple RLS and Storage policies.
-- The previous implementation trusted profiles.company_id alone, which can
-- outlive an active membership/company state. Resolve company context only
-- from a currently active profile + active membership + active company.
CREATE OR REPLACE FUNCTION public.auth_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT cm.company_id
  FROM public.company_memberships cm
  JOIN public.companies c
    ON c.id = cm.company_id
  JOIN public.profiles p
    ON p.user_id = cm.user_id
  WHERE cm.user_id = auth.uid()
    AND cm.status::text = 'active'
    AND c.status::text = 'active'
    AND COALESCE(p.status::text, '') = 'active'
    AND p.company_id = cm.company_id
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.auth_company_id()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_company_id()
TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
