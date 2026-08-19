-- Preserve current_status as the canonical execution state when a legacy writer
-- updates jobs.status directly without touching current_status.
--
-- This is a compatibility backstop only. Canonical RPCs already update both
-- columns explicitly and therefore bypass this synchronization branch.
-- Finance aliases (invoiced/paid) are intentionally excluded because invoice
-- lifecycle is canonical in public.invoices and must not overwrite execution.
--
-- No existing rows are rewritten here. Historical drift remains observable and
-- can be repaired separately only with evidence for the affected rows.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.fn_sync_legacy_job_status_into_current_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_execution_status text;
BEGIN
  IF TG_OP <> 'UPDATE'
     OR NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.current_status IS DISTINCT FROM OLD.current_status THEN
    RETURN NEW;
  END IF;

  v_status := lower(btrim(COALESCE(NEW.status::text, '')));

  -- Normalize only aliases already recognized by the approved Driver/workspace
  -- lifecycle. Unknown values and Finance-only aliases are never projected into
  -- current_status by this compatibility trigger.
  v_execution_status := CASE v_status
    WHEN 'assigned' THEN 'allocated'
    WHEN 'accepted' THEN 'allocated'
    WHEN 'on_my_way_to_pickup' THEN 'on_my_way'
    WHEN 'arrived_pickup' THEN 'on_site_pickup'
    WHEN 'collected' THEN 'loaded'
    WHEN 'on_route_delivery' THEN 'in_transit'
    WHEN 'on_my_way_to_delivery' THEN 'in_transit'
    WHEN 'arrived_delivery' THEN 'on_site_delivery'
    WHEN 'draft' THEN 'draft'
    WHEN 'open' THEN 'open'
    WHEN 'received' THEN 'received'
    WHEN 'posted' THEN 'posted'
    WHEN 'quoted' THEN 'quoted'
    WHEN 'awarded' THEN 'awarded'
    WHEN 'allocated' THEN 'allocated'
    WHEN 'on_my_way' THEN 'on_my_way'
    WHEN 'on_site_pickup' THEN 'on_site_pickup'
    WHEN 'loaded' THEN 'loaded'
    WHEN 'in_transit' THEN 'in_transit'
    WHEN 'on_site_delivery' THEN 'on_site_delivery'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'completed' THEN 'completed'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'disputed' THEN 'disputed'
    WHEN 'driver_declined' THEN 'driver_declined'
    WHEN 'expired' THEN 'expired'
    ELSE NULL
  END;

  IF v_execution_status IS NOT NULL THEN
    NEW.current_status := v_execution_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_legacy_status_current_status_sync ON public.jobs;
CREATE TRIGGER trg_jobs_legacy_status_current_status_sync
BEFORE UPDATE OF status, current_status ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_legacy_job_status_into_current_status();

COMMENT ON FUNCTION public.fn_sync_legacy_job_status_into_current_status() IS
  'Compatibility backstop: direct status-only job writers are normalized into canonical current_status; explicit current_status writes and Finance aliases are preserved untouched.';

COMMIT;
