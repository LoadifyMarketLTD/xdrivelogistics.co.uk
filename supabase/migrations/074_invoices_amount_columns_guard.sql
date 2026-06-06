-- Migration 074: Runtime schema guard — invoices numeric columns
--
-- Problem: On some production instances the invoices table is missing the
-- amount / net_amount / vat_amount columns (schema drift), causing PostgREST
-- to return PGRST204 "Could not find the 'amount' column of 'invoices' in the
-- schema cache" on every invoice creation attempt.
--
-- Fix: Idempotent ADD COLUMN IF NOT EXISTS for each numeric column.
-- Columns are nullable here because existing rows that never had them
-- cannot satisfy NOT NULL without a data backfill.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is a no-op when the column exists.

BEGIN;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount      numeric NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS net_amount  numeric NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS vat_amount  numeric NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS vat_rate    smallint NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS currency    text NOT NULL DEFAULT 'GBP';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_terms text NOT NULL DEFAULT '14 days';

COMMIT;
