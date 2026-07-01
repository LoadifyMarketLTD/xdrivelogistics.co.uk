-- Migration 105: Ensure coord columns exist on jobs table
-- Guard: pickup / delivery lat-lng columns are added by migrations 011 and 020
-- but may be absent in older DB snapshots. Safe to re-run (IF NOT EXISTS).

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS pickup_lat    double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng    double precision,
  ADD COLUMN IF NOT EXISTS delivery_lat  double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng  double precision;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
