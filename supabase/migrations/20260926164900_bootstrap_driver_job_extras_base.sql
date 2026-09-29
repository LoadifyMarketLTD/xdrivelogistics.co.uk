BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.driver_job_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  supplier_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  extra_type text NOT NULL CHECK (extra_type IN ('waiting_time','toll','parking','handball','other')),
  description text,
  amount_gbp numeric NOT NULL CHECK (amount_gbp > 0 AND amount_gbp <= 10000),
  minutes integer CHECK (minutes IS NULL OR (minutes >= 0 AND minutes <= 1440)),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected','invoiced')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  invoice_item_id uuid REFERENCES public.invoice_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_job_extras_driver_status
  ON public.driver_job_extras(driver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_job_extras_job_created
  ON public.driver_job_extras(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_job_extras_supplier_status
  ON public.driver_job_extras(supplier_company_id, status, created_at DESC);

ALTER TABLE public.driver_job_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_job_extras_deny_anon ON public.driver_job_extras;
CREATE POLICY driver_job_extras_deny_anon
  ON public.driver_job_extras
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS driver_job_extras_deny_authenticated ON public.driver_job_extras;
CREATE POLICY driver_job_extras_deny_authenticated
  ON public.driver_job_extras
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL PRIVILEGES ON TABLE public.driver_job_extras FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.driver_job_extras TO service_role;

COMMIT;