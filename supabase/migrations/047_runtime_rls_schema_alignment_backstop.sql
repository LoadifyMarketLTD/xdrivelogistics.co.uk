-- Migration 047: Runtime schema + RLS alignment backstop
--
-- Purpose:
-- 1) Backstop missing vehicle_documents.file_path in drifted environments.
-- 2) Ensure companies INSERT works for authenticated users.
-- 3) Ensure company_settings INSERT/UPDATE works for company operators/admins.
-- 4) Ensure drivers INSERT/UPDATE works for company operators/admins.
-- 5) Refresh PostgREST schema cache.

BEGIN;

ALTER TABLE public.vehicle_documents
  ADD COLUMN IF NOT EXISTS file_path text;

DROP POLICY IF EXISTS "companies_insert_admin" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_authenticated" ON public.companies;
CREATE POLICY "companies_insert_authenticated"
  ON public.companies
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "company_settings_insert_admin" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_insert_operator" ON public.company_settings;
CREATE POLICY "company_settings_insert_operator"
  ON public.company_settings
  FOR INSERT
  WITH CHECK (
    public.is_company_operator(company_id)
    OR public.is_company_admin(company_id)
  );

DROP POLICY IF EXISTS "company_settings_update_admin" ON public.company_settings;
DROP POLICY IF EXISTS "company_settings_update_operator" ON public.company_settings;
CREATE POLICY "company_settings_update_operator"
  ON public.company_settings
  FOR UPDATE
  USING (
    public.is_company_operator(company_id)
    OR public.is_company_admin(company_id)
  )
  WITH CHECK (
    public.is_company_operator(company_id)
    OR public.is_company_admin(company_id)
  );

DROP POLICY IF EXISTS "drivers_insert_operator" ON public.drivers;
CREATE POLICY "drivers_insert_operator"
  ON public.drivers
  FOR INSERT
  WITH CHECK (
    public.is_company_operator(company_id)
    OR public.is_company_admin(company_id)
  );

DROP POLICY IF EXISTS "drivers_update_operator" ON public.drivers;
CREATE POLICY "drivers_update_operator"
  ON public.drivers
  FOR UPDATE
  USING (
    public.is_company_operator(company_id)
    OR public.is_company_admin(company_id)
  )
  WITH CHECK (
    public.is_company_operator(company_id)
    OR public.is_company_admin(company_id)
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
