-- Migration 040: runtime schema/function guard for legacy role/email drift
--
-- Purpose:
-- 1) Ensure public.companies.email exists for settings/admin company reads+writes.
-- 2) Normalize membership helper functions to role_in_company (not legacy role)
--    so runtime policies do not fail with "column cm.role does not exist".

BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email text;

-- Keep function signature unchanged and replace body in place so existing
-- RLS policies that depend on these helpers are not dropped.

CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
      AND cm.role_in_company IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_non_driver(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.profiles p ON p.user_id = cm.user_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
      AND p.role <> 'driver'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_operator(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.profiles p ON p.user_id = cm.user_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
      AND p.role <> 'driver'
      AND cm.role_in_company <> 'viewer'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_non_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid) TO authenticated;

COMMIT;
