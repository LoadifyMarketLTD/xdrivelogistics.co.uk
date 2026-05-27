-- Migration 041: Idempotent repair for 4 live runtime errors
--
-- Errors fixed:
--   1. "column cm.role does not exist" when loading jobs
--      → RLS helper functions still referenced cm.role instead of cm.role_in_company.
--        Re-create all four helpers with the correct column name.
--   2. "Could not find the 'email' column of 'companies' in the schema cache"
--      → companies.email was absent in production. Add it.
--   3. "Could not find the 'assigned_driver_id' column of 'vehicles' in the schema cache"
--      → vehicles.assigned_driver_id was absent in production. Add it.
--   4. "Unauthorized" when adding a driver
--      → Addressed on the frontend (session refresh before API call).
--        No DB change required for this item.
--
-- All statements are IF NOT EXISTS / CREATE OR REPLACE — safe to re-run.

BEGIN;

-- ── 1. companies.email ────────────────────────────────────────────────────
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email text;

-- ── 2. vehicles.assigned_driver_id ───────────────────────────────────────
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS assigned_driver_id uuid
    REFERENCES public.drivers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id
  ON public.vehicles (assigned_driver_id);

-- ── 3. Fix helper functions — use cm.role_in_company, not cm.role ─────────
--
-- PostgreSQL does not allow renaming parameters via CREATE OR REPLACE.
-- The existing production functions use the parameter name "_company_id"
-- whereas the new definitions use "cid".  We must DROP first to clear
-- the old signature, then CREATE with the correct body.
-- CASCADE is NOT used — we drop only the function itself; dependent RLS
-- policies reference it by name/signature which is preserved on re-create.

DROP FUNCTION IF EXISTS public.is_company_member(uuid);
DROP FUNCTION IF EXISTS public.is_company_admin(uuid);
DROP FUNCTION IF EXISTS public.is_company_non_driver(uuid);
DROP FUNCTION IF EXISTS public.is_company_operator(uuid);

--  is_company_member: any non-suspended membership for this company
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
      AND cm.user_id    = auth.uid()
      AND cm.status    <> 'suspended'
  );
$$;

--  is_company_admin: owner or admin role_in_company
CREATE FUNCTION public.is_company_admin(_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.company_id      = _company_id
      AND cm.user_id         = auth.uid()
      AND cm.status         <> 'suspended'
      AND cm.role_in_company IN ('owner', 'admin')
  );
$$;

--  is_company_non_driver: member whose profile role is not 'driver'
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
      AND cm.user_id    = auth.uid()
      AND cm.status    <> 'suspended'
      AND p.role       <> 'driver'
  );
$$;

--  is_company_operator: non-driver member with a non-viewer role_in_company
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
    WHERE cm.company_id        = _company_id
      AND cm.user_id           = auth.uid()
      AND cm.status           <> 'suspended'
      AND p.role              <> 'driver'
      AND cm.role_in_company  <> 'viewer'
  );
$$;

-- ── 4. Grants ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_non_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid)   TO authenticated;

COMMIT;
