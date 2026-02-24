-- ============================================================
-- 013_add_jobs_columns.sql
--
-- Standalone patch for databases that already have migration
-- 011_complete_schema_v2.sql applied but the jobs table is
-- missing columns (because CREATE TABLE IF NOT EXISTS skipped
-- the full column list when the table already existed).
--
-- Each ALTER TABLE statement is independent — a pre-existing
-- column is silently skipped (IF NOT EXISTS), and a missing
-- enum type causes a clear error on that one line only.
--
-- Run this in Supabase SQL Editor → New Query → Run.
-- Safe to re-run: IF NOT EXISTS makes every line idempotent.
-- ============================================================

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS created_by               uuid    REFERENCES auth.users(id);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS vehicle_type             public.vehicle_type;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS cargo_type               public.cargo_type;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pickup_location          text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pickup_postcode          text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pickup_lat               double precision;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pickup_lng               double precision;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pickup_datetime          timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS delivery_location        text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS delivery_postcode        text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS delivery_lat             double precision;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS delivery_lng             double precision;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS delivery_datetime        timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS pallets                  int;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS boxes                    int;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS bags                     int;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS items                    int;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS weight_kg                numeric;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS length_cm                numeric;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS width_cm                 numeric;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS height_cm                numeric;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS currency                 text    DEFAULT 'GBP';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS budget_amount            numeric;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_fixed_price           boolean DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS load_details             text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS special_requirements     text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS access_restrictions      text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_distance_miles       numeric;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_distance_minutes     int;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS distance_to_pickup_miles numeric;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS updated_at               timestamptz DEFAULT now();
