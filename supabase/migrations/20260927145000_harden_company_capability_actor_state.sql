BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- has_capability() is used by the companies UPDATE RLS policy. Keep the
-- existing role/override model, but bind authority to the canonical active
-- company_memberships row, active actor profile and active company.
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
    SELECT cm.id, cm.role_in_company::text AS company_role
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
  ),
  role_allow AS (
    SELECT 1
    FROM me
    JOIN public.company_role_capabilities crc
      ON crc.company_role = me.company_role
     AND crc.capability_key = _capability
    LIMIT 1
  ),
  override_decision AS (
    SELECT mco.is_allowed
    FROM me
    JOIN public.member_capability_overrides mco
      ON mco.company_member_id = me.id
     AND mco.capability_key = _capability
    LIMIT 1
  )
  SELECT COALESCE(
    (SELECT is_allowed FROM override_decision),
    EXISTS (SELECT 1 FROM role_allow),
    false
  );
$function$;

REVOKE ALL ON FUNCTION public.has_capability(uuid, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text)
TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
