-- Migration 084: Runtime schema guards — invoices numeric columns & notifications shape
--
-- Fixes two live platform errors:
--
-- 1. Finance API HTTP 500 (Platform Health page)
--    Root cause: on some production instances the invoices table is missing
--    amount / net_amount / vat_amount / vat_rate / currency / payment_terms
--    because an earlier schema version predates migration 014/017.
--    Fix: idempotent ADD COLUMN IF NOT EXISTS for each column.
--
-- 2. System Notifications "column notifications.message does not exist"
--    Root cause: the notifications table stores the text in `body`, not
--    `message`.  The platform/route.ts API code has been corrected to use
--    `body` → `read_at` mapping.  This migration is a belt-and-braces guard
--    that ensures the `notifications` table has the expected columns.
--
-- Both blocks are NO-OPs when the columns already exist.

BEGIN;

-- ── 1. invoices — numeric / currency columns ─────────────────────────────────

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount        numeric      NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS net_amount    numeric      NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS vat_amount    numeric      NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS vat_rate      smallint     NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS currency      text         NOT NULL DEFAULT 'GBP';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_terms text         NOT NULL DEFAULT '14 days';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_name   text;

-- ── 2. notifications — ensure body / read_at columns exist ───────────────────
-- The platform API reads `body` (text) and `read_at` (timestamptz).
-- If the table was created by a different migration path these columns
-- may be absent.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body    text;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

COMMIT;
