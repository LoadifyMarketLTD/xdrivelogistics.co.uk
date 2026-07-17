-- Migration 042: Adaptive repair of is_company_* helper functions
--
-- Root cause of previous migration failures:
--   Migration 040 ran without a full transaction in production, partially
--   renaming is_company_member and is_company_admin to _company_id while
--   is_company_non_driver and is_company_operator kept their original cid param.
--   PostgreSQL 42P13 prevents CREATE OR REPLACE from renaming a parameter,
--   and DROP is blocked by 35+ dependent RLS policies.
--
-- Fix strategy:
--   For each function, read the CURRENT input parameter name from pg_catalog
--   and use that exact name in CREATE OR REPLACE — no rename, no policy churn.
--   Function bodies use $1 (positional) so the parameter name is cosmetic only.
--
-- This migration is fully idempotent and handles any live parameter-name state:
--   member / admin  → _company_id OR cid
--   non_driver / operator → cid OR _company_id
--
-- Also adds companies.email and vehicles.assigned_driver_id if absent.

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

-- ── 3. Adaptive function repair ───────────────────────────────────────────
--
-- Each block:
--   a) Reads current proargnames[1] from pg_proc.
--   b) Defaults if function absent (fresh DB) or has no named param.
--   c) Issues CREATE OR REPLACE with that exact name.
--   d) Body uses $1 so parameter name does not affect runtime behaviour.

DO $outer$
DECLARE
  v_param text;
BEGIN

  --------------------------------------------------------------------------
  -- is_company_member: any non-suspended member for this company
  --------------------------------------------------------------------------
  SELECT proargnames[1]
    INTO v_param
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'is_company_member';

  IF NOT FOUND OR v_param IS NULL THEN
    v_param := '_company_id';
  END IF;

  EXECUTE format(
    $q$
      CREATE OR REPLACE FUNCTION public.is_company_member(%I uuid)
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      AS $b$
        SELECT EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id = $1
            AND cm.user_id    = auth.uid()
            AND cm.status    <> 'suspended'
        );
      $b$;
    $q$,
    v_param
  );

  --------------------------------------------------------------------------
  -- is_company_admin: owner or admin role_in_company, non-suspended
  --------------------------------------------------------------------------
  SELECT proargnames[1]
    INTO v_param
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'is_company_admin';

  IF NOT FOUND OR v_param IS NULL THEN
    v_param := '_company_id';
  END IF;

  EXECUTE format(
    $q$
      CREATE OR REPLACE FUNCTION public.is_company_admin(%I uuid)
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      AS $b$
        SELECT EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id      = $1
            AND cm.user_id         = auth.uid()
            AND cm.status         <> 'suspended'
            AND cm.role_in_company IN ('owner', 'admin')
        );
      $b$;
    $q$,
    v_param
  );

  --------------------------------------------------------------------------
  -- is_company_non_driver: member whose profile role is not 'driver'
  --------------------------------------------------------------------------
  SELECT proargnames[1]
    INTO v_param
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'is_company_non_driver';

  IF NOT FOUND OR v_param IS NULL THEN
    v_param := 'cid';
  END IF;

  EXECUTE format(
    $q$
      CREATE OR REPLACE FUNCTION public.is_company_non_driver(%I uuid)
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      AS $b$
        SELECT EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          JOIN public.profiles p ON p.user_id = cm.user_id
          WHERE cm.company_id = $1
            AND cm.user_id    = auth.uid()
            AND cm.status    <> 'suspended'
            AND p.role       <> 'driver'
        );
      $b$;
    $q$,
    v_param
  );

  --------------------------------------------------------------------------
  -- is_company_operator: non-driver member with non-viewer role_in_company
  --------------------------------------------------------------------------
  SELECT proargnames[1]
    INTO v_param
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'is_company_operator';

  IF NOT FOUND OR v_param IS NULL THEN
    v_param := 'cid';
  END IF;

  EXECUTE format(
    $q$
      CREATE OR REPLACE FUNCTION public.is_company_operator(%I uuid)
      RETURNS boolean
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      AS $b$
        SELECT EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          JOIN public.profiles p ON p.user_id = cm.user_id
          WHERE cm.company_id       = $1
            AND cm.user_id          = auth.uid()
            AND cm.status          <> 'suspended'
            AND p.role             <> 'driver'
            AND cm.role_in_company <> 'viewer'
        );
      $b$;
    $q$,
    v_param
  );

END $outer$;

-- ── 4. Grants (by type, not parameter name — always valid) ────────────────
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_non_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid)   TO authenticated;

COMMIT;
