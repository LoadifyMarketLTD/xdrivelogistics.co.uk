-- 030_jobs_client_fields.sql
-- Add dedicated customer contact fields to jobs and backfill the client name from legacy data.

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS client_email text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS client_phone text;

UPDATE public.jobs
SET client_name = COALESCE(NULLIF(client_name, ''), NULLIF(load_details, ''))
WHERE client_name IS NULL OR client_name = '';
