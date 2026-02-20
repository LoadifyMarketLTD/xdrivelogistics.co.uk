-- XDrive Logistics multi-tenant CX platform schema

-- Enums
CREATE TYPE public.company_role AS ENUM ('owner', 'admin', 'dispatcher', 'viewer');
CREATE TYPE public.membership_status AS ENUM ('invited', 'active', 'suspended');
CREATE TYPE public.doc_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
CREATE TYPE public.job_status AS ENUM ('draft', 'posted', 'allocated', 'in_transit', 'delivered', 'cancelled', 'disputed');
CREATE TYPE public.cargo_type AS ENUM ('documents', 'packages', 'pallets', 'furniture', 'equipment', 'other');
CREATE TYPE public.vehicle_type AS ENUM ('bicycle', 'motorbike', 'car', 'van_small', 'van_large', 'luton', 'truck_7_5t', 'truck_18t', 'artic');
CREATE TYPE public.tracking_event_type AS ENUM ('created', 'allocated', 'driver_en_route', 'arrived_pickup', 'collected', 'in_transit', 'arrived_delivery', 'delivered', 'failed', 'cancelled', 'note');

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  is_driver boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_number text,
  vat_number text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  country text DEFAULT 'UK',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Company memberships
CREATE TABLE public.company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text,
  role_in_company public.company_role DEFAULT 'viewer',
  status public.membership_status DEFAULT 'invited',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id),
  UNIQUE(company_id, invited_email)
);

-- Drivers
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  phone text,
  email text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Vehicles
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assigned_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  type public.vehicle_type NOT NULL,
  reg_plate text,
  make text,
  model text,
  payload_kg numeric,
  pallets_capacity int,
  has_tail_lift boolean DEFAULT false,
  has_straps boolean DEFAULT false,
  has_blankets boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Driver documents
CREATE TABLE public.driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_path text,
  issued_date date,
  expiry_date date,
  status public.doc_status DEFAULT 'pending',
  rejection_reason text,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Vehicle documents
CREATE TABLE public.vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_path text,
  issued_date date,
  expiry_date date,
  status public.doc_status DEFAULT 'pending',
  rejection_reason text,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Jobs
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  status public.job_status DEFAULT 'draft',
  vehicle_type public.vehicle_type,
  cargo_type public.cargo_type,
  pickup_location text,
  pickup_postcode text,
  pickup_lat double precision,
  pickup_lng double precision,
  pickup_datetime timestamptz,
  delivery_location text,
  delivery_postcode text,
  delivery_lat double precision,
  delivery_lng double precision,
  delivery_datetime timestamptz,
  pallets int,
  boxes int,
  bags int,
  items int,
  weight_kg numeric,
  length_cm numeric,
  width_cm numeric,
  height_cm numeric,
  currency text DEFAULT 'GBP',
  budget_amount numeric,
  is_fixed_price boolean DEFAULT false,
  load_details text,
  special_requirements text,
  access_restrictions text,
  job_distance_miles numeric,
  job_distance_minutes int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Job documents
CREATE TABLE public.job_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id),
  doc_type text DEFAULT 'other',
  file_path text,
  created_at timestamptz DEFAULT now()
);

-- Job tracking events
CREATE TABLE public.job_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  event_type public.tracking_event_type NOT NULL,
  message text,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- Job bids
CREATE TABLE public.job_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  bidder_user_id uuid NOT NULL REFERENCES auth.users(id),
  bidder_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'GBP',
  message text,
  status text DEFAULT 'submitted',
  created_at timestamptz DEFAULT now()
);

-- Driver locations
CREATE TABLE public.driver_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading int,
  speed_mph numeric,
  recorded_at timestamptz DEFAULT now()
);

-- Job driver distance cache
CREATE TABLE public.job_driver_distance_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  miles_to_pickup numeric,
  minutes_to_pickup int,
  computed_at timestamptz DEFAULT now(),
  UNIQUE(job_id, driver_id)
);

-- Quotes
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  customer_name text,
  customer_email text,
  customer_phone text,
  pickup_location text,
  delivery_location text,
  vehicle_type public.vehicle_type,
  cargo_type public.cargo_type,
  amount numeric,
  currency text DEFAULT 'GBP',
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

-- Diary events
CREATE TABLE public.diary_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

-- Return journeys
CREATE TABLE public.return_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_type public.vehicle_type,
  from_postcode text,
  to_postcode text,
  available_from timestamptz,
  available_to timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_driver_distance_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_journeys ENABLE ROW LEVEL SECURITY;

-- Helper function: is user a member of a company?
CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = cid AND user_id = auth.uid() AND status = 'active'
  );
$$;

-- Helper function: is user an admin/owner of a company?
CREATE OR REPLACE FUNCTION public.is_company_admin(cid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = cid AND user_id = auth.uid() AND status = 'active'
      AND role_in_company IN ('owner', 'admin')
  );
$$;

-- Profiles RLS
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Companies RLS
CREATE POLICY "companies_select_member" ON public.companies FOR SELECT USING (public.is_company_member(id));
CREATE POLICY "companies_insert_admin" ON public.companies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "companies_update_admin" ON public.companies FOR UPDATE USING (public.is_company_admin(id));

-- Company memberships RLS
CREATE POLICY "memberships_select_member" ON public.company_memberships FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "memberships_insert_admin" ON public.company_memberships FOR INSERT WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY "memberships_update_admin" ON public.company_memberships FOR UPDATE USING (public.is_company_admin(company_id));

-- Drivers RLS
CREATE POLICY "drivers_select_member" ON public.drivers FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "drivers_all_admin" ON public.drivers FOR ALL USING (public.is_company_admin(company_id));

-- Vehicles RLS
CREATE POLICY "vehicles_select_member" ON public.vehicles FOR SELECT USING (public.is_company_member(company_id));
CREATE POLICY "vehicles_all_admin" ON public.vehicles FOR ALL USING (public.is_company_admin(company_id));

-- Driver documents RLS
CREATE POLICY "driver_docs_select_member" ON public.driver_documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND public.is_company_member(d.company_id)));
CREATE POLICY "driver_docs_all_admin" ON public.driver_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND public.is_company_admin(d.company_id)));

-- Vehicle documents RLS
CREATE POLICY "vehicle_docs_select_member" ON public.vehicle_documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.is_company_member(v.company_id)));
CREATE POLICY "vehicle_docs_all_admin" ON public.vehicle_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND public.is_company_admin(v.company_id)));

-- Jobs RLS
CREATE POLICY "jobs_all_member" ON public.jobs FOR ALL USING (public.is_company_member(company_id));

-- Job bids RLS
CREATE POLICY "bids_all_member" ON public.job_bids FOR ALL
  USING (company_id IS NULL OR public.is_company_member(company_id));

-- Quotes RLS
CREATE POLICY "quotes_all_member" ON public.quotes FOR ALL USING (public.is_company_member(company_id));
