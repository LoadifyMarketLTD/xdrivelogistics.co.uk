BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Vehicle advertising is an authenticated user mutation surface. Preserve the
-- existing owner/admin/fleet-manager/dispatcher and assigned-driver semantics,
-- but bind them to an active company and active actor/driver state.
CREATE OR REPLACE FUNCTION public.set_vehicle_advertising_state(
  p_vehicle_id uuid,
  p_state text,
  p_reason text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  vehicle_id uuid,
  company_id uuid,
  previous_state text,
  new_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor_user_id uuid := auth.uid();
  v_company_id uuid;
  v_assigned_driver_id uuid;
  v_previous_state text;
  v_next_state text := lower(trim(coalesce(p_state, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_company_status text;
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
    v.advertising_state,
    c.status::text
  INTO
    v_company_id,
    v_assigned_driver_id,
    v_previous_state,
    v_company_status
  FROM public.vehicles v
  JOIN public.companies c ON c.id = v.company_id
  WHERE v.id = p_vehicle_id
  FOR UPDATE OF v;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle % not found.', p_vehicle_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_company_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Vehicle company is not active.'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.profiles p ON p.user_id = cm.user_id
    WHERE cm.user_id = v_actor_user_id
      AND cm.company_id = v_company_id
      AND cm.status::text = 'active'
      AND cm.role_in_company::text IN ('owner', 'admin', 'fleet_manager', 'dispatcher')
      AND COALESCE(p.status::text, '') = 'active'
  ) INTO v_can_manage;

  IF NOT v_can_manage AND v_assigned_driver_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.drivers d
      JOIN public.profiles p ON p.user_id = d.user_id
      WHERE d.id = v_assigned_driver_id
        AND d.user_id = v_actor_user_id
        AND d.company_id = v_company_id
        AND COALESCE(d.status::text, '') = 'active'
        AND COALESCE(d.app_access, true) = true
        AND COALESCE(p.status::text, '') = 'active'
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
    v_reason || ' | metadata=' || coalesce(p_metadata::text, '{}'::text)
  );

  RETURN QUERY SELECT p_vehicle_id, v_company_id, v_previous_state, v_next_state;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_vehicle_advertising_state(uuid, text, text, jsonb)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_vehicle_advertising_state(uuid, text, text, jsonb)
TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
