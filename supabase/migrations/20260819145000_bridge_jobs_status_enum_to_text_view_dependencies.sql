-- Fresh-replay bridge for the historical public.job_status enum -> proven live
-- jobs.status text contract.
--
-- PostgreSQL will not ALTER a column type while views/rules or column-specific
-- trigger definitions depend on that column, and persisted partial-index
-- predicates can retain enum-typed constants that become invalid after the
-- column becomes text. Clean history creates dashboard_stats (014),
-- job_bids_with_job_owner (122), trg_validate_job_status_transition (079), the
-- canonical Marketplace invoice trigger (20260818125500), and
-- jobs_destination_priority_pickup_idx (124) before the PR #357 reconciliation
-- runs, so the later 14:55 migration cannot convert jobs.status until those
-- structural dependencies are reconciled.
--
-- This bridge is deliberately a no-op when jobs.status is already text (the
-- current live contract). On enum-backed fresh databases it removes only the two
-- repo-owned dependent views, the legacy transition trigger, the canonical
-- Marketplace invoice trigger, and the known destination-priority partial index;
-- converts the column; then recreates the exact repo view contracts, the invoice
-- trigger, and the live-proven text predicate index in the same transaction. The
-- legacy transition trigger is intentionally NOT recreated here: 14:55 replaces
-- it with the PR #357-compatible trg_jobs_mvp_guardrails. No CASCADE is used and
-- no Workspace/UI/business semantics are changed.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
DECLARE
  v_status_data_type text;
  v_status_udt_name text;
  v_had_dashboard_stats boolean := false;
  v_had_job_bids_owner boolean := false;
  v_had_destination_priority_index boolean := false;
  v_had_marketplace_invoice_trigger boolean := false;
  v_invoice_trigger_function oid;
  v_unhandled_views text;
  v_unhandled_indexes text;
  v_unhandled_constraints text;
  v_unhandled_policies text;
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
    RAISE EXCEPTION 'Unsupported jobs.status type before dependency bridge: %/%',
      v_status_data_type, v_status_udt_name
      USING ERRCODE = '42804';
  END IF;

  v_had_dashboard_stats := to_regclass('public.dashboard_stats') IS NOT NULL;
  v_had_job_bids_owner := to_regclass('public.job_bids_with_job_owner') IS NOT NULL;
  v_had_destination_priority_index :=
    to_regclass('public.jobs_destination_priority_pickup_idx') IS NOT NULL;

  SELECT t.tgfoid
    INTO v_invoice_trigger_function
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.jobs'::regclass
    AND t.tgname = 'trg_generate_invoice_on_job_completion'
    AND NOT t.tgisinternal;

  v_had_marketplace_invoice_trigger := v_invoice_trigger_function IS NOT NULL;

  IF v_had_marketplace_invoice_trigger
     AND v_invoice_trigger_function IS DISTINCT FROM to_regprocedure('public.fn_generate_invoice_on_job_completion()') THEN
    RAISE EXCEPTION 'Unexpected function bound to trg_generate_invoice_on_job_completion before jobs.status bridge.'
      USING ERRCODE = '2BP01';
  END IF;

  -- Migration 079 installs this column-specific trigger. Migration 14:55 already
  -- removes it and installs the canonical PR #357 guardrail, so move that removal
  -- before the physical type conversion on fresh enum-backed databases.
  DROP TRIGGER IF EXISTS trg_validate_job_status_transition ON public.jobs;

  -- The canonical Marketplace invoice trigger is UPDATE OF status and therefore
  -- has a hard column dependency even though its function body is already
  -- compatible with text status. Preserve its presence and recreate it after the
  -- physical type conversion rather than weakening or removing invoice semantics.
  IF v_had_marketplace_invoice_trigger THEN
    DROP TRIGGER trg_generate_invoice_on_job_completion ON public.jobs;
  END IF;

  -- Migration 124 creates this partial index while status is still job_status,
  -- which persists the predicate as status = 'posted'::job_status. The proven
  -- live definition is the same index with status = 'posted'::text, so rebuild
  -- it around the type conversion rather than letting PostgreSQL reuse the stale
  -- enum predicate during ALTER TYPE.
  IF v_had_destination_priority_index THEN
    EXECUTE 'DROP INDEX public.jobs_destination_priority_pickup_idx';
  END IF;

  -- No CASCADE: an unexpected downstream dependency must fail closed rather
  -- than silently deleting another runtime object.
  IF v_had_dashboard_stats THEN
    EXECUTE 'DROP VIEW public.dashboard_stats';
  END IF;

  IF v_had_job_bids_owner THEN
    EXECUTE 'DROP VIEW public.job_bids_with_job_owner';
  END IF;

  -- Fail with exact names if clean history ever adds another persisted object
  -- that still carries a public.job_status cast. This keeps future replay
  -- failures diagnostic instead of surfacing an opaque text = job_status error.
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

  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO v_unhandled_indexes
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  WHERE i.indrelid = 'public.jobs'::regclass
    AND pg_get_indexdef(i.indexrelid) LIKE '%::job_status%';

  IF v_unhandled_indexes IS NOT NULL THEN
    RAISE EXCEPTION 'Unreconciled jobs.status enum-backed indexes remain: %', v_unhandled_indexes
      USING ERRCODE = '2BP01';
  END IF;

  SELECT string_agg(con.conname, ', ' ORDER BY con.conname)
    INTO v_unhandled_constraints
  FROM pg_constraint con
  WHERE con.conrelid = 'public.jobs'::regclass
    AND pg_get_constraintdef(con.oid, true) LIKE '%::job_status%';

  IF v_unhandled_constraints IS NOT NULL THEN
    RAISE EXCEPTION 'Unreconciled jobs.status enum-backed constraints remain: %', v_unhandled_constraints
      USING ERRCODE = '2BP01';
  END IF;

  SELECT string_agg(pol.polname, ', ' ORDER BY pol.polname)
    INTO v_unhandled_policies
  FROM pg_policy pol
  WHERE pol.polrelid = 'public.jobs'::regclass
    AND (
      COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '') LIKE '%::job_status%'
      OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '') LIKE '%::job_status%'
    );

  IF v_unhandled_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Unreconciled jobs.status enum-backed policies remain: %', v_unhandled_policies
      USING ERRCODE = '2BP01';
  END IF;

  ALTER TABLE public.jobs ALTER COLUMN status DROP DEFAULT;
  ALTER TABLE public.jobs
    ALTER COLUMN status TYPE text USING status::text;

  IF v_had_destination_priority_index THEN
    EXECUTE $index$
      CREATE INDEX jobs_destination_priority_pickup_idx
        ON public.jobs (status, pickup_lat, pickup_lng, pickup_datetime)
        WHERE status = 'posted'::text
    $index$;
  END IF;

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

  IF v_had_marketplace_invoice_trigger THEN
    IF to_regprocedure('public.fn_generate_invoice_on_job_completion()') IS NULL THEN
      RAISE EXCEPTION 'Cannot restore trg_generate_invoice_on_job_completion: canonical function is missing.'
        USING ERRCODE = '2BP01';
    END IF;

    CREATE TRIGGER trg_generate_invoice_on_job_completion
      AFTER UPDATE OF status, current_status, delivered_at, completed_at ON public.jobs
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_generate_invoice_on_job_completion();
  END IF;
END
$$;

COMMIT;
