INSERT INTO public.app_settings(key, value)
VALUES (
  'invoice_delivery_worker_secret',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
ON CONFLICT (key) DO UPDATE
SET value = CASE
  WHEN nullif(btrim(public.app_settings.value), '') IS NULL THEN EXCLUDED.value
  ELSE public.app_settings.value
END;

CREATE OR REPLACE FUNCTION public.dispatch_invoice_delivery_outbox()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  secret text;
  target_url text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.invoice_delivery_outbox
    WHERE completed_at IS NULL
      AND next_attempt_at <= now()
  ) THEN
    RETURN;
  END IF;

  SELECT value INTO secret
  FROM public.app_settings
  WHERE key = 'invoice_delivery_worker_secret'
  LIMIT 1;

  SELECT value INTO target_url
  FROM public.app_settings
  WHERE key = 'invoice_delivery_dispatch_url'
  LIMIT 1;

  IF secret IS NULL OR btrim(secret) = '' THEN
    RAISE WARNING 'Invoice outbox dispatcher requires worker authentication configuration';
    RETURN;
  END IF;

  IF target_url IS NULL OR btrim(target_url) = '' THEN
    RAISE WARNING 'Invoice outbox dispatcher requires invoice_delivery_dispatch_url configuration';
    RETURN;
  END IF;

  IF target_url !~ '^https://[A-Za-z0-9.-]+/api/internal/invoice-deliveries$' THEN
    RAISE WARNING 'Invoice outbox dispatcher target URL is invalid';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := target_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_invoice_delivery_outbox()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_invoice_delivery_outbox()
  TO service_role;
