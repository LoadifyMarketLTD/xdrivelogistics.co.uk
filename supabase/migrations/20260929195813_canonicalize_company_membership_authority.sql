CREATE OR REPLACE FUNCTION public.can_manage_company_members(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    _company_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (
      COALESCE(public.active_company_membership_role(_company_id, auth.uid()) IN ('owner','admin'), false)
      OR EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE c.id = _company_id
          AND c.created_by = auth.uid()
          AND COALESCE(c.status::text, '') = 'active'
      )
      OR public.is_owner(auth.uid())
    );
$function$;

DROP POLICY IF EXISTS companies_update_owner_or_admin_or_creator ON public.companies;
CREATE POLICY companies_update_owner_or_admin_or_creator
ON public.companies
FOR UPDATE
TO authenticated
USING (
  public.is_owner(auth.uid())
  OR COALESCE(public.active_company_membership_role(id, auth.uid()) IN ('owner','admin'), false)
  OR created_by = auth.uid()
)
WITH CHECK (
  public.is_owner(auth.uid())
  OR COALESCE(public.active_company_membership_role(id, auth.uid()) IN ('owner','admin'), false)
  OR created_by = auth.uid()
);

-- The legacy invites table is absent from canonical fresh schemas. Preserve the
-- hosted-policy hardening only when that retired table is present.
DO $legacy_invites$
BEGIN
  IF to_regclass('public.invites') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS invites_insert_company_admin ON public.invites';
    EXECUTE $policy$
      CREATE POLICY invites_insert_company_admin
      ON public.invites
      FOR INSERT
      TO authenticated
      WITH CHECK (
        COALESCE(public.active_company_membership_role(company_id, auth.uid()) IN ('owner','admin'), false)
      )
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS invites_select_owner_or_company_admin ON public.invites';
    EXECUTE $policy$
      CREATE POLICY invites_select_owner_or_company_admin
      ON public.invites
      FOR SELECT
      TO authenticated
      USING (
        public.is_owner(auth.uid())
        OR COALESCE(public.active_company_membership_role(company_id, auth.uid()) IN ('owner','admin'), false)
      )
    $policy$;

    EXECUTE 'DROP POLICY IF EXISTS invites_update_owner_or_company_admin ON public.invites';
    EXECUTE $policy$
      CREATE POLICY invites_update_owner_or_company_admin
      ON public.invites
      FOR UPDATE
      TO authenticated
      USING (
        public.is_owner(auth.uid())
        OR COALESCE(public.active_company_membership_role(company_id, auth.uid()) IN ('owner','admin'), false)
      )
      WITH CHECK (
        public.is_owner(auth.uid())
        OR COALESCE(public.active_company_membership_role(company_id, auth.uid()) IN ('owner','admin'), false)
      )
    $policy$;
  END IF;
END;
$legacy_invites$;

-- workspace_switch_audit is also hosted-only on older histories.
DO $workspace_audit$
BEGIN
  IF to_regclass('public.workspace_switch_audit') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS workspace_audit_select_company_member ON public.workspace_switch_audit';
    EXECUTE $policy$
      CREATE POLICY workspace_audit_select_company_member
      ON public.workspace_switch_audit
      FOR SELECT
      TO authenticated
      USING (
        target_company_id IS NULL
        OR public.active_company_membership_role(target_company_id, auth.uid()) IS NOT NULL
      )
    $policy$;
  END IF;
END;
$workspace_audit$;