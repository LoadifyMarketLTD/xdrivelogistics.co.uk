-- Restore runtime RLS policies for company_memberships.
--
-- Production drift left company_memberships with RLS enabled but no policies,
-- so authenticated users could not resolve their active company context even
-- when a valid membership row existed.

ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_memberships TO service_role;

CREATE OR REPLACE FUNCTION public.is_company_creator(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = cid
      AND c.created_by = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_creator(uuid) TO authenticated;

DROP POLICY IF EXISTS memberships_select_member ON public.company_memberships;
DROP POLICY IF EXISTS memberships_select_own ON public.company_memberships;
DROP POLICY IF EXISTS memberships_select_own_or_admin ON public.company_memberships;
DROP POLICY IF EXISTS memberships_insert_admin ON public.company_memberships;
DROP POLICY IF EXISTS memberships_insert_creator ON public.company_memberships;
DROP POLICY IF EXISTS memberships_insert_creator_or_admin ON public.company_memberships;
DROP POLICY IF EXISTS memberships_update_admin ON public.company_memberships;
DROP POLICY IF EXISTS memberships_delete_admin ON public.company_memberships;

CREATE POLICY memberships_select_own_or_admin
  ON public.company_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_company_admin(company_id)
  );

CREATE POLICY memberships_insert_creator_or_admin
  ON public.company_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_company_admin(company_id)
    OR public.is_company_creator(company_id)
  );

CREATE POLICY memberships_update_admin
  ON public.company_memberships
  FOR UPDATE
  TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

CREATE POLICY memberships_delete_admin
  ON public.company_memberships
  FOR DELETE
  TO authenticated
  USING (public.is_company_admin(company_id));

NOTIFY pgrst, 'reload schema';
