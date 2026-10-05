BEGIN;

CREATE TABLE IF NOT EXISTS public.public_quote_rate_limits (
  rate_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_quote_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_quote_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.public_quote_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_public_quote_rate_limit(
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempts integer;
  v_now timestamptz := now();
BEGIN
  IF nullif(btrim(coalesce(p_rate_key, '')), '') IS NULL
     OR p_limit < 1
     OR p_window_seconds < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.public_quote_rate_limits AS current_limit (
    rate_key, window_started_at, attempts, updated_at
  ) VALUES (
    p_rate_key, v_now, 1, v_now
  )
  ON CONFLICT (rate_key) DO UPDATE
  SET
    attempts = CASE
      WHEN current_limit.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        THEN 1
      ELSE current_limit.attempts + 1
    END,
    window_started_at = CASE
      WHEN current_limit.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        THEN v_now
      ELSE current_limit.window_started_at
    END,
    updated_at = v_now
  RETURNING attempts INTO v_attempts;

  RETURN v_attempts <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_public_quote_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_quote_rate_limit(text, integer, integer)
  TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';