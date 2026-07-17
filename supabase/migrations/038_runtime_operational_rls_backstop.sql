-- Migration 038: Runtime operational RLS backstop
--
-- Purpose:
-- - Remove any lingering broad FOR ALL / *_all_member policies on active
--   operational runtime tables.
-- - Reassert least-privilege per-command policies used by hardened runtime flow.
--
-- Scope intentionally limited to active operational tables:
--   jobs, job_documents, job_notes, job_tracking_events, quotes, invoices.

BEGIN;

-- Helper functions (re-declared for idempotent backstop runs on drifted envs)
CREATE OR REPLACE FUNCTION public.can_non_driver_access_job(jid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
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
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = jid
      AND public.is_company_admin(j.company_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_operator(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.profiles p ON p.user_id = cm.user_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
      AND p.role <> 'driver'
      AND cm.role_in_company <> 'viewer'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_operator_access_job(jid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = jid
      AND public.is_company_operator(j.company_id)
  );
$$;

-- Keep creator/uploader ownership fields populated for operator mutation checks.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.jobs
  ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.job_notes
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.job_notes
  ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.job_tracking_events
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.job_tracking_events
  ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.quotes
  ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.invoices
  ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.job_documents
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id);
ALTER TABLE public.job_documents
  ALTER COLUMN uploaded_by SET DEFAULT auth.uid();

-- Drop broad legacy policies and prior per-command variants before re-create.
DROP POLICY IF EXISTS "jobs_all_member" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_non_driver" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_non_driver" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_operator" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_creator_or_admin" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_creator_or_admin" ON public.jobs;

CREATE POLICY "jobs_select_non_driver"
  ON public.jobs FOR SELECT
  USING (public.is_company_non_driver(company_id));

CREATE POLICY "jobs_insert_operator"
  ON public.jobs FOR INSERT
  WITH CHECK (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "jobs_update_creator_or_admin"
  ON public.jobs FOR UPDATE
  USING (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  )
  WITH CHECK (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "jobs_delete_creator_or_admin"
  ON public.jobs FOR DELETE
  USING (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

DROP POLICY IF EXISTS "job_documents_all_member" ON public.job_documents;
DROP POLICY IF EXISTS "job_documents_select_non_driver" ON public.job_documents;
DROP POLICY IF EXISTS "job_documents_insert_non_driver" ON public.job_documents;
DROP POLICY IF EXISTS "job_documents_insert_operator" ON public.job_documents;
DROP POLICY IF EXISTS "job_documents_update_uploader_or_admin" ON public.job_documents;
DROP POLICY IF EXISTS "job_documents_delete_uploader_or_admin" ON public.job_documents;

CREATE POLICY "job_documents_select_non_driver"
  ON public.job_documents FOR SELECT
  USING (public.can_non_driver_access_job(job_id));

CREATE POLICY "job_documents_insert_operator"
  ON public.job_documents FOR INSERT
  WITH CHECK (
    public.can_operator_access_job(job_id)
    AND (
      uploaded_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  );

CREATE POLICY "job_documents_update_uploader_or_admin"
  ON public.job_documents FOR UPDATE
  USING (
    public.can_operator_access_job(job_id)
    AND (
      uploaded_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  )
  WITH CHECK (
    public.can_operator_access_job(job_id)
    AND (
      uploaded_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  );

CREATE POLICY "job_documents_delete_uploader_or_admin"
  ON public.job_documents FOR DELETE
  USING (
    public.can_operator_access_job(job_id)
    AND (
      uploaded_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  );

DROP POLICY IF EXISTS "job_notes_all_member" ON public.job_notes;
DROP POLICY IF EXISTS "job_notes_select_non_driver" ON public.job_notes;
DROP POLICY IF EXISTS "job_notes_insert_non_driver" ON public.job_notes;
DROP POLICY IF EXISTS "job_notes_insert_operator" ON public.job_notes;
DROP POLICY IF EXISTS "job_notes_update_creator_or_admin" ON public.job_notes;
DROP POLICY IF EXISTS "job_notes_delete_creator_or_admin" ON public.job_notes;

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

CREATE POLICY "job_notes_insert_operator"
  ON public.job_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_notes.job_id
        AND j.company_id = job_notes.company_id
        AND public.is_company_operator(j.company_id)
    )
    AND (
      created_by = auth.uid()
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
        AND public.is_company_operator(j.company_id)
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
        AND public.is_company_operator(j.company_id)
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
        AND public.is_company_operator(j.company_id)
    )
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

DROP POLICY IF EXISTS "job_tracking_all_member" ON public.job_tracking_events;
DROP POLICY IF EXISTS "job_tracking_select_non_driver" ON public.job_tracking_events;
DROP POLICY IF EXISTS "job_tracking_insert_non_driver" ON public.job_tracking_events;
DROP POLICY IF EXISTS "job_tracking_insert_operator" ON public.job_tracking_events;
DROP POLICY IF EXISTS "job_tracking_update_creator_or_admin" ON public.job_tracking_events;
DROP POLICY IF EXISTS "job_tracking_delete_creator_or_admin" ON public.job_tracking_events;

CREATE POLICY "job_tracking_select_non_driver"
  ON public.job_tracking_events FOR SELECT
  USING (public.can_non_driver_access_job(job_id));

CREATE POLICY "job_tracking_insert_operator"
  ON public.job_tracking_events FOR INSERT
  WITH CHECK (
    public.can_operator_access_job(job_id)
    AND (
      created_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  );

CREATE POLICY "job_tracking_update_creator_or_admin"
  ON public.job_tracking_events FOR UPDATE
  USING (
    public.can_operator_access_job(job_id)
    AND (
      created_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  )
  WITH CHECK (
    public.can_operator_access_job(job_id)
    AND (
      created_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  );

CREATE POLICY "job_tracking_delete_creator_or_admin"
  ON public.job_tracking_events FOR DELETE
  USING (
    public.can_operator_access_job(job_id)
    AND (
      created_by = auth.uid()
      OR public.can_admin_manage_job(job_id)
    )
  );

DROP POLICY IF EXISTS "quotes_all_member" ON public.quotes;
DROP POLICY IF EXISTS "quotes_select_non_driver" ON public.quotes;
DROP POLICY IF EXISTS "quotes_insert_non_driver" ON public.quotes;
DROP POLICY IF EXISTS "quotes_insert_operator" ON public.quotes;
DROP POLICY IF EXISTS "quotes_update_creator_or_admin" ON public.quotes;
DROP POLICY IF EXISTS "quotes_delete_creator_or_admin" ON public.quotes;

CREATE POLICY "quotes_select_non_driver"
  ON public.quotes FOR SELECT
  USING (public.is_company_non_driver(company_id));

CREATE POLICY "quotes_insert_operator"
  ON public.quotes FOR INSERT
  WITH CHECK (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "quotes_update_creator_or_admin"
  ON public.quotes FOR UPDATE
  USING (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  )
  WITH CHECK (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "quotes_delete_creator_or_admin"
  ON public.quotes FOR DELETE
  USING (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

DROP POLICY IF EXISTS "invoices_all_member" ON public.invoices;
DROP POLICY IF EXISTS "invoices_select_non_driver" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_non_driver" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_operator" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_creator_or_admin" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_creator_or_admin" ON public.invoices;

CREATE POLICY "invoices_select_non_driver"
  ON public.invoices FOR SELECT
  USING (public.is_company_non_driver(company_id));

CREATE POLICY "invoices_insert_operator"
  ON public.invoices FOR INSERT
  WITH CHECK (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "invoices_update_creator_or_admin"
  ON public.invoices FOR UPDATE
  USING (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  )
  WITH CHECK (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

CREATE POLICY "invoices_delete_creator_or_admin"
  ON public.invoices FOR DELETE
  USING (
    public.is_company_operator(company_id)
    AND (
      created_by = auth.uid()
      OR public.is_company_admin(company_id)
    )
  );

COMMIT;
