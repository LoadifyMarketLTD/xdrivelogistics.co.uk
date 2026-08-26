BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.driver_availability_presence (
  driver_id uuid PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'fleet', 'exchange')),
  exact_lat double precision NOT NULL CHECK (exact_lat BETWEEN -90 AND 90),
  exact_lng double precision NOT NULL CHECK (exact_lng BETWEEN -180 AND 180),
  exchange_lat double precision NOT NULL CHECK (exchange_lat BETWEEN -90 AND 90),
  exchange_lng double precision NOT NULL CHECK (exchange_lng BETWEEN -180 AND 180),
  available_until timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (available_until > recorded_at)
);

ALTER TABLE public.driver_availability_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.driver_availability_presence FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.driver_availability_presence TO service_role;

CREATE INDEX IF NOT EXISTS idx_driver_availability_presence_active
  ON public.driver_availability_presence(available_until DESC, visibility);
CREATE INDEX IF NOT EXISTS idx_driver_availability_presence_company
  ON public.driver_availability_presence(company_id, available_until DESC);

COMMENT ON TABLE public.driver_availability_presence IS
  'Server-only opt-in availability location. Exact coordinates are never exposed to the Exchange; exchange_lat/lng are intentionally rounded. Presence expires automatically.';

NOTIFY pgrst, 'reload schema';

COMMIT;
