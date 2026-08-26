BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public.job_tracking_eta_snapshots (
  job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  source text NOT NULL,
  destination_postcode text,
  destination_lat double precision,
  destination_lng double precision,
  origin_lat double precision NOT NULL,
  origin_lng double precision NOT NULL,
  eta_at timestamptz NOT NULL,
  remaining_minutes integer NOT NULL CHECK (remaining_minutes >= 0),
  remaining_miles numeric(10,1),
  late_by_minutes integer,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_tracking_eta_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.job_tracking_eta_snapshots FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.job_tracking_eta_snapshots TO service_role;

CREATE INDEX IF NOT EXISTS idx_job_tracking_eta_snapshots_calculated_at
  ON public.job_tracking_eta_snapshots(calculated_at DESC);

COMMENT ON TABLE public.job_tracking_eta_snapshots IS
  'Server-only cache for traffic-aware delivery ETA. Prevents Mapbox Directions calls on every 30-second GPS update or viewer poll.';

NOTIFY pgrst, 'reload schema';

COMMIT;
