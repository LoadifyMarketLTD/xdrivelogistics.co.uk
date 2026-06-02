-- 067_rls_role_matrix_company_and_owner_driver.sql
-- Align helper role checks for member role and owner-driver workspace ownership.

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
    JOIN public.profiles p ON p.user_id = cm.user_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
      AND (p.role <> 'driver' OR cm.role_in_company = 'owner')
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
    JOIN public.profiles p ON p.user_id = cm.user_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
      AND cm.role_in_company IN ('owner', 'admin', 'dispatcher')
      AND (p.role <> 'driver' OR cm.role_in_company = 'owner')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_non_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid) TO authenticated;

DROP POLICY IF EXISTS jobs_exchange_select_policy ON public.jobs;

CREATE POLICY jobs_exchange_select_policy ON public.jobs
  FOR SELECT
  USING (
    exchange_visibility = 'exchange'
    AND status = 'posted'
    AND (
      EXISTS (
        SELECT 1
        FROM public.company_memberships cm
        WHERE cm.user_id = auth.uid()
          AND cm.status <> 'suspended'
          AND cm.role_in_company IN ('owner', 'admin', 'dispatcher', 'member', 'viewer')
      )
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.role IN ('owner', 'broker')
      )
    )
  );

NOTIFY pgrst, 'reload schema';
