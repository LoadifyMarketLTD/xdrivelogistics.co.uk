-- ── Migration 058: Exchange Load Board ───────────────────────────────────────
-- Adds exchange marketplace fields to the jobs table so loads can be
-- posted to the exchange, discovered by carrier companies, and awarded
-- after bid review.
--
-- Safe to run multiple times (idempotent via IF NOT EXISTS / ALTER … IF NOT EXISTS).

-- 1. exchange_visibility  — controls who can see the load
--      'private'  : internal dispatch only (default, preserves current behaviour)
--      'exchange' : visible on the carrier exchange load board
--      'direct'   : shared with a specific carrier company via awarded_carrier_company_id
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS exchange_visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (exchange_visibility IN ('private', 'exchange', 'direct'));

-- 2. awarded_carrier_company_id  — the carrier company that won the bid/load
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS awarded_carrier_company_id UUID
  REFERENCES public.companies(id) ON DELETE SET NULL;

-- 3. exchange_posted_at  — timestamp when the load was pushed to the exchange
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS exchange_posted_at TIMESTAMPTZ;

-- 4. Index for load board queries (company browsing exchange loads)
CREATE INDEX IF NOT EXISTS idx_jobs_exchange_visibility
  ON public.jobs (exchange_visibility, status)
  WHERE exchange_visibility = 'exchange';

-- 5. RLS: carrier companies (company members) can SELECT exchange-visible jobs
--    from OTHER companies.  They cannot INSERT/UPDATE/DELETE them.
--    We use a separate permissive SELECT policy scoped to exchange rows.
DROP POLICY IF EXISTS jobs_exchange_select_policy ON public.jobs;
CREATE POLICY jobs_exchange_select_policy ON public.jobs
  FOR SELECT
  USING (
    exchange_visibility = 'exchange'
    AND status = 'posted'
    AND (
      -- authenticated company/admin users from any company
      EXISTS (
        SELECT 1 FROM public.company_memberships cm
        WHERE cm.user_id = auth.uid()
          AND cm.status = 'active'
          AND cm.role_in_company IN ('owner', 'admin', 'dispatcher', 'viewer')
      )
    )
  );
