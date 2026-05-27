-- Migration 040: runtime schema/function guard for legacy role/email drift
--
-- Purpose:
-- 1) Ensure public.companies.email exists for settings/admin company reads+writes.
-- 2) Normalize membership helper functions to role_in_company (not legacy role)
--    so runtime policies do not fail with "column cm.role does not exist".

BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email text;

-- PostgreSQL does not allow renaming parameters via CREATE OR REPLACE.
-- Production functions may already exist with a different parameter name.
-- DROP first (no CASCADE — RLS policies reference by name and are re-bound
-- automatically when the function is recreated with the same signature).

DROP FUNCTION IF EXISTS public.is_company_member(uuid);
DROP FUNCTION IF EXISTS public.is_company_admin(uuid);
DROP FUNCTION IF EXISTS public.is_company_non_driver(uuid);
DROP FUNCTION IF EXISTS public.is_company_operator(uuid);

CREATE FUNCTION public.is_company_member(_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.company_id = _company_id
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
  );
$$;

CREATE FUNCTION public.is_company_admin(_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.company_id = _company_id
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
      AND cm.role_in_company IN ('owner', 'admin')
  );
$$;

CREATE FUNCTION public.is_company_non_driver(_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.profiles p ON p.user_id = cm.user_id
    WHERE cm.company_id = _company_id
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
      AND p.role <> 'driver'
  );
$$;

CREATE FUNCTION public.is_company_operator(_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.profiles p ON p.user_id = cm.user_id
    WHERE cm.company_id = _company_id
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
