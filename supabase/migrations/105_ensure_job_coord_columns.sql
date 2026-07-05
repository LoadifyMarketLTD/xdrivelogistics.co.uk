-- Migration 105: Ensure coordinate columns exist on jobs table
-- The fleet position map and mobile job detail screens read pickup_lat,
-- pickup_lng, delivery_lat, delivery_lng from jobs. These columns were
-- not added by any prior migration and must exist for coordinate-based
-- features to function correctly.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS pickup_lat    double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng    double precision,
  ADD COLUMN IF NOT EXISTS delivery_lat  double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng  double precision;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
