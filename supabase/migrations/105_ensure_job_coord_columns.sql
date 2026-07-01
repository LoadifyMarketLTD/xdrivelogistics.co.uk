-- Migration 105: ensure job coordinate columns exist
-- The columns pickup_lat, pickup_lng, delivery_lat, delivery_lng were defined
-- in early migrations (011, 013, 020) but may be absent from databases that
-- were initialised from a later schema snapshot.  This migration is fully
-- idempotent: IF NOT EXISTS prevents duplicate-column errors on databases
-- that already have the columns.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS pickup_lat   double precision,
  ADD COLUMN IF NOT EXISTS pickup_lng   double precision,
  ADD COLUMN IF NOT EXISTS delivery_lat double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng double precision;
