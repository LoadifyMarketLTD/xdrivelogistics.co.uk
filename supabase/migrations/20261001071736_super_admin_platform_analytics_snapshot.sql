BEGIN;

CREATE OR REPLACE FUNCTION public.super_admin_platform_analytics_snapshot()
RETURNS TABLE (
  companies_total bigint,
  companies_active bigint,
  drivers_total bigint,
  jobs_total bigint,
  jobs_delivered bigint,
  jobs_open bigint,
  quotes_total bigint,
  bids_total bigint,
  currencies text[],
  total_invoiced numeric,
  total_revenue numeric,
  weekly_jobs jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH issued_invoices AS (
    SELECT amount, currency, payment_status
    FROM public.invoices
    WHERE payment_status = 'paid'
       OR (status IS NOT NULL AND status NOT IN ('draft', 'Pending', 'void'))
  ),
  currency_set AS (
    SELECT COALESCE(
      array_agg(DISTINCT upper(currency::text)) FILTER (WHERE currency IS NOT NULL),
      ARRAY[]::text[]
    ) AS currencies
    FROM issued_invoices
  ),
  recent_weekly AS (
    SELECT date_trunc('week', created_at AT TIME ZONE 'UTC')::date AS week_start,
           count(*)::bigint AS job_count
    FROM public.jobs
    WHERE created_at >= now() - interval '30 days'
    GROUP BY 1
    ORDER BY 1
  )
  SELECT
    (SELECT count(*) FROM public.companies),
    (SELECT count(*) FROM public.companies WHERE status = 'active'),
    (SELECT count(*) FROM public.drivers),
    (SELECT count(*) FROM public.jobs),
    (SELECT count(*) FROM public.jobs WHERE status = 'delivered'),
    (SELECT count(*) FROM public.jobs WHERE status IN (
      'draft','received','posted','quoted','awarded','allocated','accepted','assigned',
      'open','OPEN','in_progress','on_my_way','on_my_way_to_pickup','on_site_pickup',
      'loaded','collected','in_transit','on_my_way_to_delivery','on_site_delivery'
    )),
    (SELECT count(*) FROM public.quotes),
    (SELECT count(*) FROM public.job_bids),
    (SELECT currencies FROM currency_set),
    COALESCE((SELECT sum(amount) FROM issued_invoices), 0),
    COALESCE((SELECT sum(amount) FROM issued_invoices WHERE payment_status = 'paid'), 0),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('week', week_start::text, 'count', job_count)
        ORDER BY week_start
      )
      FROM recent_weekly
    ), '[]'::jsonb);
$$;

REVOKE ALL ON FUNCTION public.super_admin_platform_analytics_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_platform_analytics_snapshot() TO service_role;

COMMENT ON FUNCTION public.super_admin_platform_analytics_snapshot() IS
  'Service-role-only one-round-trip KPI and 30-day weekly-job snapshot for Super Admin analytics.';

COMMIT;

NOTIFY pgrst, 'reload schema';
