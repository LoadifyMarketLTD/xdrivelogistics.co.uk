-- Fresh-replay bridge for the historical public.job_status enum -> proven live
-- jobs.status text contract.
--
-- PostgreSQL will not ALTER a column type while views/rules depend on that
-- column. Clean history creates dashboard_stats (014) and
-- job_bids_with_job_owner (122) before the PR #357 reconciliation runs, so the
-- later 14:55 migration cannot convert jobs.status until those views are
-- temporarily removed.
--
-- This bridge is deliberately a no-op when jobs.status is already text (the
-- current live contract). On enum-backed fresh databases it removes only the two
-- repo-owned dependent views, converts the column, recreates the exact repo
-- contracts in the same transaction and restores their grants. No CASCADE is
-- used and no Workspace/UI/business semantics are changed.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
DECLARE
  v_status_data_type text;
  v_status_udt_name text;
  v_had_dashboard_stats boolean := false;
  v_had_job_bids_owner boolean := false;
  v_unhandled_views text;
BEGIN
  SELECT c.data_type, c.udt_name
    INTO v_status_data_type, v_status_udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'jobs'
    AND c.column_name = 'status';

  IF v_status_data_type = 'text' THEN
    RETURN;
  END IF;

  IF v_status_data_type IS DISTINCT FROM 'USER-DEFINED'
     OR v_status_udt_name IS DISTINCT FROM 'job_status' THEN
    RAISE EXCEPTION 'Unsupported jobs.status type before view bridge: %/%',
      v_status_data_type, v_status_udt_name
      USING ERRCODE = '42804';
  END IF;

  v_had_dashboard_stats := to_regclass('public.dashboard_stats') IS NOT NULL;
  v_had_job_bids_owner := to_regclass('public.job_bids_with_job_owner') IS NOT NULL;

  -- No CASCADE: an unexpected downstream dependency must fail closed rather
  -- than silently deleting another runtime object.
  IF v_had_dashboard_stats THEN
    EXECUTE 'DROP VIEW public.dashboard_stats';
  END IF;

  IF v_had_job_bids_owner THEN
    EXECUTE 'DROP VIEW public.job_bids_with_job_owner';
  END IF;

  -- Fail with the exact remaining names if clean history ever adds another view
  -- dependency. This keeps future replay failures diagnostic instead of hiding
  -- them behind CASCADE.
  SELECT string_agg(DISTINCT format('%I.%I', n.nspname, v.relname), ', ' ORDER BY format('%I.%I', n.nspname, v.relname))
    INTO v_unhandled_views
  FROM pg_depend d
  JOIN pg_rewrite r ON r.oid = d.objid
  JOIN pg_class v ON v.oid = r.ev_class
  JOIN pg_namespace n ON n.oid = v.relnamespace
  JOIN pg_attribute a
    ON a.attrelid = d.refobjid
   AND a.attnum = d.refobjsubid
  WHERE d.refobjid = 'public.jobs'::regclass
    AND a.attname = 'status'
    AND v.relkind IN ('v', 'm');

  IF v_unhandled_views IS NOT NULL THEN
    RAISE EXCEPTION 'Unreconciled jobs.status dependent views remain: %', v_unhandled_views
      USING ERRCODE = '2BP01';
  END IF;

  ALTER TABLE public.jobs ALTER COLUMN status DROP DEFAULT;
  ALTER TABLE public.jobs
    ALTER COLUMN status TYPE text USING status::text;

  IF v_had_dashboard_stats THEN
    EXECUTE $view$
      CREATE VIEW public.dashboard_stats AS
      SELECT
        j.company_id,
        COUNT(*) FILTER (
          WHERE j.status IN ('posted', 'allocated', 'in_transit')
        ) AS active_jobs,
        COUNT(*) FILTER (
          WHERE j.status = 'delivered'
            AND j.updated_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
        ) AS completed_today
      FROM public.jobs j
      GROUP BY j.company_id
    $view$;
  END IF;

  IF v_had_job_bids_owner THEN
    EXECUTE $view$
      CREATE VIEW public.job_bids_with_job_owner
      WITH (security_invoker = true)
      AS
      SELECT
        jb.id,
        jb.job_id,
        jb.bidder_id,
        jb.bid_price_gbp,
        jb.message,
        jb.created_at,
        jb.company_id AS bidder_company_id,
        COALESCE(jb.bid_price_gbp, jb.amount) AS quote_amount,
        jb.status AS bid_status,
        jb.load_id,
        jb.bidder_user_id,
        jb.currency,
        COALESCE(jb.bid_price_gbp, jb.amount) AS amount_gbp,
        jb.amount,
        jb.updated_at,
        jb.bidder_driver_id,
        COALESCE(l.company_id, j.company_id) AS owner_company_id,
        j.exchange_visibility,
        j.status AS job_status,
        l.status AS load_status,
        j.pickup_location,
        j.delivery_location,
        j.pickup_datetime,
        j.vehicle_type,
        j.awarded_carrier_company_id
      FROM public.job_bids jb
      JOIN public.jobs j ON j.id = jb.job_id
      LEFT JOIN public.loads l ON l.id = jb.load_id
    $view$;

    EXECUTE 'GRANT SELECT ON public.job_bids_with_job_owner TO authenticated';
    EXECUTE 'GRANT SELECT ON public.job_bids_with_job_owner TO service_role';
  END IF;
END
$$;

COMMIT;
