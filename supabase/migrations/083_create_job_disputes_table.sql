-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 083 — Create job_disputes table for operations dispute queue
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.job_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  raised_by_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_disputes_job_id_idx
  ON public.job_disputes (job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS job_disputes_company_id_idx
  ON public.job_disputes (raised_by_company_id, created_at DESC);
