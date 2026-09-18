CREATE OR REPLACE FUNCTION public.accept_job_bid_atomic(
  p_bid_id uuid,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), p_actor_user_id);
  v_owner_company_id uuid;
  v_quote_vehicle_id uuid;
  v_bidder_driver_id uuid;
  v_job_id uuid;
  v_requested_type text;
  v_vehicle public.vehicles%ROWTYPE;
  v_quote_has_mot boolean := false;
  v_quote_has_insurance boolean := false;
  v_result jsonb;
BEGIN
  IF p_bid_id IS NULL OR v_actor IS NULL THEN
    RETURN public.accept_job_bid_atomic_award_authority_base_v1(p_bid_id, p_actor_user_id);
  END IF;

  SELECT
    j.company_id,
    jb.quote_vehicle_id,
    jb.bidder_driver_id,
    jb.job_id,
    COALESCE(NULLIF(j.requested_vehicle_type, ''), NULLIF(j.vehicle_type::text, ''))
  INTO
    v_owner_company_id,
    v_quote_vehicle_id,
    v_bidder_driver_id,
    v_job_id,
    v_requested_type
  FROM public.job_bids jb
  JOIN public.jobs j ON j.id = jb.job_id
  WHERE jb.id = p_bid_id;

  IF NOT FOUND THEN
    RETURN public.accept_job_bid_atomic_award_authority_base_v1(p_bid_id, p_actor_user_id);
  END IF;

  PERFORM 1
  FROM public.company_memberships cm
  JOIN public.companies c ON c.id = cm.company_id
  WHERE cm.company_id = v_owner_company_id
    AND cm.user_id = v_actor
    AND COALESCE(cm.status::text, '') = 'active'
    AND COALESCE(cm.role_in_company::text, '') IN ('owner', 'admin', 'dispatcher')
    AND COALESCE(c.status::text, '') = 'active'
  FOR SHARE OF cm, c;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'http_status', 403,
      'error_code', 'FORBIDDEN',
      'error_message', 'The job-owning company must be active and the actor must hold an active owner, admin or dispatcher membership.'
    );
  END IF;

  IF v_bidder_driver_id IS NOT NULL THEN
    IF v_quote_vehicle_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'http_status', 409,
        'error_code', 'QUOTE_VEHICLE_MISSING',
        'error_message', 'The driver quote does not identify the vehicle used for this job.'
      );
    END IF;

    SELECT v.* INTO v_vehicle
    FROM public.vehicles v
    WHERE v.id = v_quote_vehicle_id
      AND v.assigned_driver_id = v_bidder_driver_id
      AND COALESCE(v.status::text, '') = 'active';

    IF NOT FOUND OR NOT public.vehicle_can_cover_requested_type(v_vehicle.type, v_requested_type) THEN
      RETURN jsonb_build_object(
        'success', false,
        'http_status', 409,
        'error_code', 'QUOTE_VEHICLE_INVALID',
        'error_message', 'The quoted vehicle is no longer active or compatible with this job.'
      );
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.vehicle_documents vd
      WHERE vd.vehicle_id = v_quote_vehicle_id
        AND lower(COALESCE(vd.status::text, '')) = 'approved'
        AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
        AND regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
            IN ('mot', 'vehiclemot', 'goodsvehicletest')
    ) INTO v_quote_has_mot;

    SELECT EXISTS (
      SELECT 1 FROM public.vehicle_documents vd
      WHERE vd.vehicle_id = v_quote_vehicle_id
        AND lower(COALESCE(vd.status::text, '')) = 'approved'
        AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
        AND regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
            IN ('insurance', 'vehicleinsurance', 'motorfleetinsurance', 'insurancecertificate')
    ) INTO v_quote_has_insurance;

    IF NOT v_quote_has_mot OR NOT v_quote_has_insurance THEN
      RETURN jsonb_build_object(
        'success', false,
        'http_status', 409,
        'error_code', 'QUOTE_VEHICLE_COMPLIANCE_INVALID',
        'error_message', 'The vehicle quoted for this job must have current MOT and insurance.'
      );
    END IF;

    IF public.vehicle_requires_driver_cpc(
      v_vehicle.type,
      v_vehicle.max_weight_kg,
      COALESCE(v_vehicle.is_zero_emission, false)
    ) AND NOT public.driver_has_valid_cpc(v_bidder_driver_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'http_status', 409,
        'error_code', 'DRIVER_CPC_REQUIRED',
        'error_message', 'Driver CPC is required for the vehicle quoted for this job.'
      );
    END IF;
  END IF;

  v_result := public.accept_job_bid_atomic_award_authority_base_v1(p_bid_id, p_actor_user_id);

  IF COALESCE((v_result->>'success')::boolean, false)
     AND v_quote_vehicle_id IS NOT NULL
     AND v_bidder_driver_id IS NOT NULL THEN
    UPDATE public.jobs j
    SET vehicle_id = v_quote_vehicle_id,
        status_history = (
          SELECT COALESCE(jsonb_agg(
            CASE
              WHEN entry->>'status' = 'allocated'
                AND entry->>'auto_assigned_driver_id' = v_bidder_driver_id::text
              THEN jsonb_set(entry, '{auto_assigned_vehicle_id}', to_jsonb(v_quote_vehicle_id), true)
              ELSE entry
            END
          ), '[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(j.status_history, '[]'::jsonb)) entry
        ),
        updated_at = now()
    WHERE j.id = v_job_id
      AND j.assigned_driver_id = v_bidder_driver_id;

    UPDATE public.job_tracking_events event
    SET meta = jsonb_set(COALESCE(event.meta, '{}'::jsonb), '{vehicle_id}', to_jsonb(v_quote_vehicle_id), true)
    WHERE event.id = (
      SELECT latest.id
      FROM public.job_tracking_events latest
      WHERE latest.job_id = v_job_id
        AND latest.event_type = 'allocated'
      ORDER BY latest.created_at DESC, latest.id DESC
      LIMIT 1
    );

    v_result := jsonb_set(v_result, '{vehicle_id}', to_jsonb(v_quote_vehicle_id), true);
  END IF;

  RETURN v_result;
END;
$function$;;
