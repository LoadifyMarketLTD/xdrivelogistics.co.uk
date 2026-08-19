-- PR #357-compatible driver job-document read privilege repair.
--
-- Migration 036 already defines the authoritative RLS policy restricting
-- job_documents SELECT to the driver assigned to the related job. This migration
-- grants the authenticated role the table-level SELECT privilege required for
-- that existing RLS policy to be reachable.
--
-- It intentionally does NOT change the RLS policy, write permissions, job
-- visibility, lifecycle, storage permissions or any workspace UI.

BEGIN;

GRANT SELECT ON TABLE public.job_documents TO authenticated;

COMMENT ON POLICY "job_documents_select_assigned_driver" ON public.job_documents IS
  'Assigned drivers may read job document metadata for their own assigned jobs; table SELECT privilege is enabled for authenticated while RLS remains authoritative.';

COMMIT;
