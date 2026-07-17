-- Smart Destination Priority and explicit transport rules.
-- Safe to run repeatedly.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS pickup_country_code text NOT NULL DEFAULT 'GB',
  ADD COLUMN IF NOT EXISTS delivery_country_code text NOT NULL DEFAULT 'GB',
  ADD COLUMN IF NOT EXISTS service_mode text NOT NULL DEFAULT 'timed_direct',
  ADD COLUMN IF NOT EXISTS direct_delivery_required boolean NOT NULL DEFAULT true;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS destination_priority_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS destination_radius_miles integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS international_work_approved boolean NOT NULL DEFAULT false;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS international_work_approved boolean NOT NULL DEFAULT false;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS international_work_approved boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_country_codes_format') THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_country_codes_format
      CHECK (pickup_country_code ~ '^[A-Z]{2}$' AND delivery_country_code ~ '^[A-Z]{2}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_service_mode_valid') THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_service_mode_valid
      CHECK (service_mode IN ('asap_direct', 'timed_direct', 'coload_permitted', 'flexible', 'multi_drop'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_destination_radius_valid') THEN
    ALTER TABLE public.drivers ADD CONSTRAINT drivers_destination_radius_valid
      CHECK (destination_radius_miles IN (10, 20, 30));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_asap_direct_delivery()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.pickup_country_code := upper(coalesce(nullif(NEW.pickup_country_code, ''), 'GB'));
  NEW.delivery_country_code := upper(coalesce(nullif(NEW.delivery_country_code, ''), 'GB'));
  IF upper(coalesce(NEW.pickup_time_slot, '')) = 'ASAP' THEN
    NEW.service_mode := 'asap_direct';
    NEW.direct_delivery_required := true;
  ELSE
    NEW.direct_delivery_required := NEW.service_mode IN ('timed_direct', 'asap_direct');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_enforce_asap_direct_delivery ON public.jobs;
CREATE TRIGGER jobs_enforce_asap_direct_delivery
  BEFORE INSERT OR UPDATE OF pickup_time_slot, service_mode, pickup_country_code, delivery_country_code
  ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_asap_direct_delivery();

CREATE INDEX IF NOT EXISTS jobs_destination_priority_pickup_idx
  ON public.jobs (status, pickup_lat, pickup_lng, pickup_datetime)
  WHERE status = 'posted';
