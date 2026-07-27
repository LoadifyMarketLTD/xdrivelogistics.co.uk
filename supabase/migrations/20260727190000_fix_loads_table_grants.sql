-- Migration: fix loads table grants
--
-- The job_bids_with_job_owner view uses security_invoker = true and LEFT JOINs
-- public.loads. Without table-level privileges the authenticated role receives
-- "permission denied for table loads" before RLS policies are evaluated.
-- RLS policies (loads_select_non_driver, loads_insert_operator, etc.) already
-- exist from migrations 021 and 037; this migration adds the missing GRANTs so
-- those policies can actually run.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loads TO authenticated;
