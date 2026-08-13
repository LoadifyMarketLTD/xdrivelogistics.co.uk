-- Canonical company-membership authorization boundary.
--
-- XDrive's authoritative company relationship is public.company_memberships.
-- public.company_members is legacy compatibility state and must not grant
-- company, invite, capability, or operator privileges.
--
-- This migration:
--   * repairs canonical membership helpers against live schema drift;
--   * preserves existing function input parameter names where PostgreSQL requires it;
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
-- 1. Restore the canonical membership foundation.
--
-- Live drift was observed where:
--   * has_active_company_membership(uuid, uuid) was missing;
--   * active_company_membership_role(uuid, uuid) was PUBLIC executable;
--   * is_company_member(uuid) / is_company_admin(uuid) accepted non-active
--     membership states through legacy "<> suspended" logic.
--
-- PostgreSQL does not allow CREATE OR REPLACE FUNCTION to rename an existing
-- input parameter. Older XDrive migrations can leave is_company_member/admin
-- using either "cid" or "_company_id". The adaptive block below preserves the
-- currently installed parameter name and uses positional $1 in the function body.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_active_company_membership(
  p_company_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_company_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND EXISTS (
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
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

DO $outer$
DECLARE
  v_param text;
BEGIN
  -- is_company_member(uuid): preserve the installed input parameter name.
  SELECT p.proargnames[1]
    INTO v_param
    FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.is_company_member(uuid)');

  IF NOT FOUND OR v_param IS NULL THEN
    v_param := 'cid';
  END IF;

  EXECUTE format(
    $ddl$
      CREATE OR REPLACE FUNCTION public.is_company_member(%I uuid)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $fn$
        SELECT public.has_active_company_membership($1, auth.uid());
      $fn$;
    $ddl$,
    v_param
  );

  -- is_company_admin(uuid): preserve the installed input parameter name.
  SELECT p.proargnames[1]
    INTO v_param
    FROM pg_proc p
   WHERE p.oid = to_regprocedure('public.is_company_admin(uuid)');

  IF NOT FOUND OR v_param IS NULL THEN
    v_param := 'cid';
  END IF;

  EXECUTE format(
    $ddl$
      CREATE OR REPLACE FUNCTION public.is_company_admin(%I uuid)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $fn$
        SELECT $1 IS NOT NULL
          AND COALESCE(
            public.active_company_membership_role($1, auth.uid()) IN ('owner', 'admin'),
            false
          );
      $fn$;
    $ddl$,
    v_param
  );
END $outer$;

REVOKE ALL ON FUNCTION public.has_active_company_membership(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.active_company_membership_role(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_admin(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_active_company_membership(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.active_company_membership_role(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Canonical compatibility helpers.
--    Keep legacy function names only for compatibility with older callers; the
--    authorization source is company_memberships exclusively.
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
      OR COALESCE(
        public.active_company_membership_role(_company_id, auth.uid()) IN ('owner', 'admin'),
        false
      )
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
    AND COALESCE(
      public.active_company_membership_role(company, uid) IN ('owner', 'admin'),
      false
    );
$$;

CREATE OR REPLACE FUNCTION public.is_company_members_admin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    public.active_company_membership_role(p_company_id, auth.uid()) IN ('owner', 'admin'),
    false
  );
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
-- 3. Companies UPDATE: remove legacy company_members authorization.
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
-- 4. Legacy invites table: admin authorization must use canonical membership.
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
-- 5. Workspace audit visibility: no legacy membership lookup.
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

COMMENT ON FUNCTION public.has_active_company_membership(uuid, uuid) IS
  'Canonical active company-membership predicate. Requires active membership and active company.';
COMMENT ON FUNCTION public.active_company_membership_role(uuid, uuid) IS
  'Returns the active canonical company role from company_memberships, or NULL.';
COMMENT ON FUNCTION public.is_company_member(uuid) IS
  'Canonical company membership predicate backed only by active company_memberships.';
COMMENT ON FUNCTION public.is_company_admin(uuid) IS
  'Canonical owner/admin predicate backed only by active company_memberships.';
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