-- Preserve the approved canonical execution lifecycle during Fleet
-- allocation/reallocation.
--
-- This is a narrow repair of the existing assign_job_driver_atomic RPC. It does
-- not add lifecycle states, roles, grants, schema or permissions. Assignment
-- changes derive their effective lifecycle from current_status first (with
-- status as fallback), using the same already-approved historical aliases as
-- the canonical driver lifecycle. Active execution reallocation also requires
-- an eligible replacement rather than clearing the execution identity.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.assign_job_driver_atomic(
  p_job_id uuid,
  p_driver_id uuid,
  p_expected_assigned_driver_id uuid,
  p_actor_user_id uuid
)
RETURNS TABLE(
  job_id uuid,
  status text,
  current_status text,
  assigned_driver_id uuid,
  assigned_company_id uuid,
  awarded_carrier_company_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_allowed_company_id uuid;
  v_role text;
  v_driver_company_id uuid;
  v_driver_eligible boolean := false;
  v_driver_vehicle_id uuid;
  v_driver_blockers text[] := ARRAY[]::text[];
  v_effective_status text;
  v_next_status text;
  v_message text;
BEGIN
  SELECT *
  INTO v_job
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_job.assigned_driver_id IS DISTINCT FROM p_expected_assigned_driver_id THEN
    RAISE EXCEPTION 'Job assignment changed while this request was in progress.' USING ERRCODE = '40001';
  END IF;

  v_allowed_company_id := COALESCE(v_job.awarded_carrier_company_id, v_job.company_id);

  SELECT cm.role_in_company::text
  INTO v_role
  FROM public.company_memberships cm
  WHERE cm.company_id = v_allowed_company_id
    AND cm.user_id = p_actor_user_id
    AND COALESCE(cm.status::text, '') = 'active'
  LIMIT 1;

  IF COALESCE(v_role, '') NOT IN ('owner', 'admin', 'dispatcher') THEN
    IF v_job.awarded_carrier_company_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only an operator of the awarded carrier can assign a driver after award.' USING ERRCODE = '42501';
    END IF;
    RAISE EXCEPTION 'Only an operator of the job owner company can assign a driver before award.' USING ERRCODE = '42501';
  END IF;

  IF p_driver_id IS NOT NULL THEN
    SELECT d.company_id
    INTO v_driver_company_id
    FROM public.drivers d
    WHERE d.id = p_driver_id
    FOR UPDATE;

    IF NOT FOUND OR v_driver_company_id IS DISTINCT FROM v_allowed_company_id THEN
      RAISE EXCEPTION 'Driver does not belong to the assignable company.' USING ERRCODE = '23514';
    END IF;

    SELECT readiness.eligible, readiness.vehicle_id, readiness.blockers
    INTO v_driver_eligible, v_driver_vehicle_id, v_driver_blockers
    FROM public.driver_operational_eligibility(p_driver_id) readiness;

    IF NOT COALESCE(v_driver_eligible, false) OR v_driver_vehicle_id IS NULL THEN
      RAISE EXCEPTION 'Driver/vehicle is not operationally eligible: %',
        array_to_string(COALESCE(v_driver_blockers, ARRAY[]::text[]), ', ')
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- current_status is the canonical execution source where present. Keep the
  -- already-approved historical aliases aligned with driver_update_job_status_atomic
  -- and workspace presentation; do not define any new lifecycle state here.
  v_effective_status := lower(COALESCE(
    NULLIF(btrim(v_job.current_status::text), ''),
    NULLIF(btrim(v_job.status::text), '')
  ));
  v_effective_status := CASE v_effective_status
    WHEN 'assigned' THEN 'allocated'
    WHEN 'accepted' THEN 'allocated'
    WHEN 'arrived_pickup' THEN 'on_site_pickup'
    WHEN 'collected' THEN 'loaded'
    WHEN 'on_route_delivery' THEN 'in_transit'
    WHEN 'on_my_way_to_delivery' THEN 'in_transit'
    WHEN 'arrived_delivery' THEN 'on_site_delivery'
    ELSE v_effective_status
  END;

  -- The approved reallocation contract requires an eligible replacement driver
  -- and that driver's canonical vehicle while execution is active. Clearing the
  -- binding is still allowed by the existing pre-execution allocated flow only.
  IF p_driver_id IS NULL
     AND v_effective_status IN (
       'on_my_way',
       'on_my_way_to_pickup',
       'on_site_pickup',
       'loaded',
       'in_transit',
       'on_site_delivery'
     ) THEN
    RAISE EXCEPTION 'Active execution requires an eligible replacement driver and canonical vehicle.'
      USING ERRCODE = '23514';
  END IF;

  -- Preserve execution/completion state during reallocation. Only the existing
  -- pre-execution allocation/clear transitions may change lifecycle state.
  v_next_status := v_effective_status;
  IF p_driver_id IS NOT NULL
     AND v_effective_status IN ('draft', 'posted', 'received', 'awarded', 'open') THEN
    v_next_status := 'allocated';
  ELSIF p_driver_id IS NULL
        AND v_effective_status = 'allocated' THEN
    v_next_status := CASE
      WHEN v_job.awarded_carrier_company_id IS NOT NULL THEN 'awarded'
      ELSE 'posted'
    END;
  END IF;

  UPDATE public.jobs
  SET assigned_driver_id = p_driver_id,
      assigned_company_id = CASE WHEN p_driver_id IS NULL THEN NULL ELSE v_allowed_company_id END,
      vehicle_id = CASE WHEN p_driver_id IS NULL THEN NULL ELSE v_driver_vehicle_id END,
      status = v_next_status,
      current_status = v_next_status,
      updated_at = now()
  WHERE id = p_job_id;

  v_message := CASE
    WHEN p_driver_id IS NULL THEN 'Driver and vehicle assignment cleared.'
    ELSE format('Driver and canonical vehicle assigned (%s).', v_driver_vehicle_id)
  END;

  INSERT INTO public.job_tracking_events (job_id, event_type, created_by, message, meta)
  VALUES (
    p_job_id,
    CASE
      WHEN p_driver_id IS NULL THEN 'note'::public.tracking_event_type
      ELSE 'allocated'::public.tracking_event_type
    END,
    p_actor_user_id,
    v_message,
    jsonb_build_object(
      'assigned_driver_id', p_driver_id,
      'vehicle_id', CASE WHEN p_driver_id IS NULL THEN NULL ELSE v_driver_vehicle_id END,
      'assignment_cleared', p_driver_id IS NULL
    )
  );

  RETURN QUERY
  SELECT
    j.id,
    j.status::text,
    j.current_status::text,
    j.assigned_driver_id,
    j.assigned_company_id,
    j.awarded_carrier_company_id
  FROM public.jobs j
  WHERE j.id = p_job_id;
END;
$$;

COMMENT ON FUNCTION public.assign_job_driver_atomic(uuid, uuid, uuid, uuid) IS
  'Authorised Fleet allocation/reallocation: selected driver must pass canonical operational eligibility, jobs.vehicle_id follows that driver canonical active compliant vehicle, active execution requires a replacement rather than a clear, and existing execution lifecycle is preserved from current_status.';

NOTIFY pgrst, 'reload schema';

COMMIT;
