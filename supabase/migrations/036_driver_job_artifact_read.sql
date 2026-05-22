-- Migration 036: Grant assigned drivers read access to job artifacts.
--
-- Context:
-- Migration 029 allows drivers to SELECT / UPDATE the jobs table for their assigned jobs.
-- Migrations 034 and 035 set SELECT on job_documents, job_notes, and job_tracking_events
-- to non-driver company members only. This leaves a gap: a driver assigned to a job
-- cannot read the notes, tracking history, or documents attached to it.
--
-- Fix:
-- Add three read-only (SELECT) policies that allow a driver to access artifacts for
-- any job where drivers.user_id = auth.uid() and jobs.driver_id = drivers.id.
-- Write access (INSERT/UPDATE/DELETE) remains gated by the operator policies in 035.

BEGIN;

-- job_tracking_events: assigned driver may read their own job's tracking history
CREATE POLICY "job_tracking_select_assigned_driver"
  ON public.job_tracking_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.drivers d ON d.id = j.driver_id
      WHERE j.id  = job_tracking_events.job_id
        AND d.user_id = auth.uid()
    )
  );

-- job_notes: assigned driver may read notes on their job (read-only)
CREATE POLICY "job_notes_select_assigned_driver"
  ON public.job_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.drivers d ON d.id = j.driver_id
      WHERE j.id  = job_notes.job_id
        AND d.user_id = auth.uid()
    )
  );

-- job_documents: assigned driver may read documents attached to their job
CREATE POLICY "job_documents_select_assigned_driver"
  ON public.job_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.drivers d ON d.id = j.driver_id
      WHERE j.id  = job_documents.job_id
        AND d.user_id = auth.uid()
    )
  );

COMMIT;
