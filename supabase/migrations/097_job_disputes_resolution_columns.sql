-- Migration 097: Add resolution columns to job_disputes table
-- The admin disputes page currently cannot resolve disputes because
-- job_disputes is missing resolution_note, resolved_at, and updated_at.

ALTER TABLE public.job_disputes
  ADD COLUMN IF NOT EXISTS resolution_note text,
  ADD COLUMN IF NOT EXISTS resolved_at     timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz DEFAULT now();

-- Trigger to auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION public.touch_job_disputes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_disputes_updated_at ON public.job_disputes;
CREATE TRIGGER trg_job_disputes_updated_at
  BEFORE UPDATE ON public.job_disputes
  FOR EACH ROW EXECUTE FUNCTION public.touch_job_disputes_updated_at();

-- Enable RLS (safe no-op if already enabled)
ALTER TABLE public.job_disputes ENABLE ROW LEVEL SECURITY;

-- Policy: company members can SELECT their own disputes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_disputes'
    AND policyname = 'job_disputes_select_member'
  ) THEN
    CREATE POLICY "job_disputes_select_member"
    ON public.job_disputes FOR SELECT
    TO authenticated
    USING (raised_by_company_id = public.auth_company_id());
  END IF;
END $$;

-- Policy: company members can INSERT disputes for their own company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_disputes'
    AND policyname = 'job_disputes_insert_member'
  ) THEN
    CREATE POLICY "job_disputes_insert_member"
    ON public.job_disputes FOR INSERT
    TO authenticated
    WITH CHECK (raised_by_company_id = public.auth_company_id());
  END IF;
END $$;

-- Policy: admins can UPDATE (resolve) disputes belonging to their company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'job_disputes'
    AND policyname = 'job_disputes_update_admin'
  ) THEN
    CREATE POLICY "job_disputes_update_admin"
    ON public.job_disputes FOR UPDATE
    TO authenticated
    USING (
      raised_by_company_id = public.auth_company_id()
      AND (
        SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
      ) IN ('owner', 'admin', 'company', 'admin_staff', 'company_admin')
    )
    WITH CHECK (
      raised_by_company_id = public.auth_company_id()
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
