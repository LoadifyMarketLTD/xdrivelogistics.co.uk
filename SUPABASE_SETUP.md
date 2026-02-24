# Supabase Schema Setup — Danny Courier Ltd

## ⚡ Metoda rapidă — un singur copy-paste

1. Mergi la [https://app.supabase.com](https://app.supabase.com)
2. Selectează proiectul **Danny Courier Ltd**
3. În meniul din stânga, apasă pe **SQL Editor**
4. Apasă **New Query**
5. Copiază **tot scriptul de mai jos** și lipește-l în editor
6. Apasă **Run** → aștepți mesajul **`Success. No rows returned`**

```sql
-- ============================================================
-- Danny Courier Ltd — COMPLETE SCHEMA v2
-- Single idempotent file — copy and paste the ENTIRE contents
-- into the Supabase SQL Editor and click "Run".
--
-- Safe on a brand-new (empty) database.
-- Safe on an existing database — only adds what is missing,
-- never drops or renames existing data.
--
-- Includes all fixes up to and including migration 010:
--   • Corrected RLS policies for companies + company_memberships
--     (fixes the "Company profile not loaded yet" circular-
--     dependency bug where 'invited' status users were locked out)
--   • get_or_create_company_for_user() auto-provisioning function
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. ENUM TYPES
-- ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_role'
                 AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.company_role AS ENUM ('owner', 'admin', 'dispatcher', 'viewer');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status'
                 AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.membership_status AS ENUM ('invited', 'active', 'suspended');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_status'
                 AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.doc_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status'
                 AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.job_status AS ENUM (
      'draft', 'posted', 'allocated', 'in_transit',
      'delivered', 'cancelled', 'disputed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cargo_type'
                 AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.cargo_type AS ENUM (
      'documents', 'packages', 'pallets', 'furniture', 'equipment', 'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type'
                 AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.vehicle_type AS ENUM (
      'bicycle', 'motorbike', 'car',
      'van_small', 'van_large', 'luton',
      'truck_7_5t', 'truck_18t', 'artic'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tracking_event_type'
                 AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.tracking_event_type AS ENUM (
      'created', 'allocated', 'driver_en_route', 'arrived_pickup',
      'collected', 'in_transit', 'arrived_delivery', 'delivered',
      'failed', 'cancelled', 'note'
    );
  END IF;
END
$$;

-- ──────────────────────────────────────────────────────────────
-- 2. CORE TABLES (CREATE IF NOT EXISTS, dependency order)
-- ──────────────────────────────────────────────────────────────

-- 2.1 companies (no deps on other public tables)
CREATE TABLE IF NOT EXISTS public.companies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  company_number text,
  vat_number     text,
  email          text,
  phone          text,
  address_line1  text,
  address_line2  text,
  city           text,
  postcode       text,
  country        text    DEFAULT 'UK',
  status         text    DEFAULT 'active',
  company_type   text    DEFAULT 'standard',
  created_by     uuid    REFERENCES auth.users(id),
  created_at     timestamptz DEFAULT now()
);

-- 2.2 profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text,
  phone      text,
  email      text,
  role       text    DEFAULT 'viewer',
  company_id uuid    REFERENCES public.companies(id) ON DELETE SET NULL,
  is_driver  boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2.3 company_memberships
CREATE TABLE IF NOT EXISTS public.company_memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id)   ON DELETE CASCADE,
  user_id         uuid            REFERENCES auth.users(id)        ON DELETE CASCADE,
  invited_email   text,
  role_in_company public.company_role    DEFAULT 'viewer',
  status          public.membership_status DEFAULT 'invited',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (company_id, user_id),
  UNIQUE (company_id, invited_email)
);

-- 2.4 drivers
CREATE TABLE IF NOT EXISTS public.drivers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id      uuid            REFERENCES auth.users(id)    ON DELETE SET NULL,
  display_name text NOT NULL,
  phone        text,
  email        text,
  status       text DEFAULT 'active',
  created_at   timestamptz DEFAULT now()
);

-- 2.5 vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assigned_driver_id uuid            REFERENCES public.drivers(id) ON DELETE SET NULL,
  type               public.vehicle_type NOT NULL,
  reg_plate          text,
  make               text,
  model              text,
  payload_kg         numeric,
  pallets_capacity   int,
  has_tail_lift      boolean DEFAULT false,
  has_straps         boolean DEFAULT false,
  has_blankets       boolean DEFAULT false,
  created_at         timestamptz DEFAULT now()
);

-- 2.6 driver_documents
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        uuid NOT NULL REFERENCES public.drivers(id)  ON DELETE CASCADE,
  doc_type         text NOT NULL,
  file_path        text,
  issued_date      date,
  expiry_date      date,
  status           public.doc_status DEFAULT 'pending',
  rejection_reason text,
  verified_by      uuid REFERENCES auth.users(id),
  verified_at      timestamptz,
  created_at       timestamptz DEFAULT now()
);

-- 2.7 vehicle_documents
CREATE TABLE IF NOT EXISTS public.vehicle_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  doc_type         text NOT NULL,
  file_path        text,
  issued_date      date,
  expiry_date      date,
  status           public.doc_status DEFAULT 'pending',
  rejection_reason text,
  verified_by      uuid REFERENCES auth.users(id),
  verified_at      timestamptz,
  created_at       timestamptz DEFAULT now()
);

-- 2.8 jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by               uuid REFERENCES auth.users(id),
  status                   public.job_status    DEFAULT 'draft',
  vehicle_type             public.vehicle_type,
  cargo_type               public.cargo_type,
  pickup_location          text,
  pickup_postcode          text,
  pickup_lat               double precision,
  pickup_lng               double precision,
  pickup_datetime          timestamptz,
  delivery_location        text,
  delivery_postcode        text,
  delivery_lat             double precision,
  delivery_lng             double precision,
  delivery_datetime        timestamptz,
  pallets                  int,
  boxes                    int,
  bags                     int,
  items                    int,
  weight_kg                numeric,
  length_cm                numeric,
  width_cm                 numeric,
  height_cm                numeric,
  currency                 text    DEFAULT 'GBP',
  budget_amount            numeric,
  is_fixed_price           boolean DEFAULT false,
  load_details             text,
  special_requirements     text,
  access_restrictions      text,
  job_distance_miles       numeric,
  job_distance_minutes     int,
  distance_to_pickup_miles numeric,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

-- 2.9 job_documents
CREATE TABLE IF NOT EXISTS public.job_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id),
  doc_type    text DEFAULT 'other',
  file_path   text,
  created_at  timestamptz DEFAULT now()
);

-- 2.10 job_notes
CREATE TABLE IF NOT EXISTS public.job_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid NOT NULL REFERENCES public.jobs(id)      ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2.11 job_tracking_events
CREATE TABLE IF NOT EXISTS public.job_tracking_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  event_type public.tracking_event_type NOT NULL,
  message    text,
  meta       jsonb,
  created_at timestamptz DEFAULT now()
);

-- 2.12 job_bids
-- amount/bid_price_gbp and bidder_user_id/bidder_id are alias
-- column pairs kept for backwards compatibility. The trigger
-- below (in the TRIGGERS section) keeps each pair in sync.
CREATE TABLE IF NOT EXISTS public.job_bids (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           uuid NOT NULL REFERENCES public.jobs(id)      ON DELETE CASCADE,
  company_id       uuid            REFERENCES public.companies(id) ON DELETE CASCADE,
  bidder_user_id   uuid            REFERENCES auth.users(id)      ON DELETE SET NULL,
  bidder_driver_id uuid            REFERENCES public.drivers(id)  ON DELETE SET NULL,
  bidder_id        uuid            REFERENCES auth.users(id)      ON DELETE SET NULL,
  amount           numeric(12,2),
  bid_price_gbp    numeric(12,2),
  currency         text    DEFAULT 'GBP',
  message          text,
  status           text    DEFAULT 'submitted',
  created_at       timestamptz DEFAULT now()
);

-- 2.13 driver_locations
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL REFERENCES public.drivers(id)   ON DELETE CASCADE,
  company_id  uuid            REFERENCES public.companies(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  heading     int,
  speed_mph   numeric,
  updated_at  timestamptz DEFAULT now(),
  recorded_at timestamptz DEFAULT now()
);

-- 2.14 job_driver_distance_cache
CREATE TABLE IF NOT EXISTS public.job_driver_distance_cache (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            uuid NOT NULL REFERENCES public.jobs(id)    ON DELETE CASCADE,
  driver_id         uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  miles_to_pickup   numeric,
  minutes_to_pickup int,
  computed_at       timestamptz DEFAULT now(),
  UNIQUE (job_id, driver_id)
);

-- 2.15 quotes
CREATE TABLE IF NOT EXISTS public.quotes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by        uuid REFERENCES auth.users(id),
  customer_name     text,
  customer_email    text,
  customer_phone    text,
  pickup_location   text,
  delivery_location text,
  vehicle_type      public.vehicle_type,
  cargo_type        public.cargo_type,
  amount            numeric,
  currency          text DEFAULT 'GBP',
  status            text DEFAULT 'draft',
  created_at        timestamptz DEFAULT now()
);

-- 2.16 diary_events
CREATE TABLE IF NOT EXISTS public.diary_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id  uuid            REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id uuid            REFERENCES public.vehicles(id) ON DELETE SET NULL,
  title      text NOT NULL,
  start_at   timestamptz NOT NULL,
  end_at     timestamptz,
  meta       jsonb,
  created_at timestamptz DEFAULT now()
);

-- 2.17 return_journeys
CREATE TABLE IF NOT EXISTS public.return_journeys (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id      uuid            REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_type   public.vehicle_type,
  from_postcode  text,
  to_postcode    text,
  available_from timestamptz,
  available_to   timestamptz,
  notes          text,
  status         text DEFAULT 'available',
  created_at     timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────
-- 3. ADD MISSING COLUMNS to pre-existing tables (idempotent)
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email      text,
    ADD COLUMN IF NOT EXISTS role       text DEFAULT 'viewer',
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS address_line1 text,
    ADD COLUMN IF NOT EXISTS address_line2 text,
    ADD COLUMN IF NOT EXISTS city          text,
    ADD COLUMN IF NOT EXISTS postcode      text,
    ADD COLUMN IF NOT EXISTS status        text DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS company_type  text DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS created_by    uuid REFERENCES auth.users(id);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Add every column the application needs on the jobs table.
-- Each statement is independent so a missing enum type or
-- pre-existing column never aborts the whole transaction.
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

DO $$ BEGIN
  ALTER TABLE public.job_bids
    ADD COLUMN IF NOT EXISTS amount         numeric(12,2),
    ADD COLUMN IF NOT EXISTS bid_price_gbp  numeric(12,2),
    ADD COLUMN IF NOT EXISTS bidder_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS bidder_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.driver_locations
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS vehicle_type public.vehicle_type,
    ADD COLUMN IF NOT EXISTS cargo_type   public.cargo_type,
    ADD COLUMN IF NOT EXISTS currency     text DEFAULT 'GBP',
    ADD COLUMN IF NOT EXISTS status       text DEFAULT 'draft';
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.return_journeys
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'available';
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────
-- 4. UNIQUE CONSTRAINT on company_memberships (idempotent)
-- ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints tc
    JOIN   information_schema.constraint_column_usage ccu
           ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema    = ccu.table_schema
    WHERE  tc.constraint_type = 'UNIQUE'
      AND  tc.table_schema    = 'public'
      AND  tc.table_name      = 'company_memberships'
      AND  ccu.column_name    = 'user_id'
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_company_id_user_id_key
      UNIQUE (company_id, user_id);
  END IF;
END
$$;

-- ──────────────────────────────────────────────────────────────
-- 5. HELPER FUNCTIONS
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = cid AND user_id = auth.uid() AND status <> 'suspended'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(cid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = cid AND user_id = auth.uid() AND status <> 'suspended'
      AND role_in_company IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_job_bid_price()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.bid_price_gbp IS NULL AND NEW.amount IS NOT NULL THEN
    NEW.bid_price_gbp := NEW.amount;
  END IF;
  IF NEW.amount IS NULL AND NEW.bid_price_gbp IS NOT NULL THEN
    NEW.amount := NEW.bid_price_gbp;
  END IF;
  IF NEW.bid_price_gbp IS NOT NULL AND NEW.amount IS NOT NULL
     AND NEW.bid_price_gbp <> NEW.amount THEN
    NEW.amount := NEW.bid_price_gbp;
  END IF;
  IF NEW.bidder_id IS NULL AND NEW.bidder_user_id IS NOT NULL THEN
    NEW.bidder_id := NEW.bidder_user_id;
  END IF;
  IF NEW.bidder_user_id IS NULL AND NEW.bidder_id IS NOT NULL THEN
    NEW.bidder_user_id := NEW.bidder_id;
  END IF;
  IF NEW.bidder_id IS NOT NULL AND NEW.bidder_user_id IS NOT NULL
     AND NEW.bidder_id <> NEW.bidder_user_id THEN
    NEW.bidder_id := NEW.bidder_user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Returns (or auto-provisions) the company_id for the current user.
-- Fixes "Company profile not loaded yet" for first-time users.
CREATE OR REPLACE FUNCTION public.get_or_create_company_for_user()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company_id uuid;
  v_user_id    uuid := auth.uid();
  v_user_email text;
BEGIN
  SELECT company_id INTO v_company_id
  FROM public.company_memberships
  WHERE user_id = v_user_id AND status <> 'suspended'
  LIMIT 1;
  IF v_company_id IS NOT NULL THEN RETURN v_company_id; END IF;

  SELECT id INTO v_company_id
  FROM public.companies WHERE created_by = v_user_id LIMIT 1;
  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status)
    VALUES (v_company_id, v_user_id, 'owner', 'active')
    ON CONFLICT (company_id, user_id) DO UPDATE SET status = 'active', role_in_company = 'owner';
    RETURN v_company_id;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  INSERT INTO public.companies (name, email, created_by)
  VALUES (COALESCE(v_user_email, 'My Company'), v_user_email, v_user_id)
  RETURNING id INTO v_company_id;
  INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status)
  VALUES (v_company_id, v_user_id, 'owner', 'active');
  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_company_for_user() TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- 6. TRIGGERS
-- ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_job_bid_price ON public.job_bids;
CREATE TRIGGER trg_sync_job_bid_price
  BEFORE INSERT OR UPDATE ON public.job_bids
  FOR EACH ROW EXECUTE FUNCTION public.sync_job_bid_price();

-- ──────────────────────────────────────────────────────────────
-- 7. BACKFILL alias columns in job_bids
-- ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  UPDATE public.job_bids SET bid_price_gbp = amount
  WHERE bid_price_gbp IS NULL AND amount IS NOT NULL;
  UPDATE public.job_bids SET bidder_id = bidder_user_id
  WHERE bidder_id IS NULL AND bidder_user_id IS NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY — enable on all tables
-- ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER TABLE public.profiles                  ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.companies                 ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.company_memberships       ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.drivers                   ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.vehicles                  ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.driver_documents          ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.vehicle_documents         ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.jobs                      ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.job_documents             ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.job_notes                 ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.job_tracking_events       ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.job_bids                  ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.driver_locations          ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.job_driver_distance_cache ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.quotes                    ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.diary_events              ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.return_journeys           ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────
-- 9. RLS POLICIES
-- ──────────────────────────────────────────────────────────────
DO $$
BEGIN

  -- profiles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_own') THEN
    CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_own') THEN
    CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());
  END IF;

  -- companies (fixed: SELECT by creator OR non-suspended member)
  DROP POLICY IF EXISTS "companies_select_member" ON public.companies;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='companies_select_member_or_creator') THEN
    CREATE POLICY "companies_select_member_or_creator" ON public.companies FOR SELECT
      USING (created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.company_memberships
        WHERE company_id = id AND user_id = auth.uid() AND status <> 'suspended'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='companies_insert_admin') THEN
    CREATE POLICY "companies_insert_admin" ON public.companies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='companies_update_admin') THEN
    CREATE POLICY "companies_update_admin" ON public.companies FOR UPDATE USING (public.is_company_admin(id));
  END IF;

  -- company_memberships (fixed: SELECT own row by user_id)
  DROP POLICY IF EXISTS "memberships_select_member" ON public.company_memberships;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_memberships' AND policyname='memberships_select_own') THEN
    CREATE POLICY "memberships_select_own" ON public.company_memberships FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_memberships' AND policyname='memberships_insert_admin') THEN
    CREATE POLICY "memberships_insert_admin" ON public.company_memberships FOR INSERT WITH CHECK (public.is_company_admin(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_memberships' AND policyname='memberships_update_admin') THEN
    CREATE POLICY "memberships_update_admin" ON public.company_memberships FOR UPDATE USING (public.is_company_admin(company_id));
  END IF;

  -- drivers
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='drivers' AND policyname='drivers_select_member') THEN
    CREATE POLICY "drivers_select_member" ON public.drivers FOR SELECT USING (public.is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='drivers' AND policyname='drivers_all_admin') THEN
    CREATE POLICY "drivers_all_admin" ON public.drivers FOR ALL USING (public.is_company_admin(company_id));
  END IF;

  -- vehicles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' AND policyname='vehicles_select_member') THEN
    CREATE POLICY "vehicles_select_member" ON public.vehicles FOR SELECT USING (public.is_company_member(company_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' AND policyname='vehicles_all_admin') THEN
    CREATE POLICY "vehicles_all_admin" ON public.vehicles FOR ALL USING (public.is_company_admin(company_id));
  END IF;

  -- driver_documents
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_documents' AND policyname='driver_docs_select_member') THEN
    CREATE POLICY "driver_docs_select_member" ON public.driver_documents FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND public.is_company_member(d.company_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_documents' AND policyname='driver_docs_all_admin') THEN
    CREATE POLICY "driver_docs_all_admin" ON public.driver_documents FOR ALL
      USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND public.is_company_admin(d.company_id)));
  END IF;

  -- vehicle_documents
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicle_documents' AND policyname='vehicle_docs_select_member') THEN
    CREATE POLICY "vehicle_docs_select_member" ON public.vehicle_documents FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.is_company_member(v.company_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicle_documents' AND policyname='vehicle_docs_all_admin') THEN
    CREATE POLICY "vehicle_docs_all_admin" ON public.vehicle_documents FOR ALL
      USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.is_company_admin(v.company_id)));
  END IF;

  -- jobs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs' AND policyname='jobs_all_member') THEN
    CREATE POLICY "jobs_all_member" ON public.jobs FOR ALL USING (public.is_company_member(company_id));
  END IF;

  -- job_documents
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_documents' AND policyname='job_documents_all_member') THEN
    CREATE POLICY "job_documents_all_member" ON public.job_documents FOR ALL
      USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.is_company_member(j.company_id)));
  END IF;

  -- job_notes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_notes' AND policyname='job_notes_all_member') THEN
    CREATE POLICY "job_notes_all_member" ON public.job_notes FOR ALL USING (public.is_company_member(company_id));
  END IF;

  -- job_tracking_events
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_tracking_events' AND policyname='job_tracking_all_member') THEN
    CREATE POLICY "job_tracking_all_member" ON public.job_tracking_events FOR ALL
      USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.is_company_member(j.company_id)));
  END IF;

  -- job_bids
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_bids' AND policyname='bids_all_member') THEN
    CREATE POLICY "bids_all_member" ON public.job_bids FOR ALL
      USING (company_id IS NULL OR public.is_company_member(company_id));
  END IF;

  -- driver_locations
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='driver_locations' AND policyname='driver_locations_all_member') THEN
    CREATE POLICY "driver_locations_all_member" ON public.driver_locations FOR ALL
      USING (company_id IS NULL OR public.is_company_member(company_id));
  END IF;

  -- job_driver_distance_cache
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_driver_distance_cache' AND policyname='distance_cache_all_member') THEN
    CREATE POLICY "distance_cache_all_member" ON public.job_driver_distance_cache FOR ALL
      USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.is_company_member(j.company_id)));
  END IF;

  -- quotes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='quotes_all_member') THEN
    CREATE POLICY "quotes_all_member" ON public.quotes FOR ALL USING (public.is_company_member(company_id));
  END IF;

  -- diary_events
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='diary_events' AND policyname='diary_events_all_member') THEN
    CREATE POLICY "diary_events_all_member" ON public.diary_events FOR ALL USING (public.is_company_member(company_id));
  END IF;

  -- return_journeys
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='return_journeys' AND policyname='return_journeys_all_member') THEN
    CREATE POLICY "return_journeys_all_member" ON public.return_journeys FOR ALL USING (public.is_company_member(company_id));
  END IF;

END $$;

-- ──────────────────────────────────────────────────────────────
-- 10. INDEXES
-- ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS jobs_company_id_idx              ON public.jobs (company_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx                  ON public.jobs (status);
CREATE INDEX IF NOT EXISTS jobs_created_at_idx              ON public.jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS job_notes_job_id_idx             ON public.job_notes (job_id);
CREATE INDEX IF NOT EXISTS job_notes_company_id_idx         ON public.job_notes (company_id);
CREATE INDEX IF NOT EXISTS job_bids_job_id_idx              ON public.job_bids (job_id);
CREATE INDEX IF NOT EXISTS job_bids_company_id_idx          ON public.job_bids (company_id);
CREATE INDEX IF NOT EXISTS job_bids_bidder_id_idx           ON public.job_bids (bidder_id);
CREATE INDEX IF NOT EXISTS job_tracking_events_job_id_idx   ON public.job_tracking_events (job_id);
CREATE INDEX IF NOT EXISTS driver_locations_driver_id_idx   ON public.driver_locations (driver_id);
CREATE INDEX IF NOT EXISTS quotes_company_id_idx            ON public.quotes (company_id);
CREATE INDEX IF NOT EXISTS quotes_status_idx                ON public.quotes (status);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx            ON public.quotes (created_at DESC);
CREATE INDEX IF NOT EXISTS drivers_company_id_idx           ON public.drivers (company_id);
CREATE INDEX IF NOT EXISTS vehicles_company_id_idx          ON public.vehicles (company_id);
CREATE INDEX IF NOT EXISTS diary_events_company_id_idx      ON public.diary_events (company_id);
CREATE INDEX IF NOT EXISTS diary_events_start_at_idx        ON public.diary_events (start_at);
CREATE INDEX IF NOT EXISTS return_journeys_company_id_idx   ON public.return_journeys (company_id);

COMMIT;
```

> ✅ **Rezultat așteptat:** `Success. No rows returned`

---

## Instrucțiuni detaliate (metodă alternativă)

Urmărește pașii de mai jos **în ordine** pentru a verifica și aplica schema.

---

## PASUL 1 — Deschide Supabase SQL Editor

1. Mergi la [https://app.supabase.com](https://app.supabase.com)
2. Selectează proiectul **Danny Courier Ltd**
3. În meniul din stânga, apasă pe **SQL Editor**

---

## PASUL 2 — Rulează Health Check (verificare ce lipsește)

Copiază scriptul de mai jos în SQL Editor și apasă **Run**.
Acesta este *read-only* — nu modifică nimic, doar raportează ce lipsește.

```sql
-- ============================================================
-- Danny Courier Ltd — SCHEMA HEALTH CHECK (read-only)
-- ============================================================

-- 1) TABELE LIPSĂ
SELECT 'TABEL LIPSĂ' AS problema, t AS tabel
FROM (VALUES
  ('profiles'), ('companies'), ('company_memberships'),
  ('drivers'), ('vehicles'), ('driver_documents'), ('vehicle_documents'),
  ('jobs'), ('job_documents'), ('job_notes'), ('job_tracking_events'),
  ('job_bids'), ('driver_locations'), ('job_driver_distance_cache'),
  ('quotes'), ('diary_events'), ('return_journeys')
) AS necesar(t)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = t
);

-- 2) COLOANE LIPSĂ PE TABELE EXISTENTE
SELECT 'COLOANĂ LIPSĂ' AS problema, c.tabel, c.coloana
FROM (VALUES
  ('profiles',            'email'),
  ('profiles',            'role'),
  ('profiles',            'company_id'),
  ('companies',           'address_line1'),
  ('companies',           'status'),
  ('companies',           'company_type'),
  ('jobs',                'distance_to_pickup_miles'),
  ('job_bids',            'amount'),
  ('job_bids',            'bid_price_gbp'),
  ('job_bids',            'bidder_user_id'),
  ('job_bids',            'bidder_id'),
  ('driver_locations',    'company_id'),
  ('driver_locations',    'updated_at'),
  ('quotes',              'vehicle_type'),
  ('quotes',              'cargo_type'),
  ('quotes',              'currency'),
  ('quotes',              'status'),
  ('return_journeys',     'status'),
  ('job_notes',           'id')
) AS c(tabel, coloana)
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = c.tabel
)
AND NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = c.tabel
    AND column_name  = c.coloana
);

-- 3) TIPURI ENUM LIPSĂ
SELECT 'ENUM LIPSĂ' AS problema, e AS tip_enum
FROM (VALUES
  ('company_role'), ('membership_status'), ('doc_status'),
  ('job_status'), ('cargo_type'), ('vehicle_type'), ('tracking_event_type')
) AS e(e)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_type
  WHERE typname = e
    AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
);

-- 4) FUNCȚII LIPSĂ
SELECT 'FUNCȚIE LIPSĂ' AS problema, f AS functie
FROM (VALUES
  ('is_company_member'), ('is_company_admin'), ('sync_job_bid_price')
) AS f(f)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = f
);

-- 5) RLS STATUS
SELECT tablename,
       CASE WHEN rowsecurity THEN '✅ RLS ACTIV' ELSE '❌ RLS INACTIV' END AS stare_rls
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles','companies','company_memberships','drivers','vehicles',
    'driver_documents','vehicle_documents','jobs','job_documents',
    'job_notes','job_tracking_events','job_bids','driver_locations',
    'job_driver_distance_cache','quotes','diary_events','return_journeys'
  )
ORDER BY tablename;

-- 6) REZULTAT FINAL
SELECT 'VERIFICARE COMPLETĂ' AS status,
       'Sănătos = secțiunile 1-5 și 7 returnează 0 rânduri; secțiunea 6 arată RLS ACTIV.' AS nota;
```

### ✅ Rezultat așteptat
- Secțiunile 1–5 și 7 trebuie să returneze **0 rânduri** (nimic lipsă).
- Secțiunea 6 trebuie să arate **✅ RLS ACTIV** pentru toate tabelele.

---

## PASUL 3 — Aplică Schema Completă (dacă lipsesc tabele / coloane)

Dacă Health Check-ul de la Pasul 2 a găsit probleme, folosește scriptul complet de la **secțiunea ⚡ Metoda rapidă** de la începutul acestui fișier (sau fișierul `supabase/migrations/011_complete_schema_v2.sql` din repository):

1. În SQL Editor, deschide un **New Query** (tab nou)
2. Copiază scriptul complet de la `supabase/migrations/011_complete_schema_v2.sql`
3. Lipește în SQL Editor
4. Apasă **Run**
5. Verifică că mesajul de jos afișează: **`Success. No rows returned`**
6. **Rulează din nou** Health Check (scriptul din `007_verify_schema.sql`) pentru a confirma că totul este în regulă — secțiunile 1–5 și 7 trebuie să returneze 0 rânduri

---

## PASUL 4 — Instrucțiuni pentru Asistentul AI Supabase

Dacă folosești Asistentul AI din Supabase (butonul **Ask AI** din SQL Editor), trimite-i următorul prompt:

---

> **Prompt pentru Asistentul Supabase:**
>
> Verifica schema bazei de date publice si asigura-te ca urmatoarele tabele exista cu toate coloanele necesare:
>
> **Tabele necesare:**
> `profiles`, `companies`, `company_memberships`, `drivers`, `vehicles`,
> `driver_documents`, `vehicle_documents`, `jobs`, `job_documents`, `job_notes`,
> `job_tracking_events`, `job_bids`, `driver_locations`, `job_driver_distance_cache`,
> `quotes`, `diary_events`, `return_journeys`
>
> **Tipuri enum necesare:**
> `company_role` ('owner','admin','dispatcher','viewer'),
> `membership_status` ('invited','active','suspended'),
> `doc_status` ('pending','approved','rejected','expired'),
> `job_status` ('draft','posted','allocated','in_transit','delivered','cancelled','disputed'),
> `cargo_type` ('documents','packages','pallets','furniture','equipment','other'),
> `vehicle_type` ('bicycle','motorbike','car','van_small','van_large','luton','truck_7_5t','truck_18t','artic'),
> `tracking_event_type` ('created','allocated','driver_en_route','arrived_pickup','collected','in_transit','arrived_delivery','delivered','failed','cancelled','note')
>
> **Coloane critice de verificat:**
> - `quotes` trebuie sa aiba: `vehicle_type`, `cargo_type`, `currency`, `status`
> - `profiles` trebuie sa aiba: `email`, `role`, `company_id`
> - `companies` trebuie sa aiba: `address_line1`, `address_line2`, `city`, `postcode`, `status`, `company_type`
> - `jobs` trebuie sa aiba: `distance_to_pickup_miles`
> - `job_bids` trebuie sa aiba: `amount`, `bid_price_gbp`, `bidder_user_id`, `bidder_id`
> - `driver_locations` trebuie sa aiba: `company_id`, `updated_at`
> - `return_journeys` trebuie sa aiba: `status`
>
> **Functii necesare:**
> - `public.is_company_member(cid uuid) RETURNS boolean SECURITY DEFINER`
> - `public.is_company_admin(cid uuid) RETURNS boolean SECURITY DEFINER`
>
> **Row Level Security:**
> - RLS activat pe toate tabelele de mai sus
> - Politici bazate pe `is_company_member()` si `is_company_admin()`
>
> Genereaza un script SQL idempotent (folosind IF NOT EXISTS si ADD COLUMN IF NOT EXISTS) care creeaza ce lipseste fara sa stearga date existente.

---

## PASUL 5 — Verificare finală

După aplicarea schemei, rulează din nou Health Check (Pasul 2).
Toate secțiunile 1–4 trebuie să returneze **0 rânduri**.

---

## 🔧 Patch rapid pentru baze de date existente (Migrare 012)

Dacă ai rulat deja `011_complete_schema_v2.sql` și job-urile tot nu se pot posta / statusul revine după refresh, rulează și acest script mic:

```sql
-- ============================================================
-- 012_fix_is_company_member.sql
-- Fix postare job-uri blocată silențios de RLS:
--   is_company_member() cerea status = 'active', dar utilizatorii
--   noi aveau status = 'invited' → INSERT/UPDATE pe jobs respins.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE  company_id = cid
      AND  user_id    = auth.uid()
      AND  status    <> 'suspended'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE  company_id      = cid
      AND  user_id         = auth.uid()
      AND  status         <> 'suspended'
      AND  role_in_company IN ('owner', 'admin')
  );
$$;

COMMIT;
```

---

## Structura completă a bazei de date

```
public
├── Enums
│   ├── company_role
│   ├── membership_status
│   ├── doc_status
│   ├── job_status
│   ├── cargo_type
│   ├── vehicle_type
│   └── tracking_event_type
│
├── Tables
│   ├── companies           ← firma (multi-tenant root)
│   ├── profiles            ← utilizatori extinsi din auth.users
│   ├── company_memberships ← cine face parte din ce firma
│   ├── drivers             ← soferi
│   ├── vehicles            ← vehicule
│   ├── driver_documents    ← documente sofer (permis, etc.)
│   ├── vehicle_documents   ← documente vehicul (RCA, ITP, etc.)
│   ├── jobs                ← curse / livrari
│   ├── job_documents       ← documente atasate la cursa
│   ├── job_notes           ← note interne pe cursa
│   ├── job_tracking_events ← istoricul statusului cursei
│   ├── job_bids            ← oferte de pret pentru curse
│   ├── driver_locations    ← locatia live a soferilor
│   ├── job_driver_distance_cache ← cache distante sofer-cursa
│   ├── quotes              ← oferte de pret pentru clienti
│   ├── diary_events        ← planificator / agenda
│   └── return_journeys     ← curse de intoarcere disponibile
│
├── Functions
│   ├── is_company_member(uuid) → boolean
│   ├── is_company_admin(uuid)  → boolean
│   ├── sync_job_bid_price()    → trigger function
│   └── get_or_create_company_for_user() → uuid
│
└── Triggers
    └── trg_sync_job_bid_price  (on job_bids)
```

---

## Fișiere relevante în repository

| Fișier | Descriere |
|--------|-----------|
| `supabase/migrations/011_complete_schema_v2.sql` | **⭐ Schema completă v2** — cel mai recent, include toate fix-urile |
| `supabase/migrations/012_fix_is_company_member.sql` | **⭐ Patch pentru DB-uri existente** — fix postare job-uri (RLS blocat) |
| `supabase/migrations/007_verify_schema.sql` | **Health check** — verifică ce lipsește |
| `supabase/migrations/006_complete_schema.sql` | Schema completă v1 (versiune anterioară) |
| `supabase/migrations/010_fix_company_profile_loading.sql` | Fix RLS pentru eroarea "Company profile not loaded" |
