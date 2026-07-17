-- ============================================================
-- 015_add_driver_app_columns.sql
--
-- Adds driver-app support columns:
--   • drivers  : login_pin, app_access, last_app_login, device_token
--   • jobs     : collection_photo_url, delivery_photos,
--                delivery_signature_data, status_history,
--                driver_notes, client_signature_name
--   • driver_locations table (replaces any partial definition)
--
-- Safe to re-run: IF NOT EXISTS makes every statement idempotent.
-- ============================================================

-- ── drivers ──────────────────────────────────────────────────
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS login_pin        text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS app_access       boolean     NOT NULL DEFAULT false;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS last_app_login   timestamptz;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS device_token     text;

-- ── jobs ─────────────────────────────────────────────────────
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS collection_photo_url      text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS delivery_photos           text[];
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS delivery_signature_data   text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS status_history            jsonb       DEFAULT '[]'::jsonb;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS driver_notes              text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS client_signature_name     text;

-- ── driver_locations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid        NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  company_id  uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  job_id      uuid        REFERENCES public.jobs(id) ON DELETE SET NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  heading     double precision,
  speed_mph   double precision,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS driver_locations_driver_id_idx   ON public.driver_locations (driver_id);
CREATE INDEX IF NOT EXISTS driver_locations_company_id_idx  ON public.driver_locations (company_id);
CREATE INDEX IF NOT EXISTS driver_locations_recorded_at_idx ON public.driver_locations (recorded_at DESC);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'driver_locations'
      AND policyname = 'driver_locations_all_member'
  ) THEN
    CREATE POLICY driver_locations_all_member ON public.driver_locations
      FOR ALL
      USING (public.is_company_member(company_id));
  END IF;
END$$;
