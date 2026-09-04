-- Go-live hardening: remove hosted-only permissive RLS drift that broadens
-- invoice, job, vehicle, onboarding and company mutations beyond the canonical
-- policies.
--
-- This migration only drops policy names that are present in the hosted database
-- but have no active source definition in the current repository and duplicate or
-- weaken narrower role-aware policies. It does not rewrite business rows, alter
-- table schemas, or replace canonical policies.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Invoice drift: these permissive policies broaden access beyond the canonical
-- non-driver/operator + customer-ready invoice policies and OR together with them.
DROP POLICY IF EXISTS invoices_delete_member ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_authenticated ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_member ON public.invoices;
DROP POLICY IF EXISTS invoices_select_authenticated ON public.invoices;
DROP POLICY IF EXISTS invoices_select_member ON public.invoices;
DROP POLICY IF EXISTS invoices_update_authenticated ON public.invoices;
DROP POLICY IF EXISTS invoices_update_member ON public.invoices;

-- Company drift: the legacy company_members-based member update policy allows
-- any active legacy member role to update the company row. Keep the narrower
-- owner/admin/creator/capability policies intact while removing this broad OR path.
DROP POLICY IF EXISTS companies_update_member ON public.companies;

-- Job drift: these hosted-only policies allow any active company membership to
-- create/update job rows. Canonical source already provides operator/admin job
-- mutation plus the separately constrained assigned-driver lifecycle path.
DROP POLICY IF EXISTS jobs_insert_authenticated ON public.jobs;
DROP POLICY IF EXISTS jobs_update_authenticated ON public.jobs;

-- Vehicle drift: these hosted-only policies allow any active company membership
-- to create/update vehicle rows. Preserve the narrower operator/admin and assigned
-- driver policies that already exist on the hosted project.
DROP POLICY IF EXISTS vehicles_insert_authenticated ON public.vehicles;
DROP POLICY IF EXISTS vehicles_update_authenticated ON public.vehicles;

-- Onboarding drift: canonical migration 107 limits applicants to draft / in-progress
-- / request-changes edits and uses column grants to keep review state server-owned.
-- These hosted-only permissive policies OR around that contract, allowing a user
-- to insert an under-review row or keep changing payload while already under review.
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

COMMIT;
