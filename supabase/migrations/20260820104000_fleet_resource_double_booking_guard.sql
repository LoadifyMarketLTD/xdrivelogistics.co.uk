-- PreLive P1 remediation: prevent Driver / Vehicle double-booking at the shared
-- database authority rather than in a single UI or RPC path.
--
-- This guard covers Fleet allocation, named-driver award auto-allocation and any
-- future mutation path that changes assigned_driver_id, vehicle_id or the job
-- execution window. Concurrent assignments to different jobs are serialized by
-- advisory locks on the Driver and canonical Vehicle resources.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Restore the canonical scheduling-duration column when hosted schema history
-- contains the legacy migration but the physical column has drifted.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS job_distance_minutes integer;

CREATE OR REPLACE FUNCTION public.guard_job_resource_double_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_target_start timestamptz;
  v_target_end timestamptz;
  v_conflict_job_id uuid;
  v_conflict_status text;
BEGIN
  -- Clearing an assignment cannot create a resource collision.
  IF NEW.assigned_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_status := lower(COALESCE(
    NULLIF(btrim(NEW.current_status::text), ''),
    NULLIF(btrim(NEW.status::text), ''),
    ''
  ));
  v_status := CASE v_status
    WHEN 'assigned' THEN 'allocated'
    WHEN 'accepted' THEN 'allocated'
    WHEN 'on_my_way_to_pickup' THEN 'on_my_way'
    WHEN 'arrived_pickup' THEN 'on_site_pickup'
    WHEN 'collected' THEN 'loaded'
    WHEN 'on_route_delivery' THEN 'in_transit'
    WHEN 'on_my_way_to_delivery' THEN 'in_transit'
    WHEN 'arrived_delivery' THEN 'on_site_delivery'
    ELSE v_status
  END;

  -- Terminal/financial states no longer reserve operational resources.
  IF v_status IN ('delivered', 'completed', 'cancelled', 'invoiced', 'paid', 'disputed') THEN
    RETURN NEW;
  END IF;

  -- Scheduling is mandatory before an executing resource can be reserved.
  v_target_start := NEW.pickup_datetime;
  IF v_target_start IS NULL THEN
    RAISE EXCEPTION 'Job pickup time is required before driver/vehicle allocation.'
      USING ERRCODE = '23514';
  END IF;

  v_target_end := COALESCE(
    NEW.delivery_datetime,
    CASE
      WHEN NEW.job_distance_minutes IS NOT NULL AND NEW.job_distance_minutes > 0
        THEN NEW.pickup_datetime + make_interval(mins => NEW.job_distance_minutes)
      ELSE NULL
    END,
    NEW.pickup_datetime
  );

  IF v_target_end < v_target_start THEN
    RAISE EXCEPTION 'Job delivery time cannot be earlier than pickup time for resource allocation.'
      USING ERRCODE = '23514';
  END IF;

  -- Resource-scoped transaction locks close the race where two different job
  -- rows are allocated concurrently. Lock order is always Driver then Vehicle.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('xdrive-driver-schedule:' || NEW.assigned_driver_id::text, 0)
  );
  IF NEW.vehicle_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('xdrive-vehicle-schedule:' || NEW.vehicle_id::text, 0)
    );
  END IF;

  WITH candidate_jobs AS (
    SELECT
      j.id,
      j.pickup_datetime,
      COALESCE(
        j.delivery_datetime,
        CASE
          WHEN j.job_distance_minutes IS NOT NULL AND j.job_distance_minutes > 0
            THEN j.pickup_datetime + make_interval(mins => j.job_distance_minutes)
          ELSE NULL
        END,
        j.pickup_datetime
      ) AS effective_end,
      CASE lower(COALESCE(
        NULLIF(btrim(j.current_status::text), ''),
        NULLIF(btrim(j.status::text), ''),
        ''
      ))
        WHEN 'assigned' THEN 'allocated'
        WHEN 'accepted' THEN 'allocated'
        WHEN 'on_my_way_to_pickup' THEN 'on_my_way'
        WHEN 'arrived_pickup' THEN 'on_site_pickup'
        WHEN 'collected' THEN 'loaded'
        WHEN 'on_route_delivery' THEN 'in_transit'
        WHEN 'on_my_way_to_delivery' THEN 'in_transit'
        WHEN 'arrived_delivery' THEN 'on_site_delivery'
        ELSE lower(COALESCE(
          NULLIF(btrim(j.current_status::text), ''),
          NULLIF(btrim(j.status::text), ''),
          ''
        ))
      END AS effective_status
    FROM public.jobs j
    WHERE j.id IS DISTINCT FROM NEW.id
      AND (
        j.assigned_driver_id = NEW.assigned_driver_id
        OR (NEW.vehicle_id IS NOT NULL AND j.vehicle_id = NEW.vehicle_id)
      )
  )
  SELECT c.id, c.effective_status
  INTO v_conflict_job_id, v_conflict_status
  FROM candidate_jobs c
  WHERE c.effective_status NOT IN ('delivered', 'completed', 'cancelled', 'invoiced', 'paid', 'disputed')
    AND (
      -- A resource already executing another job is unavailable regardless of
      -- stale/planned timestamps.
      c.effective_status IN ('on_my_way', 'on_site_pickup', 'loaded', 'in_transit', 'on_site_delivery')
      OR (
        c.pickup_datetime IS NOT NULL
        AND c.effective_end IS NOT NULL
        AND c.pickup_datetime <= v_target_end
        AND v_target_start <= c.effective_end
      )
    )
  ORDER BY
    CASE WHEN c.effective_status IN ('on_my_way', 'on_site_pickup', 'loaded', 'in_transit', 'on_site_delivery') THEN 0 ELSE 1 END,
    c.pickup_datetime NULLS FIRST,
    c.id
  LIMIT 1;

  IF v_conflict_job_id IS NOT NULL THEN
    RAISE EXCEPTION 'Driver or vehicle is already reserved by job % (status %).',
      v_conflict_job_id,
      COALESCE(v_conflict_status, 'unknown')
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_job_resource_double_booking ON public.jobs;
CREATE TRIGGER trg_guard_job_resource_double_booking
  BEFORE INSERT OR UPDATE OF
    assigned_driver_id,
    vehicle_id,
    pickup_datetime,
    delivery_datetime,
    job_distance_minutes
  ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_job_resource_double_booking();

REVOKE ALL ON FUNCTION public.guard_job_resource_double_booking()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_job_resource_double_booking()
  TO service_role;

COMMENT ON FUNCTION public.guard_job_resource_double_booking() IS
  'Canonical Fleet resource reservation guard. Serializes Driver/Vehicle assignment races, rejects active-execution conflicts and overlapping non-terminal job windows, and applies to every DB mutation path including Fleet allocation and named-driver award.';

NOTIFY pgrst, 'reload schema';
COMMIT;
