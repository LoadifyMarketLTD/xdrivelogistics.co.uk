BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS invoices_delete_member ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_authenticated ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_member ON public.invoices;
DROP POLICY IF EXISTS invoices_select_authenticated ON public.invoices;
DROP POLICY IF EXISTS invoices_select_member ON public.invoices;
DROP POLICY IF EXISTS invoices_update_authenticated ON public.invoices;
DROP POLICY IF EXISTS invoices_update_member ON public.invoices;
DROP POLICY IF EXISTS companies_update_member ON public.companies;
DROP POLICY IF EXISTS jobs_insert_authenticated ON public.jobs;
DROP POLICY IF EXISTS jobs_update_authenticated ON public.jobs;
DROP POLICY IF EXISTS vehicles_insert_authenticated ON public.vehicles;
DROP POLICY IF EXISTS vehicles_update_authenticated ON public.vehicles;
DROP POLICY IF EXISTS onboarding_insert_own ON public.onboarding_applications;
DROP POLICY IF EXISTS onboarding_update_own_limited ON public.onboarding_applications;

DO $$
DECLARE
  v_remaining integer;
BEGIN
  SELECT count(*)
  INTO v_remaining
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (tablename = 'invoices' AND policyname = ANY (ARRAY[
        'invoices_delete_member',
        'invoices_insert_authenticated',
        'invoices_insert_member',
        'invoices_select_authenticated',
        'invoices_select_member',
        'invoices_update_authenticated',
        'invoices_update_member'
      ]::text[]))
      OR (tablename = 'companies' AND policyname = 'companies_update_member')
      OR (tablename = 'jobs' AND policyname = ANY (ARRAY[
        'jobs_insert_authenticated',
        'jobs_update_authenticated'
      ]::text[]))
      OR (tablename = 'vehicles' AND policyname = ANY (ARRAY[
        'vehicles_insert_authenticated',
        'vehicles_update_authenticated'
      ]::text[]))
      OR (tablename = 'onboarding_applications' AND policyname = ANY (ARRAY[
        'onboarding_insert_own',
        'onboarding_update_own_limited'
      ]::text[]))
    );

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION 'Broad hosted RLS drift policies remain after cleanup: %', v_remaining;
  END IF;
END;
$$;

COMMIT;;
