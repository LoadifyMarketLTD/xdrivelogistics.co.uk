-- ============================================================
-- 012_fix_is_company_member.sql
--
-- Incremental patch for databases that already have migration
-- 011_complete_schema_v2.sql applied.
--
-- Fixes job posting being silently blocked by RLS:
--   - is_company_member() required status = 'active' but new
--     users provisioned via get_or_create_company_for_user()
--     could still have 'invited' status in edge cases.
--   - The jobs_all_member policy uses is_company_member(), so
--     INSERT and UPDATE on jobs were rejected with a row-level
--     security error whenever status != 'active', causing job
--     status changes to revert on page refresh.
--
-- Fix: accept any non-suspended membership (invited, active)
--      in both is_company_member() and is_company_admin().
--
-- Note: 011_complete_schema_v2.sql already contains this fix
--       for fresh deployments; this file is for existing DBs.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE  company_id = cid
      AND  user_id    = auth.uid()
      AND  status    <> 'suspended'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE  company_id      = cid
      AND  user_id         = auth.uid()
      AND  status         <> 'suspended'
      AND  role_in_company IN ('owner', 'admin')
  );
$$;

COMMIT;
