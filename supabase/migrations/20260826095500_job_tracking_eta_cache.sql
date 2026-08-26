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

CREATE TABLE IF NOT EXISTS public.tracking_provider_usage_monthly (
  provider text NOT NULL,
  usage_month date NOT NULL,
  request_count bigint NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, usage_month)
);

ALTER TABLE public.tracking_provider_usage_monthly ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tracking_provider_usage_monthly FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.tracking_provider_usage_monthly TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_tracking_provider_request(
  p_provider text,
  p_limit bigint DEFAULT 90000
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_month date := date_trunc('month', now())::date;
  v_count bigint;
BEGIN
  IF p_provider IS NULL OR btrim(p_provider) = '' OR p_limit < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.tracking_provider_usage_monthly(provider, usage_month, request_count, updated_at)
  VALUES (btrim(p_provider), v_month, 1, now())
  ON CONFLICT (provider, usage_month) DO UPDATE
    SET request_count = public.tracking_provider_usage_monthly.request_count + 1,
        updated_at = now()
    WHERE public.tracking_provider_usage_monthly.request_count < p_limit
  RETURNING request_count INTO v_count;

  RETURN v_count IS NOT NULL AND v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_tracking_provider_request(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tracking_provider_request(text, bigint) TO service_role;

COMMENT ON TABLE public.job_tracking_eta_snapshots IS
  'Server-only traffic ETA cache. One snapshot is reused by every authorised viewer; viewers never trigger routing-provider calls.';

COMMENT ON TABLE public.tracking_provider_usage_monthly IS
  'Server-only monthly provider request counter used to fail closed before paid traffic-routing usage is reached.';

NOTIFY pgrst, 'reload schema';

COMMIT;
