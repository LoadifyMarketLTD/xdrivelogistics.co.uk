-- ============================================================
-- 014_add_invoices_table.sql
--
-- Adds the invoices table to support the dashboard "View Invoices"
-- quick action, and provides database-backed views/functions for
-- the four dashboard stats:
--   • Active Jobs        (posted / allocated / in_transit)
--   • Pending Quotes     (draft / sent)
--   • Active Drivers     (status = 'active')
--   • Completed Today    (delivered, updated today)
--
-- Safe to re-run: every statement uses IF NOT EXISTS / OR REPLACE.
-- ============================================================

-- ── Invoice status enum ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'invoice_status'
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    CREATE TYPE public.invoice_status AS ENUM ('Pending', 'Paid', 'Overdue');
  END IF;
END$$;

-- ── Invoices table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by          uuid        REFERENCES auth.users(id),
  invoice_number      text        NOT NULL,
  job_ref             text        NOT NULL,
  job_id              uuid        REFERENCES public.jobs(id) ON DELETE SET NULL,
  invoice_date        date        NOT NULL DEFAULT CURRENT_DATE,
  due_date            date        NOT NULL,
  status              public.invoice_status NOT NULL DEFAULT 'Pending',
  client_name         text        NOT NULL,
  client_address      text,
  client_email        text,
  pickup_location     text,
  pickup_datetime     timestamptz,
  delivery_location   text,
  delivery_datetime   timestamptz,
  delivery_recipient  text,
  service_description text,
  amount              numeric     NOT NULL DEFAULT 0,
  net_amount          numeric     NOT NULL DEFAULT 0,
  vat_amount          numeric     NOT NULL DEFAULT 0,
  vat_rate            smallint    NOT NULL DEFAULT 0 CHECK (vat_rate IN (0, 5, 20)),
  currency            text        NOT NULL DEFAULT 'GBP',
  payment_terms       text        NOT NULL DEFAULT '14 days',
  late_fee            text,
  pod_photos          text[],
  signature           text,
  recipient_name      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Enable RLS ───────────────────────────────────────────────
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- ── RLS policies ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'invoices_all_member'
  ) THEN
    CREATE POLICY invoices_all_member ON public.invoices
      FOR ALL
      USING (public.is_company_member(company_id));
  END IF;
END$$;

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_invoices_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoices_updated_at();

-- ── Dashboard stats view ─────────────────────────────────────
-- Returns the four key metrics shown on the admin dashboard.
-- Filter by company_id in the WHERE clause when querying.
--
-- Example:
--   SELECT * FROM public.dashboard_stats WHERE company_id = '<your-company-id>';
CREATE OR REPLACE VIEW public.dashboard_stats AS
SELECT
  j.company_id,
  COUNT(*) FILTER (
    WHERE j.status IN ('posted', 'allocated', 'in_transit')
  )                                          AS active_jobs,
  COUNT(*) FILTER (
    WHERE j.status = 'delivered'
      AND j.updated_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
  )                                          AS completed_today
FROM public.jobs j
GROUP BY j.company_id;

-- ── Invoice sequence helper function ─────────────────────────
-- Returns the next invoice number for a company in the format
-- INV-YYYYMM-NNN (three-digit zero-padded counter per month).
-- An advisory lock on the company UUID prevents duplicate numbers
-- when multiple invoices are created concurrently.
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_company_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix text;
  v_count  int;
BEGIN
  -- Acquire a session-level advisory lock keyed on the company UUID
  -- to prevent concurrent calls from computing the same counter.
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text));

  v_prefix := 'INV-' || to_char(now(), 'YYYYMM') || '-';
  SELECT COUNT(*) + 1
    INTO v_count
    FROM public.invoices
   WHERE company_id = p_company_id
     AND invoice_number LIKE v_prefix || '%';
  RETURN v_prefix || lpad(v_count::text, 3, '0');
END;
$$;

-- ── Unique constraint on invoice number per company ──────────
-- Prevents duplicate invoice numbers at the database level as a
-- safety net in addition to the advisory lock above.
ALTER TABLE public.invoices
  ADD CONSTRAINT IF NOT EXISTS invoices_company_invoice_number_unique
  UNIQUE (company_id, invoice_number);
