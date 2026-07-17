-- Migration 034: Replace broad FOR ALL operational policies with least-privilege per-command policies.
-- Scope: jobs, job_documents, job_notes, job_tracking_events, quotes, invoices.
--
-- Access model:
-- - Non-driver company members can SELECT and INSERT in company scope.
-- - UPDATE/DELETE is limited to row creator/uploader or company admins.
-- - Drivers remain isolated by existing driver-specific policies (e.g. migration 029).

BEGIN;

CREATE OR REPLACE FUNCTION public.can_non_driver_access_job(jid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = jid
      AND public.is_company_non_driver(j.company_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_admin_manage_job(jid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = jid
      AND public.is_company_admin(j.company_id)
  );
$$;

-- jobs
DROP POLICY IF EXISTS "jobs_all_member" ON public.jobs;

CREATE POLICY "jobs_select_non_driver"
  ON public.jobs FOR SELECT
  USING (public.is_company_non_driver(company_id));

CREATE POLICY "jobs_insert_non_driver"
  ON public.jobs FOR INSERT
  WITH CHECK (
    public.is_company_non_driver(company_id)
    AND (
      created_by IS NULL
      OR created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "jobs_update_creator_or_admin"
  ON public.jobs FOR UPDATE
  USING (
    public.is_company_non_driver(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  )
  WITH CHECK (
    public.is_company_non_driver(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "jobs_delete_creator_or_admin"
  ON public.jobs FOR DELETE
  USING (
    public.is_company_non_driver(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

-- job_documents
DROP POLICY IF EXISTS "job_documents_all_member" ON public.job_documents;

CREATE POLICY "job_documents_select_non_driver"
  ON public.job_documents FOR SELECT
  USING (public.can_non_driver_access_job(job_id));

CREATE POLICY "job_documents_insert_non_driver"
  ON public.job_documents FOR INSERT
  WITH CHECK (
    public.can_non_driver_access_job(job_id)
    AND (
      uploaded_by IS NULL
      OR uploaded_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  );

CREATE POLICY "job_documents_update_uploader_or_admin"
  ON public.job_documents FOR UPDATE
  USING (
    public.can_non_driver_access_job(job_id)
    AND (
      uploaded_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  )
  WITH CHECK (
    public.can_non_driver_access_job(job_id)
    AND (
      uploaded_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  );

CREATE POLICY "job_documents_delete_uploader_or_admin"
  ON public.job_documents FOR DELETE
  USING (
    public.can_non_driver_access_job(job_id)
    AND (
      uploaded_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  );

-- job_notes
DROP POLICY IF EXISTS "job_notes_all_member" ON public.job_notes;

CREATE POLICY "job_notes_select_non_driver"
  ON public.job_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_notes.job_id
        AND j.company_id = job_notes.company_id
        AND public.is_company_non_driver(j.company_id)
    )
  );

CREATE POLICY "job_notes_insert_non_driver"
  ON public.job_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_notes.job_id
        AND j.company_id = job_notes.company_id
        AND public.is_company_non_driver(j.company_id)
    )
    AND (
      created_by IS NULL
      OR created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "job_notes_update_creator_or_admin"
  ON public.job_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_notes.job_id
        AND j.company_id = job_notes.company_id
        AND public.is_company_non_driver(j.company_id)
    )
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_notes.job_id
        AND j.company_id = job_notes.company_id
        AND public.is_company_non_driver(j.company_id)
    )
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "job_notes_delete_creator_or_admin"
  ON public.job_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_notes.job_id
        AND j.company_id = job_notes.company_id
        AND public.is_company_non_driver(j.company_id)
    )
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

-- job_tracking_events
DROP POLICY IF EXISTS "job_tracking_all_member" ON public.job_tracking_events;

CREATE POLICY "job_tracking_select_non_driver"
  ON public.job_tracking_events FOR SELECT
  USING (public.can_non_driver_access_job(job_id));

CREATE POLICY "job_tracking_insert_non_driver"
  ON public.job_tracking_events FOR INSERT
  WITH CHECK (
    public.can_non_driver_access_job(job_id)
    AND (
      created_by IS NULL
      OR created_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  );

CREATE POLICY "job_tracking_update_creator_or_admin"
  ON public.job_tracking_events FOR UPDATE
  USING (
    public.can_non_driver_access_job(job_id)
    AND (
      created_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  )
  WITH CHECK (
    public.can_non_driver_access_job(job_id)
    AND (
      created_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  );

CREATE POLICY "job_tracking_delete_creator_or_admin"
  ON public.job_tracking_events FOR DELETE
  USING (
    public.can_non_driver_access_job(job_id)
    AND (
      created_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  );

-- quotes
DROP POLICY IF EXISTS "quotes_all_member" ON public.quotes;

CREATE POLICY "quotes_select_non_driver"
  ON public.quotes FOR SELECT
  USING (public.is_company_non_driver(company_id));

CREATE POLICY "quotes_insert_non_driver"
  ON public.quotes FOR INSERT
  WITH CHECK (
    public.is_company_non_driver(company_id)
    AND (
      created_by IS NULL
      OR created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "quotes_update_creator_or_admin"
  ON public.quotes FOR UPDATE
  USING (
    public.is_company_non_driver(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  )
  WITH CHECK (
    public.is_company_non_driver(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "quotes_delete_creator_or_admin"
  ON public.quotes FOR DELETE
  USING (
    public.is_company_non_driver(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

-- invoices
DROP POLICY IF EXISTS "invoices_all_member" ON public.invoices;

CREATE POLICY "invoices_select_non_driver"
  ON public.invoices FOR SELECT
  USING (public.is_company_non_driver(company_id));

CREATE POLICY "invoices_insert_non_driver"
  ON public.invoices FOR INSERT
  WITH CHECK (
    public.is_company_non_driver(company_id)
    AND (
      created_by IS NULL
      OR created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "invoices_update_creator_or_admin"
  ON public.invoices FOR UPDATE
  USING (
    public.is_company_non_driver(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  )
  WITH CHECK (
    public.is_company_non_driver(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "invoices_delete_creator_or_admin"
  ON public.invoices FOR DELETE
  USING (
    public.is_company_non_driver(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

COMMIT;
