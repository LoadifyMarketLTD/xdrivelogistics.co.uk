-- Fleet/company allocation convergence for the owner-approved canonical
-- driver + vehicle operational contract.
--
-- Keeps the existing assign_job_driver_atomic API/signature and lifecycle
-- behaviour, but replaces status-only driver eligibility with the shared
-- driver_operational_eligibility resolver and persists jobs.vehicle_id.

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
  v_next_status text;
  v_note text;
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

  -- Preserve the existing lifecycle behaviour. Reallocation of an already
  -- executing job must not reset execution status back to allocated.
  v_next_status := v_job.status;
  IF p_driver_id IS NOT NULL
     AND lower(COALESCE(v_job.status::text, '')) IN ('draft', 'posted', 'received', 'awarded', 'open') THEN
    v_next_status := 'allocated';
  ELSIF p_driver_id IS NULL
        AND lower(COALESCE(v_job.status::text, '')) = 'allocated' THEN
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

  v_note := CASE
    WHEN p_driver_id IS NULL THEN 'Driver and vehicle assignment cleared.'
    ELSE format('Driver and canonical vehicle assigned (%s).', v_driver_vehicle_id)
  END;

  INSERT INTO public.job_tracking_events (job_id, event_type, created_by, note)
  VALUES (
    p_job_id,
    CASE
      WHEN p_driver_id IS NULL THEN 'note'::public.tracking_event_type
      ELSE 'allocated'::public.tracking_event_type
    END,
    p_actor_user_id,
    v_note
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
  'Authorised Fleet allocation/reallocation: selected driver must pass canonical operational eligibility and jobs.vehicle_id is atomically set to that driver canonical active compliant vehicle.';

NOTIFY pgrst, 'reload schema';

COMMIT;
