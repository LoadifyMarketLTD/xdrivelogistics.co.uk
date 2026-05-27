-- Migration 046: Runtime backstop for schema cache drift + role helper/policy drift
--
-- Purpose:
-- 1) Reconcile missing-column runtime failures for companies.email/phone and
--    vehicle_documents.doc_type in older environments.
-- 2) Re-apply adaptive role helper repairs so RLS helpers never reference
--    legacy company_memberships.role.
-- 3) Backstop vehicles INSERT policy for valid operators/admins.
-- 4) Trigger PostgREST schema cache refresh after schema changes.

BEGIN;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.vehicle_documents
  ADD COLUMN IF NOT EXISTS doc_type text;

DO $$
DECLARE
  arg_name text;
BEGIN
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
          JOIN public.profiles p ON p.user_id = auth.uid()
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
          JOIN public.profiles p ON p.user_id = auth.uid()
         WHERE cm.company_id = %I
           AND cm.user_id = auth.uid()
           AND cm.status <> 'suspended'
           AND COALESCE(p.role, '') <> 'driver'
           AND cm.role_in_company <> 'viewer'
      );
    $body$;
  $fn$, arg_name, arg_name);
END $$;

DROP POLICY IF EXISTS "vehicles_insert_operator" ON public.vehicles;
CREATE POLICY "vehicles_insert_operator"
  ON public.vehicles
  FOR INSERT
  WITH CHECK (
    public.is_company_operator(company_id)
    OR public.is_company_admin(company_id)
  );

GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_non_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
