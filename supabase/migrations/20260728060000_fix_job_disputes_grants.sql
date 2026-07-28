-- Migration: fix job_disputes table grants
--
-- job_disputes has RLS enabled and policies defined (migrations 083, 097, 108)
-- but the authenticated role was never granted object-level privileges on the
-- table. Without these GRANTs PostgreSQL returns "permission denied for table
-- job_disputes" before RLS policies are evaluated.

GRANT SELECT, INSERT, UPDATE ON public.job_disputes TO authenticated;
