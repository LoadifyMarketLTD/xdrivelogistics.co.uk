-- Migration 035: Close viewer write gap and prevent orphan-row loss of mutation access.
--
-- Problems fixed:
-- 1. is_company_non_driver only excludes profiles.role = 'driver'. A membership with
--    role_in_company = 'viewer' still passes, allowing viewers to INSERT/UPDATE/DELETE
--    operational records — violating least-privilege intent.
-- 2. INSERT policies in migration 034 allow created_by IS NULL. A row inserted without
--    the column set becomes permanently non-editable by the creator (only admins can
--    mutate it). Adding DEFAULT auth.uid() and removing the IS NULL branch closes this.
--
-- Strategy:
-- - Introduce is_company_operator(cid) and can_operator_access_job(jid): same as their
--   non_driver counterparts but additionally exclude role_in_company = 'viewer'.
-- - Use *_operator helpers exclusively on INSERT / UPDATE / DELETE policies.
-- - Keep *_non_driver helpers on SELECT policies (viewers may still read).
-- - Set DEFAULT auth.uid() on created_by / uploaded_by on all six tables so the column
--   is always populated at insert time without requiring the caller to supply it.
-- - Replace remaining broad job_bids / driver_locations write policies with
--   per-command least-privilege rules.
-- - Block hard deletes of active / allocated drivers at the database layer.
--
-- Resilience:
-- ADD COLUMN IF NOT EXISTS guards are applied before every ALTER COLUMN SET DEFAULT so
-- this migration is safe regardless of whether the live schema already has the column.
-- Policy drops use IF EXISTS before recreation so the migration is fully
-- idempotent on re-runs.

BEGIN;

-- Canonicalize legacy job assignment references before policy/function checks.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'driver_id'
  ) THEN
    UPDATE public.jobs
       SET assigned_driver_id = driver_id
     WHERE assigned_driver_id IS NULL
       AND driver_id IS NOT NULL;
  END IF;
END
$$;

-- ─── Helper functions ─────────────────────────────────────────────────────────

-- is_company_operator: non-driver AND non-viewer membership
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
      AND cm.user_id    = auth.uid()
      AND cm.status    <> 'suspended'
      AND p.role       <> 'driver'
      AND cm.role_in_company <> 'viewer'
  );
$$;

-- can_operator_access_job: operator check scoped to a job's company
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

CREATE OR REPLACE FUNCTION public.is_current_driver(did uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id = did
      AND d.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_unsafe_driver_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(OLD.status, 'active') = 'active' THEN
    RAISE EXCEPTION 'Cannot hard delete an active driver. Deactivate the driver first.'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.assigned_driver_id = OLD.id
      AND (
        j.status IS NULL
        OR j.status::text NOT IN ('delivered', 'cancelled', 'disputed')
      )
  ) THEN
    RAISE EXCEPTION 'Cannot hard delete a driver allocated to an open or active job.'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN OLD;
END;
$$;

-- ─── Column defaults ──────────────────────────────────────────────────────────
-- ADD COLUMN IF NOT EXISTS guards make this safe for live schemas where the column
-- may be absent (e.g. jobs.created_by missing due to migration sequencing gap).
-- After ensuring the column exists, SET DEFAULT stamps every subsequent insert.

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

DROP TRIGGER IF EXISTS trg_prevent_unsafe_driver_delete ON public.drivers;
CREATE TRIGGER trg_prevent_unsafe_driver_delete
  BEFORE DELETE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unsafe_driver_delete();

-- ─── jobs ─────────────────────────────────────────────────────────────────────
-- Drop both 034 names and any 035 names left by a prior partial run.

DROP POLICY IF EXISTS "jobs_insert_non_driver"       ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_operator"         ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_creator_or_admin" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_creator_or_admin" ON public.jobs;

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

-- ─── job_documents ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "job_documents_insert_non_driver"        ON public.job_documents;
DROP POLICY IF EXISTS "job_documents_insert_operator"          ON public.job_documents;
DROP POLICY IF EXISTS "job_documents_update_uploader_or_admin" ON public.job_documents;
DROP POLICY IF EXISTS "job_documents_delete_uploader_or_admin" ON public.job_documents;

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

-- ─── job_notes ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "job_notes_insert_non_driver"       ON public.job_notes;
DROP POLICY IF EXISTS "job_notes_insert_operator"         ON public.job_notes;
DROP POLICY IF EXISTS "job_notes_update_creator_or_admin" ON public.job_notes;
DROP POLICY IF EXISTS "job_notes_delete_creator_or_admin" ON public.job_notes;

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

-- ─── job_tracking_events ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "job_tracking_insert_non_driver"       ON public.job_tracking_events;
DROP POLICY IF EXISTS "job_tracking_insert_operator"         ON public.job_tracking_events;
DROP POLICY IF EXISTS "job_tracking_update_creator_or_admin" ON public.job_tracking_events;
DROP POLICY IF EXISTS "job_tracking_delete_creator_or_admin" ON public.job_tracking_events;

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

-- ─── quotes ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "quotes_insert_non_driver"       ON public.quotes;
DROP POLICY IF EXISTS "quotes_insert_operator"         ON public.quotes;
DROP POLICY IF EXISTS "quotes_update_creator_or_admin" ON public.quotes;
DROP POLICY IF EXISTS "quotes_delete_creator_or_admin" ON public.quotes;

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

-- ─── invoices ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "invoices_insert_non_driver"       ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_operator"         ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_creator_or_admin" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_creator_or_admin" ON public.invoices;

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

-- ─── job_bids ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "bids_all_member"               ON public.job_bids;
DROP POLICY IF EXISTS "job_bids_select_member"        ON public.job_bids;
DROP POLICY IF EXISTS "job_bids_insert_bidder_or_admin" ON public.job_bids;
DROP POLICY IF EXISTS "job_bids_update_bidder_or_admin" ON public.job_bids;
DROP POLICY IF EXISTS "job_bids_delete_admin"         ON public.job_bids;

CREATE POLICY "job_bids_select_member"
  ON public.job_bids FOR SELECT
  USING (
    company_id IS NOT NULL
    AND public.is_company_member(company_id)
  );

CREATE POLICY "job_bids_insert_bidder_or_admin"
  ON public.job_bids FOR INSERT
  WITH CHECK (
    company_id IS NOT NULL
    AND (
      public.is_company_admin(company_id)
      OR (
        public.is_company_member(company_id)
        AND (bidder_user_id = auth.uid() OR bidder_id = auth.uid())
        AND (
          bidder_driver_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.drivers d
            WHERE d.id = bidder_driver_id
              AND d.user_id = auth.uid()
              AND d.company_id = job_bids.company_id
          )
        )
      )
    )
  );

CREATE POLICY "job_bids_update_bidder_or_admin"
  ON public.job_bids FOR UPDATE
  USING (
    company_id IS NOT NULL
    AND (
      public.is_company_admin(company_id)
      OR (bidder_user_id = auth.uid() OR bidder_id = auth.uid())
    )
  )
  WITH CHECK (
    company_id IS NOT NULL
    AND (
      public.is_company_admin(company_id)
      OR (
        public.is_company_member(company_id)
        AND (bidder_user_id = auth.uid() OR bidder_id = auth.uid())
        AND (
          bidder_driver_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.drivers d
            WHERE d.id = bidder_driver_id
              AND d.user_id = auth.uid()
              AND d.company_id = job_bids.company_id
          )
        )
      )
    )
  );

CREATE POLICY "job_bids_delete_admin"
  ON public.job_bids FOR DELETE
  USING (
    company_id IS NOT NULL
    AND public.is_company_admin(company_id)
  );

-- ─── driver_locations ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "driver_locations_all_member"       ON public.driver_locations;
DROP POLICY IF EXISTS "driver_locations_select_member_or_self" ON public.driver_locations;
DROP POLICY IF EXISTS "driver_locations_insert_self_or_admin" ON public.driver_locations;
DROP POLICY IF EXISTS "driver_locations_update_self_or_admin" ON public.driver_locations;
DROP POLICY IF EXISTS "driver_locations_delete_admin"     ON public.driver_locations;

CREATE POLICY "driver_locations_select_member_or_self"
  ON public.driver_locations FOR SELECT
  USING (
    (company_id IS NOT NULL AND public.is_company_member(company_id))
    OR public.is_current_driver(driver_id)
  );

CREATE POLICY "driver_locations_insert_self_or_admin"
  ON public.driver_locations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = driver_locations.driver_id
        AND (
          public.is_company_admin(d.company_id)
          OR (
            d.user_id = auth.uid()
            AND (
              driver_locations.company_id IS NULL
              OR driver_locations.company_id = d.company_id
            )
          )
        )
    )
  );

CREATE POLICY "driver_locations_update_self_or_admin"
  ON public.driver_locations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = driver_locations.driver_id
        AND (
          public.is_company_admin(d.company_id)
          OR d.user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = driver_locations.driver_id
        AND (
          public.is_company_admin(d.company_id)
          OR (
            d.user_id = auth.uid()
            AND (
              driver_locations.company_id IS NULL
              OR driver_locations.company_id = d.company_id
            )
          )
        )
    )
  );

CREATE POLICY "driver_locations_delete_admin"
  ON public.driver_locations FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = driver_locations.driver_id
        AND public.is_company_admin(d.company_id)
    )
  );

COMMIT;
