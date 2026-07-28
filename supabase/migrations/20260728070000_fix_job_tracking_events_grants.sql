-- Migration: fix job_tracking_events table grants
--
-- Root cause
-- ----------
-- job_tracking_events has RLS enabled with per-command policies (migrations
-- 034_least_privilege_operational_rls, 038_runtime_operational_rls_backstop),
-- but the authenticated role was never granted object-level table privileges.
-- PostgreSQL returns "permission denied for table job_tracking_events" before
-- evaluating any RLS policy.  Same class of defect fixed for loads
-- (20260727190000) and job_disputes (20260728060000).
--
-- Privilege justification
-- -----------------------
-- authenticated: SELECT only.
--   All write paths that reference job_tracking_events in the codebase use the
--   service-role admin client:
--     - app/api/admin/jobs/[id]/transition/route.ts  → supabaseAdmin.insert()
--     - app/api/driver/mobile/_lib.ts                → supabaseAdmin.insert()
--   No browser-side (authenticated) code performs INSERT, UPDATE or DELETE on
--   this table, so those DML grants would be dead weight against the attack
--   surface without any operational benefit.
--
-- service_role: SELECT + INSERT + UPDATE + DELETE.
--   Server-side API routes insert tracking events on job status transitions and
--   driver mobile status updates (both via the service-role admin client).
--   Full DML is justified for current and anticipated admin-plane operations.
--
-- RLS enforcement
-- ---------------
-- SELECT is gated by "job_tracking_select_non_driver" which calls
-- can_non_driver_access_job(job_id).  That function joins jobs and asserts the
-- caller is a non-driver member of the owning company, so cross-tenant rows
-- are invisible to authenticated users.
--
-- Realtime
-- --------
-- Operations Centre (app/admin/operations-centre/page.tsx) subscribes to
-- postgres_changes on job_tracking_events via the anon/browser channel.
-- The table must be in the supabase_realtime publication for events to be
-- delivered; the subscription itself is further filtered by the SELECT RLS
-- policy so subscribers only receive rows their company owns.

-- Object-level privilege grants
GRANT SELECT ON public.job_tracking_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_tracking_events TO service_role;

-- Explicit EXECUTE grants on RLS helper functions.
-- The repository pattern (migrations 040, 041, 044, 046) explicitly grants
-- these to authenticated for clarity and defence-in-depth even though
-- PostgreSQL grants EXECUTE to PUBLIC by default.
GRANT EXECUTE ON FUNCTION public.can_non_driver_access_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_admin_manage_job(uuid) TO authenticated;

-- Add the table to the Supabase Realtime publication.
-- Wrapped in a DO block in case the publication is configured FOR ALL TABLES
-- or the table was already added manually.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.job_tracking_events;
EXCEPTION WHEN others THEN
  NULL;
END;
$$;
