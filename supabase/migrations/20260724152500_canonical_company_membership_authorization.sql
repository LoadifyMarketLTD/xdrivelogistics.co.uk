-- Canonical company membership authorization
--
-- company_memberships is the authoritative source for company membership.
-- This migration intentionally does not backfill or synchronize company_members,
-- and it does not mutate existing membership rows.

BEGIN;

CREATE OR REPLACE FUNCTION public.has_active_company_membership(
  p_company_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = p_company_id
      AND cm.user_id = p_user_id
      AND cm.status = 'active'
      AND c.status::text = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.active_company_membership_role(
  p_company_id uuid,
  p_user_id uuid
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT cm.role_in_company::text
  FROM public.company_memberships cm
  JOIN public.companies c ON c.id = cm.company_id
  WHERE cm.company_id = p_company_id
    AND cm.user_id = p_user_id
    AND cm.status = 'active'
    AND c.status::text = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.has_active_company_membership(cid, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    public.active_company_membership_role(cid, auth.uid()) IN ('owner', 'admin'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_non_driver(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    JOIN public.profiles p ON p.user_id = cm.user_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND c.status::text = 'active'
      AND p.role::text <> 'driver'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_operator(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    JOIN public.profiles p ON p.user_id = cm.user_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND c.status::text = 'active'
      AND p.role::text <> 'driver'
      AND cm.role_in_company::text IN ('owner', 'admin', 'dispatcher', 'member')
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_company_membership(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.active_company_membership_role(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_non_driver(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_operator(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_active_company_membership(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.active_company_membership_role(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_non_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid) TO authenticated;

COMMENT ON FUNCTION public.has_active_company_membership(uuid, uuid) IS
  'Canonical membership predicate backed exclusively by company_memberships.';
COMMENT ON FUNCTION public.active_company_membership_role(uuid, uuid) IS
  'Returns the active canonical company role from company_memberships, or NULL.';

NOTIFY pgrst, 'reload schema';

COMMIT;
