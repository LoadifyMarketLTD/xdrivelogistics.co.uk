-- Migration 092: Driver Finance Workspace
--
-- 1. Extend invoice_status enum with driver workflow states:
--    Submitted, Approved, Disputed
--    (ALTER TYPE … ADD VALUE cannot run inside a transaction block)
--
-- 2. Add workflow timestamp/actor columns to public.invoices
--    (submitted_at, submitted_by, approved_at, approved_by, disputed_at, paid_at)
--
-- 3. Create public.invoice_documents — uploaded artefacts (invoice PDF, POD docs)
--    linked to an invoice.
--
-- 4. Extend RLS on invoice_documents so company members can manage their own docs.
--
-- All statements are idempotent (IF NOT EXISTS / IF NOT EXISTS guards).

-- ── 1. Extend invoice_status enum ────────────────────────────────────────────
-- These three ALTER TYPE statements MUST run outside any transaction.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Submitted'
      AND enumtypid = (
        SELECT oid FROM pg_type
        WHERE typname = 'invoice_status'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      )
  ) THEN
    ALTER TYPE public.invoice_status ADD VALUE 'Submitted';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Approved'
      AND enumtypid = (
        SELECT oid FROM pg_type
        WHERE typname = 'invoice_status'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      )
  ) THEN
    ALTER TYPE public.invoice_status ADD VALUE 'Approved';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Disputed'
      AND enumtypid = (
        SELECT oid FROM pg_type
        WHERE typname = 'invoice_status'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      )
  ) THEN
    ALTER TYPE public.invoice_status ADD VALUE 'Disputed';
  END IF;
END$$;

-- ── 2. Workflow timestamps / actors on invoices ────────────────────────────────

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS submitted_at  timestamptz;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS submitted_by  uuid REFERENCES auth.users(id);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS approved_at   timestamptz;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS approved_by   uuid REFERENCES auth.users(id);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS disputed_at   timestamptz;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_at       timestamptz;

-- ── 3. invoice_documents table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoice_documents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       uuid        NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id       uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by      uuid        REFERENCES auth.users(id),
  doc_type         text        NOT NULL DEFAULT 'invoice_pdf'
                                 CHECK (doc_type IN ('invoice_pdf', 'pod_photo', 'pod_signature', 'other')),
  file_url         text        NOT NULL,
  file_name        text,
  file_size_bytes  bigint,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_documents_invoice_id_idx
  ON public.invoice_documents (invoice_id, created_at DESC);

-- ── 4. RLS on invoice_documents ───────────────────────────────────────────────

ALTER TABLE public.invoice_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_documents_member_access ON public.invoice_documents;
CREATE POLICY invoice_documents_member_access ON public.invoice_documents
  FOR ALL
  USING (public.is_company_member(company_id));
