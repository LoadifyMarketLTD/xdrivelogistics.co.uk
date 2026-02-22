-- ============================================================
-- Danny Courier Ltd — Auto-Fix / Migration
-- Fully STANDALONE and idempotent.
-- Safe to run on a completely fresh database OR on top of an
-- existing schema — creates what is missing, adds columns that
-- are absent, never drops or renames existing data.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────
-- 0) ENUMS — create if they do not exist yet
-- ──────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.company_role AS ENUM ('owner', 'admin', 'dispatcher', 'viewer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.membership_status AS ENUM ('invited', 'active', 'suspended');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.doc_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.job_status AS ENUM ('draft', 'posted', 'allocated', 'in_transit', 'delivered', 'cancelled', 'disputed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cargo_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.cargo_type AS ENUM ('documents', 'packages', 'pallets', 'furniture', 'equipment', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.vehicle_type AS ENUM ('bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'luton', 'truck_7_5t', 'truck_18t', 'artic');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tracking_event_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.tracking_event_type AS ENUM ('created', 'allocated', 'driver_en_route', 'arrived_pickup', 'collected', 'in_transit', 'arrived_delivery', 'delivered', 'failed', 'cancelled', 'note');
  END IF;
END
$$;

-- ──────────────────────────────────────────────
-- 1) CORE TABLES — create if missing
--    (dependency order: companies → profiles,
--     memberships, drivers, vehicles → jobs, etc.)
-- ──────────────────────────────────────────────

-- Companies (no FK deps on other public tables)
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
  country        text DEFAULT 'UK',
  status         text DEFAULT 'active',
  company_type   text DEFAULT 'standard',
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz DEFAULT now()
);

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text,
  phone      text,
  email      text,
  role       text DEFAULT 'viewer',
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  is_driver  boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Company memberships
CREATE TABLE IF NOT EXISTS public.company_memberships (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email   text,
  role_in_company public.company_role DEFAULT 'viewer',
  status          public.membership_status DEFAULT 'invited',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (company_id, user_id),
  UNIQUE (company_id, invited_email)
);

-- Drivers
CREATE TABLE IF NOT EXISTS public.drivers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  phone        text,
  email        text,
  status       text DEFAULT 'active',
  created_at   timestamptz DEFAULT now()
);

-- Vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assigned_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
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

-- Driver documents
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id        uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
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

-- Vehicle documents
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

-- Jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by               uuid REFERENCES auth.users(id),
  status                   public.job_status DEFAULT 'draft',
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
  currency                 text DEFAULT 'GBP',
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

-- Job documents
CREATE TABLE IF NOT EXISTS public.job_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id),
  doc_type    text DEFAULT 'other',
  file_path   text,
  created_at  timestamptz DEFAULT now()
);

-- Job tracking events
CREATE TABLE IF NOT EXISTS public.job_tracking_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_by  uuid REFERENCES auth.users(id),
  event_type  public.tracking_event_type NOT NULL,
  message     text,
  meta        jsonb,
  created_at  timestamptz DEFAULT now()
);

-- Job bids
CREATE TABLE IF NOT EXISTS public.job_bids (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id      uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  bidder_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  bidder_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  bidder_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount          numeric(12,2),
  bid_price_gbp   numeric(12,2),
  currency        text DEFAULT 'GBP',
  message         text,
  status          text DEFAULT 'submitted',
  created_at      timestamptz DEFAULT now()
);

-- Driver locations
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  company_id  uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  heading     int,
  speed_mph   numeric,
  updated_at  timestamptz DEFAULT now(),
  recorded_at timestamptz DEFAULT now()
);

-- Job driver distance cache
CREATE TABLE IF NOT EXISTS public.job_driver_distance_cache (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  driver_id        uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  miles_to_pickup  numeric,
  minutes_to_pickup int,
  computed_at      timestamptz DEFAULT now(),
  UNIQUE (job_id, driver_id)
);

-- Quotes
CREATE TABLE IF NOT EXISTS public.quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES auth.users(id),
  customer_name   text,
  customer_email  text,
  customer_phone  text,
  pickup_location text,
  delivery_location text,
  vehicle_type    public.vehicle_type,
  cargo_type      public.cargo_type,
  amount          numeric,
  currency        text DEFAULT 'GBP',
  status          text DEFAULT 'draft',
  created_at      timestamptz DEFAULT now()
);

-- Diary events
CREATE TABLE IF NOT EXISTS public.diary_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id  uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  title      text NOT NULL,
  start_at   timestamptz NOT NULL,
  end_at     timestamptz,
  meta       jsonb,
  created_at timestamptz DEFAULT now()
);

-- Return journeys
CREATE TABLE IF NOT EXISTS public.return_journeys (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id      uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_type   public.vehicle_type,
  from_postcode  text,
  to_postcode    text,
  available_from timestamptz,
  available_to   timestamptz,
  notes          text,
  status         text DEFAULT 'available',
  created_at     timestamptz DEFAULT now()
);

-- Job notes (new table — was missing entirely)
CREATE TABLE IF NOT EXISTS public.job_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 2) ADD MISSING COLUMNS to tables that existed
--    before this migration (fully idempotent).
--    Each block catches undefined_table (42P01)
--    so it is a safe no-op when the table was
--    freshly created with all columns in step 1.
-- ──────────────────────────────────────────────

-- Profiles
DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email      text,
    ADD COLUMN IF NOT EXISTS role       text DEFAULT 'viewer',
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END
$$;

-- Companies
DO $$
BEGIN
  ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS address_line1 text,
    ADD COLUMN IF NOT EXISTS address_line2 text,
    ADD COLUMN IF NOT EXISTS city          text,
    ADD COLUMN IF NOT EXISTS postcode      text,
    ADD COLUMN IF NOT EXISTS status        text DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS company_type  text DEFAULT 'standard';
EXCEPTION WHEN undefined_table THEN NULL;
END
$$;

-- Jobs
DO $$
BEGIN
  ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS distance_to_pickup_miles numeric;
EXCEPTION WHEN undefined_table THEN NULL;
END
$$;

-- Job documents
DO $$
BEGIN
  ALTER TABLE public.job_documents
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
EXCEPTION WHEN undefined_table THEN NULL;
END
$$;

-- Job bids — add alias columns + ensure core columns exist
DO $$
BEGIN
  ALTER TABLE public.job_bids
    ADD COLUMN IF NOT EXISTS amount          numeric(12,2),
    ADD COLUMN IF NOT EXISTS bidder_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS bid_price_gbp   numeric(12,2),
    ADD COLUMN IF NOT EXISTS bidder_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END
$$;

-- Driver locations
DO $$
BEGIN
  ALTER TABLE public.driver_locations
    ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
EXCEPTION WHEN undefined_table THEN NULL;
END
$$;

-- Return journeys
DO $$
BEGIN
  ALTER TABLE public.return_journeys
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'available';
EXCEPTION WHEN undefined_table THEN NULL;
END
$$;

-- ──────────────────────────────────────────────
-- 3) UNIQUE CONSTRAINT on company_memberships
-- ──────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema    = ccu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema    = 'public'
      AND tc.table_name      = 'company_memberships'
      AND ccu.column_name    = 'user_id'
  ) THEN
    ALTER TABLE public.company_memberships
      ADD CONSTRAINT company_memberships_company_id_user_id_key
      UNIQUE (company_id, user_id);
  END IF;
END
$$;

-- ──────────────────────────────────────────────
-- 4) BACKFILL alias columns in job_bids
-- ──────────────────────────────────────────────
DO $$
BEGIN
  UPDATE public.job_bids
  SET bid_price_gbp = amount
  WHERE bid_price_gbp IS NULL AND amount IS NOT NULL;

  UPDATE public.job_bids
  SET bidder_id = bidder_user_id
  WHERE bidder_id IS NULL AND bidder_user_id IS NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END
$$;

-- ──────────────────────────────────────────────
-- 5) HELPER FUNCTIONS (idempotent via CREATE OR REPLACE)
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = cid AND user_id = auth.uid() AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(cid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = cid AND user_id = auth.uid() AND status = 'active'
      AND role_in_company IN ('owner', 'admin')
  );
$$;

-- Trigger function: keep bid_price_gbp / amount and bidder_id / bidder_user_id in sync
CREATE OR REPLACE FUNCTION public.sync_job_bid_price()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.bid_price_gbp IS NOT NULL AND NEW.amount IS NOT NULL
     AND NEW.bid_price_gbp <> NEW.amount THEN
    RAISE WARNING 'job_bids: bid_price_gbp (%) and amount (%) differ — using bid_price_gbp',
                  NEW.bid_price_gbp, NEW.amount;
    NEW.amount := NEW.bid_price_gbp;
  END IF;
  IF NEW.bid_price_gbp IS NULL AND NEW.amount IS NOT NULL THEN
    NEW.bid_price_gbp := NEW.amount;
  END IF;
  IF NEW.amount IS NULL AND NEW.bid_price_gbp IS NOT NULL THEN
    NEW.amount := NEW.bid_price_gbp;
  END IF;
  IF NEW.bidder_id IS NOT NULL AND NEW.bidder_user_id IS NOT NULL
     AND NEW.bidder_id <> NEW.bidder_user_id THEN
    RAISE WARNING 'job_bids: bidder_id (%) and bidder_user_id (%) differ — using bidder_user_id',
                  NEW.bidder_id, NEW.bidder_user_id;
    NEW.bidder_id := NEW.bidder_user_id;
  END IF;
  IF NEW.bidder_id IS NULL AND NEW.bidder_user_id IS NOT NULL THEN
    NEW.bidder_id := NEW.bidder_user_id;
  END IF;
  IF NEW.bidder_user_id IS NULL AND NEW.bidder_id IS NOT NULL THEN
    NEW.bidder_user_id := NEW.bidder_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────
-- 6) TRIGGERS
-- ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_job_bid_price ON public.job_bids;
CREATE TRIGGER trg_sync_job_bid_price
  BEFORE INSERT OR UPDATE ON public.job_bids
  FOR EACH ROW EXECUTE FUNCTION public.sync_job_bid_price();

-- ──────────────────────────────────────────────
-- 7) ENABLE ROW LEVEL SECURITY
-- ──────────────────────────────────────────────
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
END
$$;

-- ──────────────────────────────────────────────
-- 8) RLS POLICIES (create only if absent)
-- ──────────────────────────────────────────────
DO $$
BEGIN
  -- profiles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_own') THEN
    CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_own') THEN
    CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());
  END IF;

  -- companies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='companies_select_member') THEN
    CREATE POLICY "companies_select_member" ON public.companies FOR SELECT USING (public.is_company_member(id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='companies_insert_admin') THEN
    CREATE POLICY "companies_insert_admin" ON public.companies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='companies' AND policyname='companies_update_admin') THEN
    CREATE POLICY "companies_update_admin" ON public.companies FOR UPDATE USING (public.is_company_admin(id));
  END IF;

  -- company_memberships
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_memberships' AND policyname='memberships_select_member') THEN
    CREATE POLICY "memberships_select_member" ON public.company_memberships FOR SELECT USING (public.is_company_member(company_id));
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

  -- job_bids
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_bids' AND policyname='bids_all_member') THEN
    CREATE POLICY "bids_all_member" ON public.job_bids FOR ALL
      USING (company_id IS NULL OR public.is_company_member(company_id));
  END IF;

  -- job_notes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_notes' AND policyname='job_notes_all_member') THEN
    CREATE POLICY "job_notes_all_member" ON public.job_notes FOR ALL
      USING (public.is_company_member(company_id));
  END IF;

  -- quotes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='quotes_all_member') THEN
    CREATE POLICY "quotes_all_member" ON public.quotes FOR ALL USING (public.is_company_member(company_id));
  END IF;
END
$$;

-- ──────────────────────────────────────────────
-- 9) INDEXES (all idempotent via IF NOT EXISTS)
-- ──────────────────────────────────────────────
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

COMMIT;
