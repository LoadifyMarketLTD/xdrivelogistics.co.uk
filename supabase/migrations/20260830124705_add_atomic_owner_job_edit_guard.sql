BEGIN;

CREATE OR REPLACE FUNCTION public.update_unbid_exchange_job_atomic(
  p_job_id uuid,
  p_actor_user_id uuid,
  p_patch jsonb,
  p_stops jsonb DEFAULT '[]'::jsonb,
  p_publish boolean DEFAULT true,
  p_expire_hours integer DEFAULT 72
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_status text;
  v_current_status text;
  v_final_status text;
  v_now timestamptz := now();
  v_expire_hours integer := greatest(coalesce(p_expire_hours, 72), 1);
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated actor is required.' USING ERRCODE = '42501';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'A valid load patch is required.' USING ERRCODE = '22023';
  END IF;

  IF p_stops IS NULL THEN
    p_stops := '[]'::jsonb;
  END IF;
  IF jsonb_typeof(p_stops) <> 'array' THEN
    RAISE EXCEPTION 'Stops must be supplied as an array.' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_job
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.user_id = p_actor_user_id
      AND cm.company_id = v_job.company_id
      AND cm.status = 'active'
      AND cm.role_in_company::text IN ('owner', 'admin', 'dispatcher')
  ) THEN
    RAISE EXCEPTION
      'Only an authorised member of the load-owning company can edit this load.'
      USING ERRCODE = '42501';
  END IF;

  v_status := lower(btrim(coalesce(v_job.status, '')));
  v_current_status := lower(btrim(coalesce(v_job.current_status, '')));

  IF v_status NOT IN ('draft', 'received', 'posted')
     OR v_current_status NOT IN ('draft', 'received', 'posted') THEN
    RAISE EXCEPTION
      'Only pre-award loads can be edited.'
      USING ERRCODE = '23514';
  END IF;

  IF v_job.awarded_carrier_company_id IS NOT NULL
     OR v_job.assigned_company_id IS NOT NULL
     OR v_job.assigned_driver_id IS NOT NULL
     OR v_job.vehicle_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Active, awarded or assigned loads cannot be edited.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.job_bids WHERE job_id = p_job_id) THEN
    RAISE EXCEPTION
      'Carrier quotes already exist for this load. Changing the transport terms would make those quotes stale.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.job_commercial_agreements WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.proof_of_delivery WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.invoices WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.job_disputes WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.job_cancellation_requests WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.invoice_disputes WHERE job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.quotes WHERE converted_job_id = p_job_id)
     OR EXISTS (SELECT 1 FROM public.reviews WHERE job_id = p_job_id) THEN
    RAISE EXCEPTION
      'This load already has protected commercial or execution history.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.job_stops s
    WHERE s.job_id = p_job_id
      AND (
        lower(coalesce(s.status, 'pending')) <> 'pending'
        OR s.arrived_at IS NOT NULL
        OR s.completed_at IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION
      'This load already has progressed stop history.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_stops) AS s(sequence integer, stop_type text, address text)
    WHERE s.sequence IS NULL OR s.sequence < 1
       OR lower(coalesce(s.stop_type, '')) NOT IN ('collection', 'delivery')
       OR nullif(btrim(coalesce(s.address, '')), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more route stops are invalid.' USING ERRCODE = '22023';
  END IF;

  -- A posted load remains posted while its editable terms are replaced. The
  -- entire RPC is one transaction, so marketplace readers never observe a
  -- temporary posted -> draft regression or a half-replaced multi-drop route.
  IF v_status = 'posted' OR v_current_status = 'posted' THEN
    IF NOT coalesce(p_publish, true) THEN
      RAISE EXCEPTION
        'A posted load cannot be moved back to draft by editing; cancel it instead.'
        USING ERRCODE = '23514';
    END IF;
    v_final_status := 'posted';
  ELSIF coalesce(p_publish, false) THEN
    v_final_status := 'posted';
  ELSIF v_status = 'received' OR v_current_status = 'received' THEN
    v_final_status := 'received';
  ELSE
    v_final_status := 'draft';
  END IF;

  UPDATE public.jobs
  SET status = v_final_status,
      current_status = v_final_status,
      pickup_location = p_patch ->> 'pickup_location',
      pickup_postcode = p_patch ->> 'pickup_postcode',
      pickup_datetime = (p_patch ->> 'pickup_datetime')::timestamptz,
      pickup_time_slot = p_patch ->> 'pickup_time_slot',
      delivery_location = p_patch ->> 'delivery_location',
      delivery_postcode = p_patch ->> 'delivery_postcode',
      delivery_datetime = (p_patch ->> 'delivery_datetime')::timestamptz,
      delivery_time_slot = p_patch ->> 'delivery_time_slot',
      collection_contact_name = p_patch ->> 'collection_contact_name',
      collection_contact_phone = p_patch ->> 'collection_contact_phone',
      delivery_contact_name = p_patch ->> 'delivery_contact_name',
      delivery_contact_phone = p_patch ->> 'delivery_contact_phone',
      client_name = p_patch ->> 'client_name',
      client_email = p_patch ->> 'client_email',
      client_phone = p_patch ->> 'client_phone',
      customer_reference = p_patch ->> 'customer_reference',
      purchase_order_number = p_patch ->> 'purchase_order_number',
      booking_reference = p_patch ->> 'booking_reference',
      vehicle_type = p_patch ->> 'vehicle_type',
      requested_vehicle_label = p_patch ->> 'requested_vehicle_label',
      cargo_type = p_patch ->> 'cargo_type',
      requested_cargo_label = p_patch ->> 'requested_cargo_label',
      weight_kg = (p_patch ->> 'weight_kg')::numeric,
      pallets = (p_patch ->> 'pallets')::integer,
      length_cm = (p_patch ->> 'length_cm')::numeric,
      width_cm = (p_patch ->> 'width_cm')::numeric,
      height_cm = (p_patch ->> 'height_cm')::numeric,
      cargo_value_gbp = (p_patch ->> 'cargo_value_gbp')::numeric,
      budget_amount = (p_patch ->> 'budget_amount')::numeric,
      collection_tail_lift_required = coalesce((p_patch ->> 'collection_tail_lift_required')::boolean, false),
      collection_forklift_available = coalesce((p_patch ->> 'collection_forklift_available')::boolean, false),
      collection_handball_required = coalesce((p_patch ->> 'collection_handball_required')::boolean, false),
      special_requirements = p_patch ->> 'special_requirements',
      load_details = p_patch -> 'load_details',
      exchange_visibility = CASE WHEN v_final_status = 'posted' THEN 'exchange' ELSE 'private' END,
      exchange_posted_at = CASE WHEN v_final_status = 'posted' THEN v_now ELSE NULL END,
      exchange_expires_at = CASE WHEN v_final_status = 'posted' THEN v_now + make_interval(hours => v_expire_hours) ELSE NULL END,
      updated_at = v_now
  WHERE id = p_job_id;

  DELETE FROM public.job_stops
  WHERE job_id = p_job_id;

  IF jsonb_array_length(p_stops) > 0 THEN
    INSERT INTO public.job_stops(
      job_id,
      sequence,
      stop_type,
      address,
      postcode,
      contact_name,
      contact_phone,
      window_start,
      instructions
    )
    SELECT
      p_job_id,
      s.sequence,
      lower(s.stop_type),
      s.address,
      s.postcode,
      s.contact_name,
      s.contact_phone,
      s.window_start,
      s.instructions
    FROM jsonb_to_recordset(p_stops) AS s(
      sequence integer,
      stop_type text,
      address text,
      postcode text,
      contact_name text,
      contact_phone text,
      window_start timestamptz,
      instructions text
    )
    ORDER BY s.sequence;
  END IF;

  INSERT INTO public.owner_audit_log(
    target_type,
    target_id,
    target_name,
    metadata,
    actor_user_id,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason
  )
  VALUES (
    'job',
    v_job.id,
    'XDL-' || upper(left(v_job.id::text, 8)),
    jsonb_build_object(
      'source', 'workspace_owner_edit',
      'previous_current_status', v_current_status,
      'stop_count', jsonb_array_length(p_stops)
    ),
    p_actor_user_id,
    v_job.company_id,
    'exchange_load_edited_without_bids',
    v_status,
    v_final_status,
    'Load terms edited before bids, award or execution history.'
  );

  RETURN jsonb_build_object(
    'id', p_job_id,
    'status', v_final_status,
    'current_status', v_final_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.update_unbid_exchange_job_atomic(uuid, uuid, jsonb, jsonb, boolean, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_unbid_exchange_job_atomic(uuid, uuid, jsonb, jsonb, boolean, integer) FROM anon;
REVOKE ALL ON FUNCTION public.update_unbid_exchange_job_atomic(uuid, uuid, jsonb, jsonb, boolean, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_unbid_exchange_job_atomic(uuid, uuid, jsonb, jsonb, boolean, integer) TO service_role;

COMMIT;
