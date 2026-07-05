-- ===========================================================================
-- Migration 094 - FR-002A: Support ticket creation workflow
-- Creates a dedicated support_tickets table with full lifecycle management.
-- ===========================================================================

-- Table ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  raised_by_user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  subject              text        NOT NULL,
  description          text,
  category             text        NOT NULL DEFAULT 'general'
                                   CHECK (category IN ('billing', 'operations', 'technical', 'compliance', 'general')),
  priority             text        NOT NULL DEFAULT 'medium'
                                   CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status               text        NOT NULL DEFAULT 'open'
                                   CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  assigned_to_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note      text,
  resolved_at          timestamptz,
  closed_at            timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Indexes -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS support_tickets_company_id_idx
  ON public.support_tickets (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS support_tickets_status_idx
  ON public.support_tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS support_tickets_raised_by_idx
  ON public.support_tickets (raised_by_user_id);

-- Lifecycle trigger: auto-stamp resolved_at / closed_at / updated_at ---------
CREATE OR REPLACE FUNCTION public.support_tickets_set_timestamps()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved') THEN
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
  END IF;

  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_timestamps ON public.support_tickets;
CREATE TRIGGER support_tickets_timestamps
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_tickets_set_timestamps();

-- RLS -----------------------------------------------------------------------
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- PostgreSQL does not support CREATE POLICY IF NOT EXISTS, so policies are
-- recreated idempotently with DROP POLICY IF EXISTS first.
DROP POLICY IF EXISTS support_tickets_company_read ON public.support_tickets;
CREATE POLICY support_tickets_company_read
  ON public.support_tickets FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR raised_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS support_tickets_company_insert ON public.support_tickets;
CREATE POLICY support_tickets_company_insert
  ON public.support_tickets FOR INSERT
  WITH CHECK (
    raised_by_user_id = auth.uid()
    AND (
      company_id IS NULL
      OR company_id IN (
        SELECT company_id FROM public.company_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );
