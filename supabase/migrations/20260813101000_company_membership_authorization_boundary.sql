-- Canonical company-membership authorization boundary.
--
-- XDrive's authoritative company relationship is public.company_memberships.
-- public.company_members is legacy compatibility state and must not grant
-- company, invite, capability, or operator privileges.
--
-- This migration:
--   * removes permissive company/invite policies backed by company_members;
--   * redefines legacy helper names against company_memberships only;
--   * allows Owner Driver operational authority from an active owner membership
--     even when profiles.role = 'driver';
--   * keeps Platform Owner authority separate through public.is_owner().
--
-- It intentionally does NOT delete/backfill/synchronise company_members and does
-- not modify Super Admin UI, production data, or company_memberships role values.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Canonical helpers. Keep legacy function names only for compatibility with
--    older callers; the authorization source is company_memberships exclusively.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_company_members(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT _company_id IS NOT NULL
    AND (
      public.is_owner(auth.uid())
      OR COALESCE(public.active_company_membership_role(_company_id, auth.uid()) IN ('owner', 'admin'), false)
    );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin_of(uid uuid, company uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT uid IS NOT NULL
    AND company IS NOT NULL
    AND COALESCE(public.active_company_membership_role(company, uid) IN ('owner', 'admin'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_company_members_admin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.active_company_membership_role(p_company_id, auth.uid()) IN ('owner', 'admin'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_company_operator(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT cid IS NOT NULL
    AND COALESCE(
      public.active_company_membership_role(cid, auth.uid()) IN ('owner', 'admin', 'dispatcher'),
      false
    );
$$;

-- Legacy capability tables remain available as a compatibility catalogue, but
-- membership identity is resolved only from company_memberships. Member-specific
-- overrides tied to legacy company_members rows are deliberately not authoritative.
CREATE OR REPLACE FUNCTION public.has_capability(_company_id uuid, _capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH membership AS (
    SELECT cm.role_in_company::text AS company_role
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = _company_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND c.status::text = 'active'
    LIMIT 1
  )
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM membership m
      JOIN public.company_role_capabilities crc
        ON crc.company_role = m.company_role
       AND crc.capability_key = _capability
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_company_members(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_admin_of(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_members_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_operator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_capability(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_manage_company_members(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_admin_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_members_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Companies UPDATE: remove legacy company_members authorization.
--    Ordinary company writes require canonical owner/admin membership. Platform
--    Owner keeps its existing separate global policy.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS companies_update_member ON public.companies;
DROP POLICY IF EXISTS companies_update_owner_or_admin_or_creator ON public.companies;
DROP POLICY IF EXISTS companies_update_canonical_owner_admin_v4 ON public.companies;

CREATE POLICY companies_update_canonical_owner_admin_v4
ON public.companies
FOR UPDATE
TO authenticated
USING (public.is_company_admin(id))
WITH CHECK (public.is_company_admin(id));

-- companies_update_settings may remain in the policy set: its has_capability()
-- helper is now backed only by company_memberships.

-- -----------------------------------------------------------------------------
-- 3. Legacy invites table: admin authorization must use canonical membership.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS invites_insert_company_admin ON public.invites;
DROP POLICY IF EXISTS invites_select_owner_or_company_admin ON public.invites;
DROP POLICY IF EXISTS invites_update_owner_or_company_admin ON public.invites;
DROP POLICY IF EXISTS invites_insert_canonical_admin_v4 ON public.invites;
DROP POLICY IF EXISTS invites_select_canonical_admin_v4 ON public.invites;
DROP POLICY IF EXISTS invites_update_canonical_admin_v4 ON public.invites;

CREATE POLICY invites_insert_canonical_admin_v4
ON public.invites
FOR INSERT
TO authenticated
WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY invites_select_canonical_admin_v4
ON public.invites
FOR SELECT
TO authenticated
USING (
  public.is_owner(auth.uid())
  OR public.is_company_admin(company_id)
);

CREATE POLICY invites_update_canonical_admin_v4
ON public.invites
FOR UPDATE
TO authenticated
USING (
  public.is_owner(auth.uid())
  OR public.is_company_admin(company_id)
)
WITH CHECK (
  public.is_owner(auth.uid())
  OR public.is_company_admin(company_id)
);

-- -----------------------------------------------------------------------------
-- 4. Workspace audit visibility: no legacy membership lookup.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS workspace_audit_select_company_member ON public.workspace_switch_audit;
DROP POLICY IF EXISTS workspace_audit_select_canonical_member_v4 ON public.workspace_switch_audit;

CREATE POLICY workspace_audit_select_canonical_member_v4
ON public.workspace_switch_audit
FOR SELECT
TO authenticated
USING (
  target_company_id IS NULL
  OR public.is_owner(auth.uid())
  OR public.is_company_member(target_company_id)
);

COMMENT ON FUNCTION public.can_manage_company_members(uuid) IS
  'Canonical member-management authorization using company_memberships; company_members is legacy only.';
COMMENT ON FUNCTION public.is_company_admin_of(uuid, uuid) IS
  'Canonical owner/admin predicate backed only by active company_memberships.';
COMMENT ON FUNCTION public.is_company_members_admin(uuid) IS
  'Compatibility helper whose authorization source is canonical company_memberships.';
COMMENT ON FUNCTION public.is_company_operator(uuid) IS
  'Canonical operational authority: active owner/admin/dispatcher membership. Owner Driver is not excluded by profile.role=driver.';
COMMENT ON FUNCTION public.has_capability(uuid, text) IS
  'Capability lookup using canonical company_memberships role plus the legacy capability catalogue; legacy member overrides are not authoritative.';

NOTIFY pgrst, 'reload schema';

COMMIT;
