BEGIN;

CREATE OR REPLACE FUNCTION public.super_admin_stats_snapshot()
RETURNS TABLE (
  companies_total bigint, companies_active bigint, companies_suspended bigint, companies_pending bigint,
  drivers_total bigint, jobs_total bigint, jobs_open bigint, jobs_delivered bigint,
  invoices_total bigint, invoices_unpaid bigint, driver_compliance bigint, vehicle_compliance bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    (SELECT count(*) FROM public.companies),
    (SELECT count(*) FROM public.companies WHERE status = 'active'),
    (SELECT count(*) FROM public.companies WHERE status = 'suspended'),
    (SELECT count(*) FROM public.companies WHERE status = 'pending_approval'),
    (SELECT count(*) FROM public.drivers d WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = d.user_id AND p.is_internal_account = true
    )),
    (SELECT count(*) FROM public.jobs),
    (SELECT count(*) FROM public.jobs WHERE status IN (
      'draft','received','posted','quoted','awarded','allocated','accepted','assigned',
      'open','OPEN','in_progress','on_my_way','on_my_way_to_pickup','on_site_pickup',
      'loaded','collected','in_transit','on_my_way_to_delivery','on_site_delivery'
    )),
    (SELECT count(*) FROM public.jobs WHERE status = 'delivered'),
    (SELECT count(*) FROM public.invoices),
    (SELECT count(*) FROM public.invoices
      WHERE payment_status IN ('unpaid','partially_paid','overdue','disputed')
        AND (status IS NULL OR status NOT IN ('paid','void'))),
    (SELECT count(*) FROM public.driver_documents WHERE status IN ('pending','rejected')),
    (SELECT count(*) FROM public.vehicle_documents WHERE status IN ('pending','rejected'));
$$;

REVOKE ALL ON FUNCTION public.super_admin_stats_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_stats_snapshot() TO service_role;

COMMENT ON FUNCTION public.super_admin_stats_snapshot() IS
  'Service-role-only one-round-trip aggregate snapshot for the Super Admin Command Centre.';

COMMIT;
NOTIFY pgrst, 'reload schema';
