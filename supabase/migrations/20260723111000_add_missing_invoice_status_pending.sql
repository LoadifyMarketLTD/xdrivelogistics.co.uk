-- Repair: ensure 'Pending' exists in public.invoice_status enum.
--
-- 'Pending' is the legacy DB representation of the canonical 'Draft' invoice
-- state.  It was originally introduced in migration 014_add_invoices_table.sql
-- but can be absent from environments where the enum was recreated or
-- manually altered.
--
-- This migration is idempotent and must run before
-- 20260723111500_invoice_snapshot_integrity.sql, which casts a status reset
-- value to 'Pending'::public.invoice_status.
--
-- ALTER TYPE … ADD VALUE must not run inside an explicit transaction block in
-- older PostgreSQL versions; on Supabase (PG 14 +) it is allowed but the new
-- value is not visible within the same transaction, so it is placed here in
-- its own migration instead.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_enum
    WHERE  enumtypid = 'public.invoice_status'::regtype::oid
      AND  enumlabel = 'Pending'
  ) THEN
    ALTER TYPE public.invoice_status ADD VALUE 'Pending';
  END IF;
END;
$$;
