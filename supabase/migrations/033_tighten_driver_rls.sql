-- Migration 033: Tighten RLS — restrict drivers to own-assigned jobs only
--
-- Audit finding: jobs_all_member, invoices_all_member, quotes_all_member
-- grant ALL (SELECT/INSERT/UPDATE/DELETE) to all company members, which
-- includes drivers. Drivers should only be able to:
--   - SELECT jobs where assigned_driver_id = their driver.id
--   - UPDATE jobs where assigned_driver_id = their driver.id (status changes)
-- Drivers must NOT access invoices or quotes at all.
--
-- Fix: add an is_company_non_driver() helper and tighten the three policies.
-- Migration 029 already has correct driver-specific job policies that remain.

BEGIN;

-- =========================================================================
-- 1. Helper: returns true if the current user is a company member but NOT
--    a driver role (i.e. owner, admin, company, customer, etc.)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_company_non_driver(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    JOIN public.profiles p ON p.user_id = auth.uid()
    WHERE cm.company_id = cid
      AND cm.user_id    = auth.uid()
      AND cm.status    <> 'suspended'
      AND p.role       <> 'driver'
  );
$$;

-- =========================================================================
-- 2. Jobs: restrict jobs_all_member to non-driver members
--    Driver access remains via jobs_select_assigned_driver +
--    jobs_update_assigned_driver (migration 029).
-- =========================================================================

DO $$
BEGIN
  -- Drop and recreate only if policy exists to remain idempotent
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs'
      AND policyname = 'jobs_all_member'
  ) THEN
    DROP POLICY "jobs_all_member" ON public.jobs;
  END IF;

  CREATE POLICY "jobs_all_member" ON public.jobs
    FOR ALL
    USING (public.is_company_non_driver(company_id))
    WITH CHECK (public.is_company_non_driver(company_id));
END $$;

-- =========================================================================
-- 3. Invoices: restrict to non-driver members
-- =========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices'
      AND policyname = 'invoices_all_member'
  ) THEN
    DROP POLICY "invoices_all_member" ON public.invoices;
  END IF;

  CREATE POLICY "invoices_all_member" ON public.invoices
    FOR ALL
    USING (public.is_company_non_driver(company_id))
    WITH CHECK (public.is_company_non_driver(company_id));
END $$;

-- =========================================================================
-- 4. Quotes: restrict to non-driver members
-- =========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quotes'
      AND policyname = 'quotes_all_member'
  ) THEN
    DROP POLICY "quotes_all_member" ON public.quotes;
  END IF;

  CREATE POLICY "quotes_all_member" ON public.quotes
    FOR ALL
    USING (public.is_company_non_driver(company_id))
    WITH CHECK (public.is_company_non_driver(company_id));
END $$;

-- =========================================================================
-- 5. Job documents / notes / tracking — restrict to non-driver members
--    (drivers see job details through the job row itself via 029 policy)
-- =========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_documents'
      AND policyname = 'job_documents_all_member'
  ) THEN
    DROP POLICY "job_documents_all_member" ON public.job_documents;
  END IF;

  CREATE POLICY "job_documents_all_member" ON public.job_documents
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = job_id
          AND public.is_company_non_driver(j.company_id)
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = job_id
          AND public.is_company_non_driver(j.company_id)
      )
    );
END $$;

COMMIT;
