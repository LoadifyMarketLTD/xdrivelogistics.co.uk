-- XD-AUD-0008: finish the canonical membership authority contract.
-- Preserve all legacy records and override references. Never promote legacy-only
-- rows or copy legacy roles into company_memberships.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.has_capability(_company_id uuid, _capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  WITH actor AS (
    SELECT public.active_company_membership_role(_company_id, auth.uid()) AS canonical_role
    WHERE auth.uid() IS NOT NULL
  ),
  role_allow AS (
    SELECT EXISTS (
      SELECT 1 FROM public.company_role_capabilities crc, actor a
      WHERE crc.company_role = a.canonical_role AND crc.capability_key = _capability
    ) AS permitted
  ),
  override_decision AS (
    SELECT
      bool_or(mco.is_allowed IS FALSE) AS denied,
      bool_or(mco.is_allowed IS TRUE AND cm.company_role = a.canonical_role) AS allowed
    FROM public.company_members cm
    JOIN public.member_capability_overrides mco ON mco.company_member_id = cm.id
    CROSS JOIN actor a
    WHERE cm.company_id = _company_id AND cm.user_id = auth.uid()
      AND cm.is_active IS TRUE AND mco.capability_key = _capability
  )
  SELECT COALESCE((
    SELECT a.canonical_role IS NOT NULL
      AND NOT COALESCE(o.denied, false)
      AND (r.permitted OR COALESCE(o.allowed, false))
    FROM actor a CROSS JOIN role_allow r CROSS JOIN override_decision o
  ), false);
$function$;

REVOKE ALL ON FUNCTION public.has_capability(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text) TO authenticated, service_role;

-- Keep historical RPC names and existing grants, but use canonical authority.
-- Optional on fresh installations that do not contain these legacy RPCs.
DO $migration$
BEGIN
  IF to_regprocedure('public.is_company_admin_of(uuid,uuid)') IS NOT NULL THEN
    EXECUTE $ddl$
      CREATE OR REPLACE FUNCTION public.is_company_admin_of(uid uuid, company uuid)
      RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
      SET search_path = pg_catalog, public
      AS $body$
        SELECT COALESCE(public.active_company_membership_role(company, uid) IN ('owner', 'admin'), false);
      $body$
    $ddl$;
    REVOKE ALL ON FUNCTION public.is_company_admin_of(uuid, uuid) FROM PUBLIC, anon;
  END IF;
  IF to_regprocedure('public.is_company_members_admin(uuid)') IS NOT NULL THEN
    EXECUTE $ddl$
      CREATE OR REPLACE FUNCTION public.is_company_members_admin(p_company_id uuid)
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
      SET search_path = pg_catalog, public
      AS $body$
        SELECT COALESCE(public.active_company_membership_role(p_company_id, auth.uid()) IN ('owner', 'admin'), false);
      $body$
    $ddl$;
    REVOKE ALL ON FUNCTION public.is_company_members_admin(uuid) FROM PUBLIC, anon, authenticated;
  END IF;
END;
$migration$;

COMMIT;
NOTIFY pgrst, 'reload schema';
