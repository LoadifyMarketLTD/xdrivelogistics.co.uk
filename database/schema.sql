-- =====================================================
-- XDrive Logistics Ltd - Consolidated Database Schema
-- =====================================================
-- Run this in the Supabase SQL editor to set up the
-- complete database from scratch.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- â”€â”€ Enums â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TYPE public.company_role AS ENUM ('owner', 'admin', 'dispatcher', 'viewer');
CREATE TYPE public.membership_status AS ENUM ('invited', 'active', 'suspended');
CREATE TYPE public.doc_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
CREATE TYPE public.job_status AS ENUM (
  'draft',
  'posted',
  'quoted',
  'awarded',
  'allocated',
  'collected',
  'in_transit',
  'delivered',
  'invoiced',
  'paid',
  'cancelled',
  'disputed'
);
CREATE TYPE public.cargo_type AS ENUM ('documents', 'packages', 'pallets', 'furniture', 'equipment', 'other');
CREATE TYPE public.vehicle_type AS ENUM ('bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'luton', 'truck_7_5t', 'truck_18t', 'artic');
CREATE TYPE public.tracking_event_type AS ENUM ('created', 'allocated', 'driver_en_route', 'arrived_pickup', 'collected', 'in_transit', 'arrived_delivery', 'delivered', 'failed', 'cancelled', 'note');

-- â”€â”€ Profiles (extends auth.users) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.profiles (
  user_id       uuid        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text,
  phone         text,
  email         text,
  role          text,
  status        text        NOT NULL DEFAULT 'active',
  company_id    uuid,
  is_driver     boolean     DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT profiles_role_canonical CHECK (role IS NULL OR role IN ('owner', 'admin', 'company', 'driver', 'customer'))
);

-- â”€â”€ Companies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.companies (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  company_number  text,
  vat_number      text,
  email           text,
  phone           text,
  address_line1   text,
  address_line2   text,
  city            text,
  postcode        text,
  country         text        DEFAULT 'UK',
  status          text        DEFAULT 'active',
  company_type    text,
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

-- â”€â”€ Company settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.company_settings (
  company_id                   uuid        PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  legal_name                   text,
  job_ref_prefix               text,
  invoice_prefix               text,
  default_vat_rate             int         DEFAULT 20,
  default_payment_terms        text        DEFAULT '14 days',
  currency                     text        DEFAULT 'GBP',
  date_format                  text        DEFAULT 'DD/MM/YYYY',
  bank_account_name            text,
  bank_sort_code               text,
  bank_account_number          text,
  paypal_email                 text,
  notify_email_new_job         boolean     DEFAULT true,
  notify_email_status_change   boolean     DEFAULT true,
  notify_email_invoice_paid    boolean     DEFAULT true,
  notify_email_bid_received    boolean     DEFAULT false,
  updated_by                   uuid        REFERENCES auth.users(id),
  created_at                   timestamptz DEFAULT now(),
  updated_at                   timestamptz DEFAULT now()
);

-- â”€â”€ Company memberships â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.company_memberships (
  id              uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid               NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         uuid               REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email   text,
  role_in_company public.company_role DEFAULT 'viewer',
  status          public.membership_status DEFAULT 'invited',
  created_at      timestamptz        DEFAULT now(),
  updated_at      timestamptz        DEFAULT now(),
  UNIQUE(company_id, user_id),
  UNIQUE(company_id, invited_email)
);

CREATE SEQUENCE IF NOT EXISTS public.driver_temp_password_seq START WITH 1 INCREMENT BY 1;

-- â”€â”€ Drivers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.drivers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name    text        NOT NULL,
  phone           text,
  email           text,
  status          text        DEFAULT 'active',
  login_pin       text,
  app_access      boolean     NOT NULL DEFAULT false,
  temporary_password_seq integer DEFAULT nextval('public.driver_temp_password_seq'),
  must_change_password boolean NOT NULL DEFAULT false,
  temp_password_generated_at timestamptz,
  last_app_login  timestamptz,
  device_token    text,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT drivers_temporary_password_seq_unique UNIQUE (temporary_password_seq)
);

-- â”€â”€ Vehicles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.vehicles (
  id                  uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid               NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assigned_driver_id  uuid               REFERENCES public.drivers(id) ON DELETE SET NULL,
  type                public.vehicle_type NOT NULL,
  reg_plate           text,
  make                text,
  model               text,
  payload_kg          numeric,
  pallets_capacity    int,
  has_tail_lift       boolean            DEFAULT false,
  has_straps          boolean            DEFAULT false,
  has_blankets        boolean            DEFAULT false,
  created_at          timestamptz        DEFAULT now()
);

-- â”€â”€ Driver documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.driver_documents (
  id                uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         uuid               NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  doc_type          text               NOT NULL,
  file_path         text,
  issued_date       date,
  expiry_date       date,
  status            public.doc_status  DEFAULT 'pending',
  rejection_reason  text,
  verified_by       uuid               REFERENCES auth.users(id),
  verified_at       timestamptz,
  created_at        timestamptz        DEFAULT now()
);

-- â”€â”€ Vehicle documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.vehicle_documents (
  id                uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id        uuid               NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  doc_type          text               NOT NULL,
  file_path         text,
  issued_date       date,
  expiry_date       date,
  status            public.doc_status  DEFAULT 'pending',
  rejection_reason  text,
  verified_by       uuid               REFERENCES auth.users(id),
  verified_at       timestamptz,
  created_at        timestamptz        DEFAULT now()
);

-- â”€â”€ Jobs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.jobs (
  id                        uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                uuid               NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by                uuid               REFERENCES auth.users(id),
  assigned_driver_id        uuid               REFERENCES public.drivers(id) ON DELETE SET NULL,
  driver_id                 uuid               REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id                uuid               REFERENCES public.vehicles(id) ON DELETE SET NULL,
  status                    public.job_status  DEFAULT 'draft',
  vehicle_type              public.vehicle_type,
  cargo_type                public.cargo_type,
  pickup_location           text,
  pickup_postcode           text,
  pickup_lat                double precision,
  pickup_lng                double precision,
  pickup_datetime           timestamptz,
  delivery_location         text,
  delivery_postcode         text,
  delivery_lat              double precision,
  delivery_lng              double precision,
  delivery_datetime         timestamptz,
  pallets                   int,
  boxes                     int,
  bags                      int,
  items                     int,
  weight_kg                 numeric,
  length_cm                 numeric,
  width_cm                  numeric,
  height_cm                 numeric,
  currency                  text               DEFAULT 'GBP',
  budget_amount             numeric,
  is_fixed_price            boolean            DEFAULT false,
  load_details              text,
  special_requirements      text,
  access_restrictions       text,
  job_distance_miles        numeric,
  job_distance_minutes      int,
  distance_to_pickup_miles  numeric,
  -- Driver app fields
  collection_photo_url      text,
  delivery_photos           text[],
  delivery_signature_data   text,
  status_history            jsonb              DEFAULT '[]'::jsonb,
  driver_notes              text,
  client_signature_name     text,
  created_at                timestamptz        DEFAULT now(),
  updated_at                timestamptz        DEFAULT now()
);

-- â”€â”€ Job documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.job_documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       uuid        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  uploaded_by  uuid        REFERENCES auth.users(id),
  doc_type     text        DEFAULT 'other',
  file_path    text,
  created_at   timestamptz DEFAULT now()
);

-- â”€â”€ Job tracking events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.job_tracking_events (
  id          uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid                       NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_by  uuid                       REFERENCES auth.users(id),
  event_type  public.tracking_event_type NOT NULL,
  message     text,
  meta        jsonb,
  created_at  timestamptz                DEFAULT now()
);

-- â”€â”€ Job bids â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.job_bids (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            uuid        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id        uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  bidder_user_id    uuid        NOT NULL REFERENCES auth.users(id),
  bidder_id         uuid,
  bidder_driver_id  uuid        REFERENCES public.drivers(id) ON DELETE SET NULL,
  amount            numeric     NOT NULL,
  bid_price_gbp     numeric,
  currency          text        DEFAULT 'GBP',
  message           text,
  status            text        DEFAULT 'submitted',
  created_at        timestamptz DEFAULT now(),
  CONSTRAINT job_bids_status_canonical CHECK (status IN ('submitted', 'accepted', 'rejected', 'withdrawn'))
);

-- â”€â”€ Driver locations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.driver_locations (
  id          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid             NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  company_id  uuid             REFERENCES public.companies(id) ON DELETE SET NULL,
  job_id      uuid             REFERENCES public.jobs(id) ON DELETE SET NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  heading     double precision,
  speed_mph   double precision,
  recorded_at timestamptz      NOT NULL DEFAULT now(),
  updated_at  timestamptz      NOT NULL DEFAULT now()
);

-- â”€â”€ Quotes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.quotes (
  id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid               NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by       uuid               REFERENCES auth.users(id),
  customer_name    text,
  customer_email   text,
  customer_phone   text,
  pickup_location  text,
  delivery_location text,
  vehicle_type     public.vehicle_type,
  cargo_type       public.cargo_type,
  amount           numeric,
  currency         text               DEFAULT 'GBP',
  status           text               DEFAULT 'draft',
  created_at       timestamptz        DEFAULT now()
);

-- â”€â”€ Invoices â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.invoices (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by          uuid        REFERENCES auth.users(id),
  invoice_number      text        NOT NULL,
  job_ref             text,
  job_id              uuid        REFERENCES public.jobs(id) ON DELETE SET NULL,
  invoice_date        date        DEFAULT CURRENT_DATE,
  due_date            date,
  status              text        DEFAULT 'Pending',
  client_name         text        NOT NULL,
  client_address      text,
  client_email        text,
  pickup_location     text,
  pickup_datetime     text,
  delivery_location   text,
  delivery_datetime   text,
  delivery_recipient  text,
  service_description text,
  amount              numeric     DEFAULT 0,
  net_amount          numeric     DEFAULT 0,
  vat_amount          numeric     DEFAULT 0,
  vat_rate            int         DEFAULT 20,
  currency            text        DEFAULT 'GBP',
  payment_terms       text        DEFAULT '14 days',
  late_fee            text,
  pod_photos          text[],
  signature           text,
  recipient_name      text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- â”€â”€ Diary events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.diary_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id   uuid        REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id  uuid        REFERENCES public.vehicles(id) ON DELETE SET NULL,
  title       text        NOT NULL,
  start_at    timestamptz NOT NULL,
  end_at      timestamptz,
  meta        jsonb,
  created_at  timestamptz DEFAULT now()
);

-- â”€â”€ Return journeys â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.return_journeys (
  id              uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid               NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id       uuid               REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_type    public.vehicle_type,
  from_postcode   text,
  to_postcode     text,
  available_from  timestamptz,
  available_to    timestamptz,
  notes           text,
  status          text               DEFAULT 'active',
  created_at      timestamptz        DEFAULT now()
);

-- â”€â”€ Job driver distance cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE public.job_driver_distance_cache (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  driver_id           uuid        NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  miles_to_pickup     numeric,
  minutes_to_pickup   int,
  computed_at         timestamptz DEFAULT now(),
  UNIQUE(job_id, driver_id)
);

CREATE OR REPLACE FUNCTION public.set_company_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER trg_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_company_settings_updated_at();

-- â”€â”€ Indexes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX idx_drivers_company_id      ON public.drivers(company_id);
CREATE INDEX idx_drivers_status          ON public.drivers(status);
CREATE INDEX idx_vehicles_company_id     ON public.vehicles(company_id);
CREATE INDEX idx_vehicles_driver_id      ON public.vehicles(assigned_driver_id);
CREATE INDEX idx_jobs_company_id         ON public.jobs(company_id);
CREATE INDEX idx_jobs_status             ON public.jobs(status);
CREATE INDEX idx_jobs_driver_id          ON public.jobs(driver_id);
CREATE INDEX idx_jobs_pickup_datetime    ON public.jobs(pickup_datetime);
CREATE INDEX idx_invoices_company_id     ON public.invoices(company_id);
CREATE INDEX idx_quotes_company_id       ON public.quotes(company_id);
CREATE INDEX idx_tracking_events_job_id  ON public.job_tracking_events(job_id);
CREATE INDEX idx_driver_locations_driver ON public.driver_locations(driver_id);
CREATE INDEX idx_driver_locations_time   ON public.driver_locations(recorded_at DESC);

-- â”€â”€ Row Level Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_tracking_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_bids             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_journeys      ENABLE ROW LEVEL SECURITY;

-- â”€â”€ Helper functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

CREATE OR REPLACE FUNCTION public.get_or_create_company_for_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_user_id    uuid := auth.uid();
  v_user_email text;
BEGIN
  SELECT company_id INTO v_company_id
  FROM public.company_memberships
  WHERE user_id = v_user_id
    AND status <> 'suspended'
  LIMIT 1;
  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

  SELECT id INTO v_company_id
  FROM public.companies
  WHERE created_by = v_user_id
  LIMIT 1;
  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status)
    VALUES (v_company_id, v_user_id, 'owner', 'active')
    ON CONFLICT (company_id, user_id) DO UPDATE
      SET status = 'active',
          role_in_company = 'owner';
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

CREATE OR REPLACE FUNCTION public.handle_auth_user_profile_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_role  text;
  v_role      text;
  v_full_name text;
  v_phone     text;
  v_is_driver boolean;
BEGIN
  v_raw_role := LOWER(COALESCE(
    NEW.raw_user_meta_data ->> 'role',
    NEW.raw_user_meta_data ->> 'requested_role',
    'customer'
  ));

  v_role := CASE v_raw_role
    WHEN 'owner'          THEN 'owner'
    WHEN 'superadmin'     THEN 'owner'
    WHEN 'super_admin'    THEN 'owner'
    WHEN 'platform_owner' THEN 'owner'
    WHEN 'admin'          THEN 'admin'
    WHEN 'company_admin'  THEN 'admin'
    WHEN 'org_admin'      THEN 'admin'
    WHEN 'platform_admin' THEN 'admin'
    WHEN 'company'        THEN 'company'
    WHEN 'dispatcher'     THEN 'company'
    WHEN 'company_staff'  THEN 'company'
    WHEN 'broker'         THEN 'company'
    WHEN 'freight_broker' THEN 'company'
    WHEN 'carrier'        THEN 'company'
    WHEN 'driver'         THEN 'driver'
    WHEN 'owner_driver'   THEN 'driver'
    WHEN 'customer'       THEN 'customer'
    WHEN 'shipper'        THEN 'customer'
    WHEN 'client'         THEN 'customer'
    WHEN 'viewer'         THEN 'customer'
    ELSE 'customer'
  END;

  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name'
  );
  v_phone := NEW.raw_user_meta_data ->> 'phone';
  v_is_driver := v_role = 'driver';

  INSERT INTO public.profiles (user_id, role, status, full_name, phone, is_driver, created_at, updated_at)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data ->> 'status', 'active'),
    v_full_name,
    v_phone,
    v_is_driver,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE
    SET role       = COALESCE(EXCLUDED.role, public.profiles.role),
        status     = COALESCE(EXCLUDED.status, public.profiles.status),
        full_name  = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        phone      = COALESCE(EXCLUDED.phone, public.profiles.phone),
        is_driver  = EXCLUDED.is_driver,
        updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;
CREATE TRIGGER on_auth_user_profile_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_profile_sync();

CREATE OR REPLACE FUNCTION public.next_driver_temp_password_seq()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.driver_temp_password_seq')::integer;
$$;

REVOKE ALL ON FUNCTION public.next_driver_temp_password_seq() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_driver_temp_password_seq() TO service_role;

-- â”€â”€ RLS Policies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Profiles
CREATE POLICY "profiles_insert_own"  ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_select_own"  ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "profiles_update_own"  ON public.profiles FOR UPDATE USING (user_id = auth.uid());

-- Companies
CREATE POLICY "companies_select_member" ON public.companies FOR SELECT USING (public.is_company_member(id));
CREATE POLICY "companies_insert_auth"   ON public.companies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "companies_update_admin"  ON public.companies FOR UPDATE USING (public.is_company_admin(id));

-- Company settings
CREATE POLICY "company_settings_select_member" ON public.company_settings FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "company_settings_insert_admin"  ON public.company_settings FOR INSERT WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY "company_settings_update_admin"  ON public.company_settings FOR UPDATE USING (public.is_company_admin(company_id));

-- Company memberships
CREATE POLICY "memberships_select_member" ON public.company_memberships FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "memberships_insert_admin"  ON public.company_memberships FOR INSERT WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY "memberships_update_admin"  ON public.company_memberships FOR UPDATE USING (public.is_company_admin(company_id));

-- Drivers
CREATE POLICY "drivers_select_member" ON public.drivers FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "drivers_select_own"    ON public.drivers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "drivers_all_admin"     ON public.drivers FOR ALL    USING (public.is_company_admin(company_id));

-- Vehicles
CREATE POLICY "vehicles_select_member" ON public.vehicles FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "vehicles_all_admin"     ON public.vehicles FOR ALL    USING (public.is_company_admin(company_id));

-- Driver documents
CREATE POLICY "driver_docs_select_member" ON public.driver_documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND public.is_company_member(d.company_id)));
CREATE POLICY "driver_docs_all_admin" ON public.driver_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND public.is_company_admin(d.company_id)));

-- Vehicle documents
CREATE POLICY "vehicle_docs_select_member" ON public.vehicle_documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.is_company_member(v.company_id)));
CREATE POLICY "vehicle_docs_all_admin" ON public.vehicle_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.is_company_admin(v.company_id)));

-- Jobs
CREATE POLICY "jobs_all_member" ON public.jobs FOR ALL USING (public.is_company_member(company_id));
CREATE POLICY "jobs_select_assigned_driver" ON public.jobs FOR SELECT
  USING (
    assigned_driver_id = (
      SELECT id
      FROM public.drivers
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );
CREATE POLICY "jobs_update_assigned_driver" ON public.jobs FOR UPDATE
  USING (
    assigned_driver_id = (
      SELECT id
      FROM public.drivers
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  )
  WITH CHECK (
    assigned_driver_id = (
      SELECT id
      FROM public.drivers
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

-- Job bids
CREATE POLICY "bids_all_member" ON public.job_bids FOR ALL
  USING (company_id IS NULL OR public.is_company_member(company_id));

-- Driver locations
CREATE POLICY "driver_locations_all_member" ON public.driver_locations FOR ALL
  USING (public.is_company_member(company_id));

-- Quotes
CREATE POLICY "quotes_all_member" ON public.quotes FOR ALL USING (public.is_company_member(company_id));

-- Invoices
CREATE POLICY "invoices_all_member" ON public.invoices FOR ALL USING (public.is_company_member(company_id));

-- Diary events
CREATE POLICY "diary_events_all_member" ON public.diary_events FOR ALL USING (public.is_company_member(company_id));

-- Return journeys
CREATE POLICY "return_journeys_all_member" ON public.return_journeys FOR ALL USING (public.is_company_member(company_id));
