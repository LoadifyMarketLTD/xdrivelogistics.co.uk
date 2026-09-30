BEGIN;

-- Fresh databases did not contain the hosted public identity columns that the
-- following standardisation migration expects. Add only the missing columns;
-- 20260909110900_standardize_global_xd_public_ids.sql remains authoritative
-- for sequence creation, deterministic reassignment and triggers.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xd_id text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS xd_id text;

COMMIT;