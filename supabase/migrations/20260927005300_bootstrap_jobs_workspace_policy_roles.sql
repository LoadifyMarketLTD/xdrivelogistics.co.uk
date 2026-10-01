BEGIN;

-- Older baseline migrations created these policies for PUBLIC. Hosted XDrive
-- already has the least-privilege authenticated-only variants that the next
-- reconciliation audit expects. Reproduce that catalog state on fresh builds.
DROP POLICY IF EXISTS jobs_select_assigned_driver ON public.jobs;
CREATE POLICY jobs_select_assigned_driver
  ON public.jobs
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.can_driver_access_job(id));

DROP POLICY IF EXISTS jobs_select_non_driver ON public.jobs;
CREATE POLICY jobs_select_non_driver
  ON public.jobs
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (public.is_company_non_driver(company_id));

COMMIT;