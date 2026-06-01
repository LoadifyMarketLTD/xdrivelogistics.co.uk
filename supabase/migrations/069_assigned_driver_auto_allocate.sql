-- Migration 069: Auto-advance job status to 'allocated' when assigned_driver_id is set
-- This is the DB-level safety net for the admin job-detail UI and the bid-acceptance RPC.
-- Any path that sets jobs.assigned_driver_id on a pre-allocation job will automatically
-- update the status and append a status_history entry.

BEGIN;

-- ── 1. Trigger function ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_auto_allocate_on_driver_assign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when assigned_driver_id transitions from NULL to a value
  IF NEW.assigned_driver_id IS NOT NULL
     AND (OLD.assigned_driver_id IS NULL OR OLD.assigned_driver_id <> NEW.assigned_driver_id)
     AND NEW.status IN ('draft', 'posted', 'received')
  THEN
    NEW.status := 'allocated';

    -- Append allocation event to status_history (JSONB array)
    NEW.status_history := COALESCE(NEW.status_history, '[]'::jsonb)
      || jsonb_build_object(
           'status',    'allocated',
           'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
         );
  END IF;

  -- Clear assigned_driver_id and revert status when driver is removed, if still allocated
  IF NEW.assigned_driver_id IS NULL
     AND OLD.assigned_driver_id IS NOT NULL
     AND NEW.status = 'allocated'
  THEN
    NEW.status := 'posted';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. Attach trigger ────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_auto_allocate_on_driver_assign ON public.jobs;

CREATE TRIGGER trg_auto_allocate_on_driver_assign
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_allocate_on_driver_assign();

COMMIT;
