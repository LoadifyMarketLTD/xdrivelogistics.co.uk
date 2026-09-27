-- P0: invited memberships must not satisfy active workspace RLS helpers.
-- Historical migrations widened these helpers to status <> 'suspended', which
-- means an invited owner/admin can satisfy many company RLS policies.
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.is_company_member(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = _company_id
      AND cm.user_id = auth.uid()
      AND cm.status::text = 'active'
      AND c.status::text = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = _company_id
      AND cm.user_id = auth.uid()
      AND cm.status::text = 'active'
      AND cm.role_in_company::text IN ('owner', 'admin')
      AND c.status::text = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_operator(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.profiles p ON p.user_id = auth.uid()
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status::text = 'active'
      AND cm.role_in_company::text IN ('owner', 'admin', 'dispatcher')
      AND COALESCE(p.role, '') <> 'driver'
      AND c.status::text = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_non_driver(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.profiles p ON p.user_id = auth.uid()
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status::text = 'active'
      AND cm.role_in_company::text IN ('owner', 'admin', 'dispatcher', 'member')
      AND COALESCE(p.role, '') <> 'driver'
      AND c.status::text = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_company_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_company_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_company_operator(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_company_non_driver(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_non_driver(uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('is_company_member','is_company_admin','is_company_operator','is_company_non_driver')
      AND pg_get_functiondef(p.oid) ILIKE '%status <> ''suspended''%'
  ) THEN
    RAISE EXCEPTION 'Invited/suspended membership semantics still remain in canonical company helpers.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('is_company_member','is_company_admin','is_company_operator','is_company_non_driver')
      AND pg_get_functiondef(p.oid) NOT ILIKE '%status::text = ''active''%'
  ) THEN
    RAISE EXCEPTION 'Canonical company helper does not require an active membership.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
