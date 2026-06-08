-- Migration 096: Add future_position columns to drivers table
-- The driver return journeys page (app/driver/returns/page.tsx) writes
-- future_position and future_position_date to the drivers table, but
-- these columns were never added in any prior migration.

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS future_position      text,
  ADD COLUMN IF NOT EXISTS future_position_date timestamptz;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
