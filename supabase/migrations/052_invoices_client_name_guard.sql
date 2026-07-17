-- Migration 052: Runtime schema guard — invoices.client_name
--
-- Problem: The invoices table was defined with client_name in migration 014,
-- but some production instances are missing the column (schema drift), causing
-- a PostgREST 400 / PGRST204 error on every page load of the dashboard and
-- the invoices list page.
--
-- Fix: Idempotent ADD COLUMN IF NOT EXISTS so the column is present in all
-- environments.  The column is nullable here because existing rows in a
-- production DB that never had the column cannot satisfy NOT NULL without a
-- backfill.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is a no-op when the column exists.

BEGIN;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS client_name text;

COMMIT;
