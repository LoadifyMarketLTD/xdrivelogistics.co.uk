-- PR #357-compatible finance/execution decoupling.
--
-- Invoice state is canonical in public.invoices. Job execution state is canonical
-- in jobs.current_status/jobs.status. Historical migration 082 coupled invoice
-- status changes back into jobs.status (`delivered -> invoiced -> paid`) while
-- leaving current_status untouched. That creates a split-brain job lifecycle and
-- can race the current `delivered -> completed` Driver/Operator transition.
--
-- Current PR #357 invoice generation is application-owned and idempotent; it is
-- invoked by both Driver and Operator delivery routes. This migration removes
-- only the stale invoice -> job-status coupling. It does not remove invoice
-- generation, invoice history/payment triggers or invoice records.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP TRIGGER IF EXISTS trg_sync_job_status_from_invoice ON public.invoices;

-- Repair only rows where the two job fields prove the historical coupling has
-- overwritten raw status while a more specific canonical execution status was
-- already preserved. Invoice state itself remains untouched in public.invoices.
DO $$
DECLARE
  v_status_type text;
  v_status_udt text;
BEGIN
  SELECT c.data_type, c.udt_name
  INTO v_status_type, v_status_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'jobs'
    AND c.column_name = 'status';

  IF v_status_type = 'USER-DEFINED' AND v_status_udt = 'job_status' THEN
    EXECUTE $sql$
      UPDATE public.jobs
      SET status = current_status::public.job_status,
          updated_at = now()
      WHERE status::text IN ('invoiced', 'paid')
        AND current_status IN (
          'awarded', 'allocated', 'on_my_way', 'on_site_pickup', 'loaded',
          'in_transit', 'on_site_delivery', 'delivered', 'completed'
        )
        AND current_status IS DISTINCT FROM status::text
    $sql$;
  ELSIF v_status_type IN ('text', 'character varying', 'character') THEN
    UPDATE public.jobs
    SET status = current_status,
        updated_at = now()
    WHERE status::text IN ('invoiced', 'paid')
      AND current_status IN (
        'awarded', 'allocated', 'on_my_way', 'on_site_pickup', 'loaded',
        'in_transit', 'on_site_delivery', 'delivered', 'completed'
      )
      AND current_status IS DISTINCT FROM status::text;
  ELSE
    RAISE EXCEPTION 'Unsupported jobs.status type for finance decoupling: % (%)', v_status_type, v_status_udt
      USING ERRCODE = '42804';
  END IF;
END
$$;

-- Some live XDrive histories have already removed the obsolete helper while a
-- fresh historical replay still creates it. Keep the migration valid in both
-- states: annotate it only when it is actually present.
DO $$
BEGIN
  IF to_regprocedure('public.fn_sync_job_status_from_invoice()') IS NOT NULL THEN
    COMMENT ON FUNCTION public.fn_sync_job_status_from_invoice() IS
      'Legacy compatibility function retained for migration history only. Its trigger is intentionally disabled: invoice lifecycle belongs to public.invoices and must not overwrite canonical job execution state.';
  END IF;
END
$$;

COMMIT;
