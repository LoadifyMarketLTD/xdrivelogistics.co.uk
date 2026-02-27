-- ============================================================
-- 020_fix_all_forms.sql
--
-- ONE comprehensive, idempotent script that ensures every
-- column required by the Add Driver, Add Vehicle, Add Job,
-- Add Quote, and Add Invoice forms is present in the database.
--
-- Run this in the Supabase SQL Editor to fix ALL
-- "Could not find column … in the schema cache" errors.
--
-- Safe to re-run at any time — every statement uses
-- ADD COLUMN IF NOT EXISTS so it is a no-op when the column
-- already exists.
-- ============================================================


-- ── ENUMs (create only if they don't exist yet) ───────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.vehicle_type AS ENUM
      ('bicycle','motorbike','car','van_small','van_large','luton','truck_7_5t','truck_18t','artic');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cargo_type'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.cargo_type AS ENUM
      ('documents','packages','pallets','furniture','equipment','other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.job_status AS ENUM
      ('draft','posted','allocated','in_transit','delivered','cancelled','disputed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_role'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.company_role AS ENUM ('owner','admin','dispatcher','viewer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.membership_status AS ENUM ('invited','active','suspended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_status'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.doc_status AS ENUM ('pending','approved','rejected','expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tracking_event_type'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.tracking_event_type AS ENUM
      ('created','allocated','driver_en_route','arrived_pickup','collected','in_transit',
       'arrived_delivery','delivered','failed','cancelled','note');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.invoice_status AS ENUM ('Pending','Paid','Overdue');
  END IF;
END $$;


-- ── PROFILES ──────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name  text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role       text DEFAULT 'viewer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_driver  boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();


-- ── COMPANIES ─────────────────────────────────────────────────
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS company_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS vat_number     text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email          text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone          text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address_line1  text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address_line2  text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS city           text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS postcode       text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS country        text DEFAULT 'UK';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS status         text DEFAULT 'active';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS company_type   text DEFAULT 'standard';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS created_by     uuid REFERENCES auth.users(id);


-- ── DRIVERS ───────────────────────────────────────────────────
-- display_name: the form "Full Name" field
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS display_name   text;
-- contact columns
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS phone          text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS email          text;
-- status
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS status         text DEFAULT 'active';
-- driver-app columns
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS login_pin      text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS app_access     boolean DEFAULT false;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS last_app_login timestamptz;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS device_token   text;


-- ── VEHICLES ──────────────────────────────────────────────────
-- company_id: required FK for the Add Vehicle form
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS company_id         uuid REFERENCES public.companies(id) ON DELETE CASCADE;
-- optional driver assignment
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL;
-- descriptive fields
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS reg_plate          text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS make               text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS model              text;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS payload_kg         numeric;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS pallets_capacity   int;
-- capability flags (these are what trigger the schema-cache error)
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS has_tail_lift      boolean DEFAULT false;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS has_straps         boolean DEFAULT false;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS has_blankets       boolean DEFAULT false;


-- ── JOBS ──────────────────────────────────────────────────────
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS created_by               uuid REFERENCES auth.users(id);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS assigned_driver_id       uuid REFERENCES public.drivers(id) ON DELETE SET NULL;
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
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS currency                 text DEFAULT 'GBP';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS budget_amount            numeric;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_fixed_price           boolean DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS load_details             text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS special_requirements     text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS access_restrictions      text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_distance_miles       numeric;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_distance_minutes     int;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS distance_to_pickup_miles numeric;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS collection_photo_url     text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS delivery_photos          text[];
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS delivery_signature_data  text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS status_history           jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS driver_notes             text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS client_signature_name    text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS updated_at               timestamptz DEFAULT now();


-- ── JOB_BIDS ──────────────────────────────────────────────────
ALTER TABLE public.job_bids ADD COLUMN IF NOT EXISTS company_id       uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.job_bids ADD COLUMN IF NOT EXISTS bidder_user_id   uuid REFERENCES auth.users(id);
ALTER TABLE public.job_bids ADD COLUMN IF NOT EXISTS bidder_id        uuid REFERENCES auth.users(id);
ALTER TABLE public.job_bids ADD COLUMN IF NOT EXISTS bidder_driver_id uuid REFERENCES public.drivers(id);
ALTER TABLE public.job_bids ADD COLUMN IF NOT EXISTS amount           numeric(12,2);
ALTER TABLE public.job_bids ADD COLUMN IF NOT EXISTS bid_price_gbp    numeric(12,2);
ALTER TABLE public.job_bids ADD COLUMN IF NOT EXISTS currency         text DEFAULT 'GBP';
ALTER TABLE public.job_bids ADD COLUMN IF NOT EXISTS message          text;
ALTER TABLE public.job_bids ADD COLUMN IF NOT EXISTS status           text DEFAULT 'pending';


-- ── QUOTES ────────────────────────────────────────────────────
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS company_id        uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS created_by        uuid REFERENCES auth.users(id);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_name     text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_email    text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_phone    text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS pickup_location   text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS delivery_location text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS vehicle_type      public.vehicle_type;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS cargo_type        public.cargo_type;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS amount            numeric;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS currency          text DEFAULT 'GBP';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS status            text DEFAULT 'draft';


-- ── DRIVER_LOCATIONS (create if it does not exist at all) ─────
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid             NOT NULL REFERENCES public.drivers(id)  ON DELETE CASCADE,
  company_id  uuid             REFERENCES public.companies(id) ON DELETE SET NULL,
  job_id      uuid             REFERENCES public.jobs(id)      ON DELETE SET NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  heading     double precision,
  speed_mph   double precision,
  recorded_at timestamptz      NOT NULL DEFAULT now(),
  updated_at  timestamptz      NOT NULL DEFAULT now()
);

-- Indexes for driver_locations
CREATE INDEX IF NOT EXISTS driver_locations_driver_id_idx   ON public.driver_locations (driver_id);
CREATE INDEX IF NOT EXISTS driver_locations_company_id_idx  ON public.driver_locations (company_id);
CREATE INDEX IF NOT EXISTS driver_locations_recorded_at_idx ON public.driver_locations (recorded_at DESC);

-- RLS for driver_locations
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'driver_locations'
      AND policyname = 'driver_locations_all_member'
  ) THEN
    CREATE POLICY driver_locations_all_member ON public.driver_locations
      FOR ALL USING (public.is_company_member(company_id));
  END IF;
END $$;


-- ── RELOAD SCHEMA CACHE ───────────────────────────────────────
-- Forces PostgREST to pick up all the new columns immediately
-- without needing to restart or redeploy the project.
NOTIFY pgrst, 'reload schema';
