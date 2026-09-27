-- Fleet Manager persisted role foundation.
-- Adds the dedicated company role required by the CX role/function blueprint and
-- extends only the fleet-operational RPCs that Fleet Manager must execute.

BEGIN;

ALTER TABLE public.company_memberships
  DROP CONSTRAINT IF EXISTS company_memberships_role_in_company_check;

ALTER TABLE public.company_memberships
  ADD CONSTRAINT company_memberships_role_in_company_check
  CHECK (role_in_company = ANY (ARRAY[
    'owner'::text,
    'admin'::text,
    'fleet_manager'::text,
    'member'::text,
    'dispatcher'::text,
    'viewer'::text
  ]));

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

  IF COALESCE(v_role, '') NOT IN ('owner', 'admin', 'fleet_manager', 'dispatcher') THEN
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

  v_effective_status := lower(COALESCE(
    NULLIF(btrim(v_job.current_status::text), ''),
    NULLIF(btrim(v_job.status::text), '')
  ));
  v_effective_status := CASE v_effective_status
    WHEN 'assigned' THEN 'allocated'
    WHEN 'accepted' THEN 'allocated'
    WHEN 'on_my_way_to_pickup' THEN 'on_my_way'
    WHEN 'arrived_pickup' THEN 'on_site_pickup'
    WHEN 'collected' THEN 'loaded'
    WHEN 'on_route_delivery' THEN 'in_transit'
    WHEN 'on_my_way_to_delivery' THEN 'in_transit'
    WHEN 'arrived_delivery' THEN 'on_site_delivery'
    ELSE v_effective_status
  END;

  IF p_driver_id IS NULL
     AND v_effective_status IN (
       'on_my_way',
       'on_site_pickup',
       'loaded',
       'in_transit',
       'on_site_delivery'
     ) THEN
    RAISE EXCEPTION 'Active execution requires an eligible replacement driver and canonical vehicle.'
      USING ERRCODE = '23514';
  END IF;

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
      assigned_company_id = CASE
        WHEN p_driver_id IS NULL THEN v_job.awarded_carrier_company_id
        ELSE v_allowed_company_id
      END,
      vehicle_id = CASE WHEN p_driver_id IS NULL THEN NULL ELSE v_driver_vehicle_id END,
      status = v_next_status,
      current_status = v_next_status,
      updated_at = now()
  WHERE id = p_job_id;

  v_message := CASE
    WHEN p_driver_id IS NULL THEN 'Driver and vehicle assignment cleared.'
    ELSE format('Driver and canonical vehicle assigned (%s).', v_driver_vehicle_id)
  END;

  -- Live XDrive stores job_tracking_events.event_type as constrained text.
  -- Use the canonical text vocabulary directly instead of casting through the
  -- historical tracking_event_type enum, which is not the live column type.
  INSERT INTO public.job_tracking_events (job_id, event_type, created_by, message, meta)
  VALUES (
    p_job_id,
    CASE WHEN p_driver_id IS NULL THEN 'note' ELSE 'allocated' END,
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
  'Authorised Fleet allocation/reallocation for owner/admin/fleet_manager/dispatcher operators; selected driver must pass canonical operational eligibility and lifecycle continuity is preserved.';

CREATE OR REPLACE FUNCTION public.set_vehicle_advertising_state(
  p_vehicle_id uuid,
  p_state text,
  p_reason text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  vehicle_id uuid,
  company_id uuid,
  previous_state text,
  new_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id uuid := auth.uid();
  v_company_id uuid;
  v_assigned_driver_id uuid;
  v_previous_state text;
  v_next_state text := lower(trim(coalesce(p_state, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_can_manage boolean := false;
  v_updated_count integer := 0;
BEGIN
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Forbidden - auth.uid() is required for this RPC.'
      USING ERRCODE = '42501';
  END IF;

  IF p_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'vehicle_id is required.'
      USING ERRCODE = '23514';
  END IF;

  IF v_next_state NOT IN ('none', 'exchange', 'partner') THEN
    RAISE EXCEPTION 'Invalid advertising state: %', p_state
      USING ERRCODE = '22023';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A non-empty reason is required for advertising-state changes.'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'metadata must be a JSON object.'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    v.company_id,
    v.assigned_driver_id,
    v.advertising_state
  INTO
    v_company_id,
    v_assigned_driver_id,
    v_previous_state
  FROM public.vehicles v
  WHERE v.id = p_vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle % not found.', p_vehicle_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.user_id = v_actor_user_id
      AND cm.company_id = v_company_id
      AND cm.status = 'active'
      AND cm.role_in_company IN ('owner', 'admin', 'fleet_manager', 'dispatcher')
  ) INTO v_can_manage;

  IF NOT v_can_manage AND v_assigned_driver_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = v_assigned_driver_id
        AND d.user_id = v_actor_user_id
        AND d.company_id = v_company_id
    ) INTO v_can_manage;
  END IF;

  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'Forbidden - you cannot change this vehicle advertising state.'
      USING ERRCODE = '42501';
  END IF;

  IF v_previous_state = v_next_state THEN
    RETURN QUERY SELECT p_vehicle_id, v_company_id, v_previous_state, v_previous_state;
    RETURN;
  END IF;

  UPDATE public.vehicles AS vehicle
  SET advertising_state = v_next_state
  WHERE vehicle.id = p_vehicle_id
    AND vehicle.company_id = v_company_id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'Advertising-state update failed for vehicle %.', p_vehicle_id
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_company_id,
    target_type,
    target_id,
    target_name,
    action_type,
    old_status,
    new_status,
    reason
  )
  VALUES (
    v_actor_user_id,
    v_company_id,
    'vehicle',
    p_vehicle_id,
    'vehicle_advertising_state',
    'vehicle_advertising_state_updated',
    v_previous_state,
    v_next_state,
    v_reason
      || ' | metadata='
      || coalesce(p_metadata::text, '{}'::text)
  );

  RETURN QUERY SELECT p_vehicle_id, v_company_id, v_previous_state, v_next_state;
END;
$$;

REVOKE ALL ON FUNCTION public.set_vehicle_advertising_state(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_vehicle_advertising_state(uuid, text, text, jsonb) TO authenticated;

-- Fleet Manager owns operational Diary grouping, but not commercial booking
-- ownership controls such as edit/cancel/rebook/repost.
DROP POLICY IF EXISTS diary_groups_insert_operator ON public.diary_groups;
CREATE POLICY diary_groups_insert_operator ON public.diary_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.active_company_membership_role(company_id, auth.uid()) IN ('owner', 'admin', 'fleet_manager', 'dispatcher')
  );

DROP POLICY IF EXISTS diary_groups_update_operator ON public.diary_groups;
CREATE POLICY diary_groups_update_operator ON public.diary_groups
  FOR UPDATE TO authenticated
  USING (public.active_company_membership_role(company_id, auth.uid()) IN ('owner', 'admin', 'fleet_manager', 'dispatcher'))
  WITH CHECK (public.active_company_membership_role(company_id, auth.uid()) IN ('owner', 'admin', 'fleet_manager', 'dispatcher'));

DROP POLICY IF EXISTS diary_groups_delete_operator ON public.diary_groups;
CREATE POLICY diary_groups_delete_operator ON public.diary_groups
  FOR DELETE TO authenticated
  USING (public.active_company_membership_role(company_id, auth.uid()) IN ('owner', 'admin', 'fleet_manager', 'dispatcher'));

DROP POLICY IF EXISTS diary_group_jobs_insert_operator ON public.diary_group_jobs;
CREATE POLICY diary_group_jobs_insert_operator ON public.diary_group_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    added_by = auth.uid()
    AND public.active_company_membership_role(company_id, auth.uid()) IN ('owner', 'admin', 'fleet_manager', 'dispatcher')
  );

DROP POLICY IF EXISTS diary_group_jobs_delete_operator ON public.diary_group_jobs;
CREATE POLICY diary_group_jobs_delete_operator ON public.diary_group_jobs
  FOR DELETE TO authenticated
  USING (public.active_company_membership_role(company_id, auth.uid()) IN ('owner', 'admin', 'fleet_manager', 'dispatcher'));

COMMIT;

NOTIFY pgrst, 'reload schema';
