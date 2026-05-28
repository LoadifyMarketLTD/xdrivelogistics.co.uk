-- Migration 044: Runtime guard for legacy role/email drift + driver jobs RLS
--
-- Purpose:
-- 1) Keep runtime resilient when older environments still miss companies.email
--    or still have helpers compiled against cm.role instead of role_in_company.
-- 2) Restore explicit driver access to assigned jobs (SELECT/UPDATE) to prevent
--    false 403 responses in /driver/jobs flows while preserving company isolation.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Schema guard: companies.email (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email text;

-- ---------------------------------------------------------------------------
-- 2) Adaptive helper function repairs (avoids 42P13 param rename errors)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  arg_name text;
BEGIN
  -- is_company_admin
  SELECT COALESCE(p.proargnames[1], 'cid')
    INTO arg_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'is_company_admin'
   ORDER BY p.oid DESC
   LIMIT 1;

  arg_name := COALESCE(arg_name, 'cid');

  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.is_company_admin(%I uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    AS $body$
      SELECT EXISTS (
        SELECT 1
          FROM public.company_memberships cm
         WHERE cm.company_id = %I
           AND cm.user_id = auth.uid()
           AND cm.status <> 'suspended'
           AND cm.role_in_company IN ('owner', 'admin')
      );
    $body$;
  $fn$, arg_name, arg_name);
END $$;

DO $$
DECLARE
  arg_name text;
BEGIN
  -- is_company_non_driver
  SELECT COALESCE(p.proargnames[1], 'cid')
    INTO arg_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'is_company_non_driver'
   ORDER BY p.oid DESC
   LIMIT 1;

  arg_name := COALESCE(arg_name, 'cid');

  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.is_company_non_driver(%I uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    AS $body$
      SELECT EXISTS (
        SELECT 1
          FROM public.company_memberships cm
          JOIN public.profiles p
            ON p.user_id = auth.uid()
         WHERE cm.company_id = %I
           AND cm.user_id = auth.uid()
           AND cm.status <> 'suspended'
           AND COALESCE(p.role, '') <> 'driver'
      );
    $body$;
  $fn$, arg_name, arg_name);
END $$;

DO $$
DECLARE
  arg_name text;
BEGIN
  -- is_company_operator
  SELECT COALESCE(p.proargnames[1], 'cid')
    INTO arg_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'is_company_operator'
   ORDER BY p.oid DESC
   LIMIT 1;

  arg_name := COALESCE(arg_name, 'cid');

  EXECUTE format($fn$
    CREATE OR REPLACE FUNCTION public.is_company_operator(%I uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    AS $body$
      SELECT EXISTS (
        SELECT 1
          FROM public.company_memberships cm
          JOIN public.profiles p
            ON p.user_id = auth.uid()
         WHERE cm.company_id = %I
           AND cm.user_id = auth.uid()
           AND cm.status <> 'suspended'
           AND COALESCE(p.role, '') <> 'driver'
           AND cm.role_in_company <> 'viewer'
      );
    $body$;
  $fn$, arg_name, arg_name);
END $$;

-- ---------------------------------------------------------------------------
-- 3) Driver-assigned job helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_driver_access_job(jid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.jobs j
      JOIN public.drivers d
        ON d.id = j.assigned_driver_id
     WHERE j.id = jid
       AND d.user_id = auth.uid()
       AND COALESCE(d.app_access, true) = true
       AND COALESCE(d.status, 'active') = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_driver_update_job(jid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.jobs j
      JOIN public.drivers d
        ON d.id = j.assigned_driver_id
     WHERE j.id = jid
       AND d.user_id = auth.uid()
       AND COALESCE(d.app_access, true) = true
       AND COALESCE(d.status, 'active') = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- 4) Driver policies for assigned jobs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "jobs_select_assigned_driver" ON public.jobs;
CREATE POLICY "jobs_select_assigned_driver"
  ON public.jobs
  FOR SELECT
  USING (public.can_driver_access_job(id));

DROP POLICY IF EXISTS "jobs_update_assigned_driver" ON public.jobs;
CREATE POLICY "jobs_update_assigned_driver"
  ON public.jobs
  FOR UPDATE
  USING (public.can_driver_update_job(id))
  WITH CHECK (
    public.can_driver_update_job(id)
    AND assigned_driver_id = (
      SELECT d.id
        FROM public.drivers d
       WHERE d.user_id = auth.uid()
         AND COALESCE(d.app_access, true) = true
         AND COALESCE(d.status, 'active') = 'active'
       LIMIT 1
    )
  );

GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_non_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_driver_access_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_driver_update_job(uuid) TO authenticated;

COMMIT;
