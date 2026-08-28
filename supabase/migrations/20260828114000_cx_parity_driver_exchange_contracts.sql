-- CX-benchmark XDrive Driver exchange contracts.
--
-- Adds explicit structured fields for rich driver quotes, richer return journeys,
-- persisted search/alert preferences, and a server-owned collection-pass record.
-- These contracts deliberately remain service/API mediated. No new direct client
-- table access is granted by this migration.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- Rich driver quote metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_bids
  ADD COLUMN IF NOT EXISTS base_amount numeric,
  ADD COLUMN IF NOT EXISTS collect_within_minutes integer,
  ADD COLUMN IF NOT EXISTS additional_extras_gbp numeric,
  ADD COLUMN IF NOT EXISTS quoted_vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quoted_vehicle_label text;

ALTER TABLE public.job_bids
  DROP CONSTRAINT IF EXISTS job_bids_base_amount_check,
  ADD CONSTRAINT job_bids_base_amount_check
    CHECK (base_amount IS NULL OR (base_amount > 0 AND base_amount <= 1000000));

ALTER TABLE public.job_bids
  DROP CONSTRAINT IF EXISTS job_bids_collect_within_minutes_check,
  ADD CONSTRAINT job_bids_collect_within_minutes_check
    CHECK (collect_within_minutes IS NULL OR collect_within_minutes BETWEEN 5 AND 240);

ALTER TABLE public.job_bids
  DROP CONSTRAINT IF EXISTS job_bids_additional_extras_gbp_check,
  ADD CONSTRAINT job_bids_additional_extras_gbp_check
    CHECK (additional_extras_gbp IS NULL OR (additional_extras_gbp >= 0 AND additional_extras_gbp <= 1000000));

ALTER TABLE public.job_bids
  DROP CONSTRAINT IF EXISTS job_bids_quoted_vehicle_label_check,
  ADD CONSTRAINT job_bids_quoted_vehicle_label_check
    CHECK (quoted_vehicle_label IS NULL OR length(quoted_vehicle_label) <= 300);

COMMENT ON COLUMN public.job_bids.base_amount IS
  'Driver-entered base quote amount excluding explicit extras.';
COMMENT ON COLUMN public.job_bids.collect_within_minutes IS
  'Driver-declared time to reach collection after quote acceptance.';
COMMENT ON COLUMN public.job_bids.additional_extras_gbp IS
  'Explicit quoted extras excluding VAT; never encoded into free-text notes.';
COMMENT ON COLUMN public.job_bids.quoted_vehicle_id IS
  'Canonical vehicle selected by the driver for this quote.';
COMMENT ON COLUMN public.job_bids.quoted_vehicle_label IS
  'Immutable display snapshot of the selected vehicle at quote submission time.';

-- ---------------------------------------------------------------------------
-- Rich return journey / Going Home / Going To / Future Journey contract
-- ---------------------------------------------------------------------------
ALTER TABLE public.return_journeys
  ADD COLUMN IF NOT EXISTS journey_mode text,
  ADD COLUMN IF NOT EXISTS go_anywhere boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS via_location text,
  ADD COLUMN IF NOT EXISTS journey_eta timestamptz,
  ADD COLUMN IF NOT EXISTS capacity_status text,
  ADD COLUMN IF NOT EXISTS weight_available_kg numeric,
  ADD COLUMN IF NOT EXISTS pallet_space_available integer;

ALTER TABLE public.return_journeys
  DROP CONSTRAINT IF EXISTS return_journeys_journey_mode_check,
  ADD CONSTRAINT return_journeys_journey_mode_check
    CHECK (journey_mode IS NULL OR journey_mode IN ('going_home','going_to','future'));

ALTER TABLE public.return_journeys
  DROP CONSTRAINT IF EXISTS return_journeys_weight_available_kg_check,
  ADD CONSTRAINT return_journeys_weight_available_kg_check
    CHECK (weight_available_kg IS NULL OR weight_available_kg >= 0);

ALTER TABLE public.return_journeys
  DROP CONSTRAINT IF EXISTS return_journeys_pallet_space_available_check,
  ADD CONSTRAINT return_journeys_pallet_space_available_check
    CHECK (pallet_space_available IS NULL OR pallet_space_available >= 0);

CREATE OR REPLACE FUNCTION public.replace_driver_return_journey_v2(
  p_driver_id uuid,
  p_company_id uuid,
  p_mode text,
  p_go_anywhere boolean,
  p_from_location text,
  p_to_location text,
  p_via_location text,
  p_available_from timestamptz,
  p_journey_eta timestamptz,
  p_capacity_status text,
  p_weight_available_kg numeric,
  p_pallet_space_available integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_mode text := lower(nullif(trim(p_mode), ''));
BEGIN
  IF v_mode IS NULL OR v_mode NOT IN ('going_home','going_to','future') THEN
    RAISE EXCEPTION 'Unsupported journey mode.' USING ERRCODE = '22023';
  END IF;

  IF NOT COALESCE(p_go_anywhere, false)
     AND nullif(trim(COALESCE(p_from_location, '')), '') IS NULL
     AND nullif(trim(COALESCE(p_to_location, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A journey location is required unless Go Anywhere is enabled.' USING ERRCODE = '22023';
  END IF;

  IF p_weight_available_kg IS NOT NULL AND p_weight_available_kg < 0 THEN
    RAISE EXCEPTION 'Available weight cannot be negative.' USING ERRCODE = '22023';
  END IF;
  IF p_pallet_space_available IS NOT NULL AND p_pallet_space_available < 0 THEN
    RAISE EXCEPTION 'Pallet space cannot be negative.' USING ERRCODE = '22023';
  END IF;

  -- Preserve CX-style My Journeys history while allowing one current entry per
  -- mode. Older rows are retained instead of deleting the driver's history.
  UPDATE public.return_journeys
  SET status = 'superseded'
  WHERE driver_id = p_driver_id
    AND COALESCE(journey_mode, 'going_home') = v_mode
    AND COALESCE(status, 'available') = 'available';

  INSERT INTO public.return_journeys (
    id, company_id, driver_id, journey_mode, go_anywhere,
    from_postcode, to_postcode, via_location,
    available_from, journey_eta, capacity_status,
    weight_available_kg, pallet_space_available,
    status, created_at
  ) VALUES (
    v_id, p_company_id, p_driver_id, v_mode, COALESCE(p_go_anywhere, false),
    nullif(trim(COALESCE(p_from_location, '')), ''),
    nullif(trim(COALESCE(p_to_location, '')), ''),
    nullif(trim(COALESCE(p_via_location, '')), ''),
    p_available_from, p_journey_eta,
    nullif(trim(COALESCE(p_capacity_status, '')), ''),
    p_weight_available_kg, p_pallet_space_available,
    'available', now()
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_driver_return_journey_v2(uuid,uuid,text,boolean,text,text,text,timestamptz,timestamptz,text,numeric,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_driver_return_journey_v2(uuid,uuid,text,boolean,text,text,text,timestamptz,timestamptz,text,numeric,integer) FROM anon;
REVOKE ALL ON FUNCTION public.replace_driver_return_journey_v2(uuid,uuid,text,boolean,text,text,text,timestamptz,timestamptz,text,numeric,integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_driver_return_journey_v2(uuid,uuid,text,boolean,text,text,text,timestamptz,timestamptz,text,numeric,integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Persisted driver alert and search preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_alert_preferences (
  driver_id uuid PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT true,
  heads_up_enabled boolean NOT NULL DEFAULT true,
  marketplace_enabled boolean NOT NULL DEFAULT true,
  quote_enabled boolean NOT NULL DEFAULT true,
  booking_enabled boolean NOT NULL DEFAULT true,
  operational_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_alert_preferences ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.driver_search_filter_defaults (
  driver_id uuid PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driver_search_filter_defaults_object_check CHECK (jsonb_typeof(filters) = 'object')
);
ALTER TABLE public.driver_search_filter_defaults ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- XDrive Collection Pass / Secure Collect foundation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_collection_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  pass_code text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  CONSTRAINT driver_collection_passes_expiry_check CHECK (expires_at > issued_at)
);
ALTER TABLE public.driver_collection_passes ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS driver_collection_passes_one_live_job_idx
  ON public.driver_collection_passes(job_id)
  WHERE verified_at IS NULL AND revoked_at IS NULL;

COMMENT ON TABLE public.driver_collection_passes IS
  'Server-owned XDrive Secure Collect pass. Driver app may retrieve its own active pass only through the authenticated API; raw table access is not granted.';

NOTIFY pgrst, 'reload schema';
COMMIT;
