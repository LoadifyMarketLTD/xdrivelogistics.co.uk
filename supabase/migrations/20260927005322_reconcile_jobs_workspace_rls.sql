-- P0: restore the canonical workspace isolation contract on public.jobs.
--
-- Production audit 2026-09-27 found catalog drift from the migration contract:
--   * jobs_preaward_marketplace_privacy_guard had become PERMISSIVE;
--   * a Production-only jobs_select_all_authenticated_drivers policy exposed
--     full jobs rows to every authenticated user with any driver identity;
--   * jobs_awarded_carrier_select was missing.
--
-- Marketplace discovery remains server-projected. Raw jobs rows are readable
-- only through the canonical company, assigned-driver or awarded-carrier paths.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Remove the Production-only broad driver read path. Assigned drivers already
-- have jobs_select_assigned_driver / can_driver_access_job(id).
DROP POLICY IF EXISTS jobs_select_all_authenticated_drivers ON public.jobs;
DROP POLICY IF EXISTS drivers_select_all_jobs ON public.jobs;

-- Recreate the privacy guard with the intended restrictive semantics. A
-- RESTRICTIVE policy is ANDed with the applicable permissive policy set, so a
-- Marketplace member cannot obtain a full pre-award execution row merely by
-- satisfying another permissive SELECT policy.
DROP POLICY IF EXISTS jobs_preaward_marketplace_privacy_guard ON public.jobs;
CREATE POLICY jobs_preaward_marketplace_privacy_guard
  ON public.jobs
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.can_read_marketplace_execution_job(id));

-- Restore the canonical winning-carrier read path. This is deliberately
-- company-scoped and only applies after awarded_carrier_company_id is set.
DROP POLICY IF EXISTS jobs_awarded_carrier_select ON public.jobs;
CREATE POLICY jobs_awarded_carrier_select
  ON public.jobs
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    awarded_carrier_company_id IS NOT NULL
    AND public.is_company_member(awarded_carrier_company_id)
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname IN ('jobs_select_all_authenticated_drivers', 'drivers_select_all_jobs')
  ) THEN
    RAISE EXCEPTION 'Broad authenticated-driver jobs SELECT policy remains.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_preaward_marketplace_privacy_guard'
      AND permissive = 'RESTRICTIVE'
      AND cmd = 'SELECT'
      AND 'authenticated' = ANY (roles)
  ) THEN
    RAISE EXCEPTION 'Restrictive Marketplace jobs privacy guard is missing or weakened.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_select_assigned_driver'
      AND cmd = 'SELECT'
      AND 'authenticated' = ANY (roles)
  ) THEN
    RAISE EXCEPTION 'Assigned-driver jobs SELECT policy is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_select_non_driver'
      AND cmd = 'SELECT'
      AND 'authenticated' = ANY (roles)
  ) THEN
    RAISE EXCEPTION 'Owning-company jobs SELECT policy is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_awarded_carrier_select'
      AND permissive = 'PERMISSIVE'
      AND cmd = 'SELECT'
      AND 'authenticated' = ANY (roles)
  ) THEN
    RAISE EXCEPTION 'Awarded-carrier jobs SELECT policy is missing.';
  END IF;
END;
$$;

COMMENT ON POLICY jobs_preaward_marketplace_privacy_guard ON public.jobs IS
  'RESTRICTIVE privacy boundary: pre-award Marketplace execution rows are never exposed by direct Data API SELECT.';
COMMENT ON POLICY jobs_awarded_carrier_select ON public.jobs IS
  'Winning carrier company members may read the full awarded job after award.';

NOTIFY pgrst, 'reload schema';

COMMIT;
