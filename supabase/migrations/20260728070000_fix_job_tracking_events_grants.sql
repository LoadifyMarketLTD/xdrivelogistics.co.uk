-- Migration: fix job_tracking_events table grants
--
-- job_tracking_events has RLS enabled and per-command policies defined in
-- migrations 034_least_privilege_operational_rls and
-- 038_runtime_operational_rls_backstop, but the authenticated role was never
-- granted object-level privileges on the table.  Without these GRANTs
-- PostgreSQL returns "permission denied for table job_tracking_events" before
-- RLS policies are evaluated.
--
-- Root cause: the same class of missing-grant defect fixed for loads
-- (20260727190000) and job_disputes (20260728060000).
--
-- Security model preserved:
--   - SELECT is gated by "job_tracking_select_non_driver" policy which calls
--     can_non_driver_access_job(job_id) → joins jobs and asserts the caller is
--     a non-driver member of the owning company.
--   - INSERT/UPDATE/DELETE are additionally restricted to row creator or
--     company admin by the per-command policies.
--   - Cross-tenant rows remain invisible: a caller cannot satisfy
--     is_company_non_driver for a company they do not belong to.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_tracking_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_tracking_events TO service_role;

-- Explicit EXECUTE grants on the two helper functions used in the RLS
-- policies.  In standard PostgreSQL, EXECUTE is granted to PUBLIC by default,
-- but the repository pattern (migrations 040, 041, 044) explicitly re-grants
-- to authenticated for clarity and defence-in-depth.
GRANT EXECUTE ON FUNCTION public.can_non_driver_access_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_admin_manage_job(uuid) TO authenticated;

-- Add the table to the Supabase Realtime publication so that the Operations
-- Centre live-refresh subscription receives postgres_changes events.
-- Wrapped in a DO block to be safe if the publication is already configured
-- for all tables or the table was added manually.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.job_tracking_events;
EXCEPTION WHEN others THEN
  -- publication may already include this table or be configured FOR ALL TABLES
  NULL;
END;
$$;
