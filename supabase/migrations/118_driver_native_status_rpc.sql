-- Migration 118: Native driver status updates through an atomic RPC.
--
-- The native Android app must not PATCH jobs directly for the execution
-- workflow. RLS can legitimately hide the updated row from PostgREST, which
-- makes the app think the assignment failed even when the job is valid.
-- This function validates the authenticated driver, checks the live backend
-- lifecycle, lets the existing jobs guardrail enforce compliance/POD rules,
-- and returns the updated job state.

BEGIN;

DROP FUNCTION IF EXISTS public.driver_update_job_status_atomic(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.driver_update_job_status_atomic(
  p_driver_id uuid,
  p_job_id uuid,
  p_next_status text,
  p_collection_photo_url text DEFAULT NULL,
  p_driver_notes text DEFAULT NULL,
  p_delivery_photos jsonb DEFAULT NULL,
  p_delivery_signature_data text DEFAULT NULL,
  p_client_signature_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_driver public.drivers%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_current_status text;
  v_next_status text := lower(btrim(coalesce(p_next_status, '')));
  v_expected_next text;
  v_timestamp_column text;
  v_tracking_event_type text;
  v_updated public.jobs%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_driver_id IS NULL OR p_job_id IS NULL THEN
    RAISE EXCEPTION 'Driver id and job id are required.' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_driver
  FROM public.drivers d
  WHERE d.id = p_driver_id
    AND d.user_id = v_actor
    AND coalesce(d.app_access, true) = true
    AND coalesce(d.is_active, true) = true
    AND lower(coalesce(d.status::text, 'active')) = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver profile is not active for this account.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_job
  FROM public.jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_job.assigned_driver_id IS DISTINCT FROM p_driver_id THEN
    RAISE EXCEPTION 'Status update could not be applied for this assignment.' USING ERRCODE = '42501';
  END IF;

  IF coalesce(v_job.awarded_carrier_company_id, v_job.assigned_company_id) IS NOT NULL
     AND coalesce(v_job.awarded_carrier_company_id, v_job.assigned_company_id) IS DISTINCT FROM v_driver.company_id THEN
    RAISE EXCEPTION 'Driver company does not match this assignment.' USING ERRCODE = '42501';
  END IF;

  v_current_status := lower(coalesce(nullif(v_job.status, ''), nullif(v_job.current_status, ''), 'allocated'));

  IF v_next_status = v_current_status THEN
    RETURN jsonb_build_object(
      'ok', true,
      'job_id', v_job.id,
      'status', v_job.status,
      'current_status', v_job.current_status,
      'assigned_driver_id', v_job.assigned_driver_id
    );
  END IF;

  v_expected_next := CASE v_current_status
    WHEN 'allocated' THEN 'on_my_way'
    WHEN 'on_my_way' THEN 'on_site_pickup'
    WHEN 'on_site_pickup' THEN 'loaded'
    WHEN 'loaded' THEN 'on_site_delivery'
    WHEN 'on_site_delivery' THEN 'delivered'
    WHEN 'delivered' THEN 'completed'
    ELSE NULL
  END;

  IF v_expected_next IS NULL OR v_next_status <> v_expected_next THEN
    RAISE EXCEPTION 'Invalid driver status transition: % -> %', v_current_status, v_next_status
      USING ERRCODE = '23514';
  END IF;

  v_timestamp_column := CASE v_next_status
    WHEN 'on_my_way' THEN 'on_my_way_at'
    WHEN 'on_site_pickup' THEN 'on_site_pickup_at'
    WHEN 'loaded' THEN 'loaded_at'
    WHEN 'on_site_delivery' THEN 'on_site_delivery_at'
    WHEN 'delivered' THEN 'delivered_at'
    WHEN 'completed' THEN 'completed_at'
    ELSE NULL
  END;

  v_tracking_event_type := CASE v_next_status
    WHEN 'on_my_way' THEN 'on_my_way_to_pickup'
    WHEN 'on_site_pickup' THEN 'on_site_pickup'
    WHEN 'loaded' THEN 'loaded'
    WHEN 'on_site_delivery' THEN 'on_site_delivery'
    WHEN 'delivered' THEN 'delivered'
    ELSE NULL
  END;

  UPDATE public.jobs j
  SET status = v_next_status,
      current_status = v_next_status,
      collection_photo_url = coalesce(nullif(p_collection_photo_url, ''), j.collection_photo_url),
      driver_notes = coalesce(nullif(p_driver_notes, ''), j.driver_notes),
      delivery_photos = coalesce(p_delivery_photos, j.delivery_photos),
      delivery_signature_data = coalesce(to_jsonb(nullif(p_delivery_signature_data, '')), j.delivery_signature_data),
      client_signature_name = coalesce(nullif(p_client_signature_name, ''), j.client_signature_name),
      on_my_way_at = CASE WHEN v_timestamp_column = 'on_my_way_at' AND j.on_my_way_at IS NULL THEN now() ELSE j.on_my_way_at END,
      on_site_pickup_at = CASE WHEN v_timestamp_column = 'on_site_pickup_at' AND j.on_site_pickup_at IS NULL THEN now() ELSE j.on_site_pickup_at END,
      loaded_at = CASE WHEN v_timestamp_column = 'loaded_at' AND j.loaded_at IS NULL THEN now() ELSE j.loaded_at END,
      on_site_delivery_at = CASE WHEN v_timestamp_column = 'on_site_delivery_at' AND j.on_site_delivery_at IS NULL THEN now() ELSE j.on_site_delivery_at END,
      delivered_at = CASE WHEN v_timestamp_column = 'delivered_at' AND j.delivered_at IS NULL THEN now() ELSE j.delivered_at END,
      completed_at = CASE WHEN v_timestamp_column = 'completed_at' AND j.completed_at IS NULL THEN now() ELSE j.completed_at END,
      status_history = coalesce(j.status_history, '[]'::jsonb)
        || jsonb_build_object(
          'status', v_next_status,
          'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'source', 'driver_native'
        ),
      updated_at = now()
  WHERE j.id = p_job_id
    AND j.assigned_driver_id = p_driver_id
  RETURNING *
  INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status update could not be applied for this assignment.' USING ERRCODE = '42501';
  END IF;

  IF v_tracking_event_type IS NOT NULL THEN
    INSERT INTO public.job_tracking_events (job_id, event_type, event_time, user_id, created_by, message, meta)
    VALUES (
      p_job_id,
      v_tracking_event_type,
      now(),
      v_actor,
      v_actor,
      format('Driver updated job status to %s.', v_next_status),
      jsonb_build_object('driver_id', p_driver_id, 'source', 'driver_native')
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'job_id', v_updated.id,
    'status', v_updated.status,
    'current_status', v_updated.current_status,
    'assigned_driver_id', v_updated.assigned_driver_id,
    'assigned_company_id', v_updated.assigned_company_id,
    'awarded_carrier_company_id', v_updated.awarded_carrier_company_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.driver_update_job_status_atomic(uuid, uuid, text, text, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_update_job_status_atomic(uuid, uuid, text, text, text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_update_job_status_atomic(uuid, uuid, text, text, text, jsonb, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
