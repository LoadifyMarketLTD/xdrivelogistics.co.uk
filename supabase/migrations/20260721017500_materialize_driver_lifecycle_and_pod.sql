-- Materialize every jobs column used by the web/native driver lifecycle and
-- keep POD signatures consistently stored as text. Historical migrations
-- created the RPCs before these runtime columns existed on a clean schema.

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS on_my_way_at timestamptz,
  ADD COLUMN IF NOT EXISTS on_site_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS loaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS on_site_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_notes text,
  ADD COLUMN IF NOT EXISTS pod_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pod_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pod_photos text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.jobs
SET status_updated_at = COALESCE(status_updated_at, updated_at, created_at)
WHERE status_updated_at IS NULL;

CREATE OR REPLACE FUNCTION public.validate_job_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_allowed_next text[];
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_allowed_next := CASE OLD.status::text
    WHEN 'draft' THEN ARRAY['posted', 'cancelled', 'disputed']
    WHEN 'posted' THEN ARRAY['quoted', 'awarded', 'allocated', 'cancelled', 'disputed']
    WHEN 'quoted' THEN ARRAY['posted', 'awarded', 'cancelled', 'disputed']
    WHEN 'awarded' THEN ARRAY['allocated', 'on_my_way', 'cancelled', 'disputed']
    WHEN 'allocated' THEN ARRAY['on_my_way', 'collected', 'in_transit', 'cancelled', 'disputed']
    WHEN 'on_my_way' THEN ARRAY['on_site_pickup', 'cancelled', 'disputed']
    WHEN 'on_site_pickup' THEN ARRAY['loaded', 'cancelled', 'disputed']
    WHEN 'loaded' THEN ARRAY['in_transit', 'on_site_delivery', 'cancelled', 'disputed']
    WHEN 'collected' THEN ARRAY['in_transit', 'cancelled', 'disputed']
    WHEN 'in_transit' THEN ARRAY['on_site_delivery', 'delivered', 'cancelled', 'disputed']
    WHEN 'on_site_delivery' THEN ARRAY['delivered', 'cancelled', 'disputed']
    WHEN 'delivered' THEN ARRAY['completed', 'invoiced', 'cancelled', 'disputed']
    WHEN 'completed' THEN ARRAY['invoiced', 'disputed']
    WHEN 'invoiced' THEN ARRAY['paid', 'disputed']
    WHEN 'paid' THEN ARRAY[]::text[]
    WHEN 'cancelled' THEN ARRAY[]::text[]
    WHEN 'disputed' THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[]
  END;

  IF NOT (NEW.status::text = ANY(v_allowed_next)) THEN
    RAISE EXCEPTION
      'Invalid job status transition: % -> % (allowed: %)',
      OLD.status, NEW.status, array_to_string(v_allowed_next, ', ')
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status::text IN (
    'allocated', 'on_my_way', 'on_site_pickup', 'loaded', 'collected',
    'in_transit', 'on_site_delivery', 'delivered', 'completed'
  ) AND NEW.assigned_driver_id IS NULL THEN
    RAISE EXCEPTION 'Job cannot move to % without an assigned driver.', NEW.status
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status::text = 'delivered' AND COALESCE(NEW.pod_required, true) THEN
    IF COALESCE(cardinality(NEW.delivery_photos), 0) = 0 THEN
      RAISE EXCEPTION 'Job cannot be marked delivered without a delivery photo.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.delivery_signature_data IS NULL
       OR btrim(NEW.delivery_signature_data) = '' THEN
      RAISE EXCEPTION 'Job cannot be marked delivered without a recipient signature.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.client_signature_name IS NULL
       OR btrim(NEW.client_signature_name) = '' THEN
      RAISE EXCEPTION 'Job cannot be marked delivered without a recipient name.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.current_status := NEW.status::text;
  NEW.status_updated_at := now();
  RETURN NEW;
END;
$$;

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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_driver public.drivers%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_current_status text;
  v_next_status text := lower(btrim(coalesce(p_next_status, '')));
  v_expected_next text;
  v_updated public.jobs%ROWTYPE;
  v_effective_collection_photo text;
  v_effective_delivery_photos text[];
  v_effective_signature text;
  v_effective_recipient text;
  v_tracking_event_type text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_driver
  FROM public.drivers AS d
  WHERE d.id = p_driver_id
    AND d.user_id = v_actor
    AND coalesce(d.app_access, false) = true
    AND coalesce(d.is_active, true) = true
    AND lower(coalesce(d.status::text, 'inactive')) = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver profile is not approved and active for this account.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_job
  FROM public.jobs AS j
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

  v_current_status := lower(coalesce(nullif(v_job.current_status, ''), v_job.status::text, 'allocated'));
  v_current_status := CASE v_current_status
    WHEN 'assigned' THEN 'allocated'
    WHEN 'accepted' THEN 'allocated'
    WHEN 'arrived_pickup' THEN 'on_site_pickup'
    WHEN 'collected' THEN 'loaded'
    WHEN 'on_route_delivery' THEN 'in_transit'
    WHEN 'arrived_delivery' THEN 'on_site_delivery'
    ELSE v_current_status
  END;

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
    WHEN 'awarded' THEN 'on_my_way'
    WHEN 'allocated' THEN 'on_my_way'
    WHEN 'on_my_way' THEN 'on_site_pickup'
    WHEN 'on_site_pickup' THEN 'loaded'
    WHEN 'loaded' THEN 'in_transit'
    WHEN 'in_transit' THEN 'on_site_delivery'
    WHEN 'on_site_delivery' THEN 'delivered'
    WHEN 'delivered' THEN 'completed'
    ELSE NULL
  END;

  IF v_expected_next IS NULL OR v_next_status <> v_expected_next THEN
    RAISE EXCEPTION 'Invalid driver status transition: % -> %. Expected %.',
      v_current_status, v_next_status, v_expected_next
      USING ERRCODE = '23514';
  END IF;

  v_effective_collection_photo := coalesce(nullif(btrim(p_collection_photo_url), ''), v_job.collection_photo_url);
  v_effective_signature := coalesce(nullif(btrim(p_delivery_signature_data), ''), v_job.delivery_signature_data);
  v_effective_recipient := coalesce(nullif(btrim(p_client_signature_name), ''), v_job.client_signature_name);

  IF p_delivery_photos IS NULL THEN
    v_effective_delivery_photos := coalesce(v_job.delivery_photos, '{}'::text[]);
  ELSIF jsonb_typeof(p_delivery_photos) = 'array' THEN
    SELECT coalesce(array_agg(value), '{}'::text[])
    INTO v_effective_delivery_photos
    FROM jsonb_array_elements_text(p_delivery_photos) AS value;
  ELSE
    RAISE EXCEPTION 'Delivery photos must be a JSON array.' USING ERRCODE = '22023';
  END IF;

  IF v_next_status = 'loaded' AND v_effective_collection_photo IS NULL THEN
    RAISE EXCEPTION 'A loading photo is required before marking the job loaded.' USING ERRCODE = '23514';
  END IF;

  IF v_next_status = 'delivered' AND coalesce(v_job.pod_required, true) THEN
    IF coalesce(cardinality(v_effective_delivery_photos), 0) = 0 THEN
      RAISE EXCEPTION 'At least one delivery photo is required.' USING ERRCODE = '23514';
    END IF;
    IF v_effective_signature IS NULL THEN
      RAISE EXCEPTION 'Recipient signature is required.' USING ERRCODE = '23514';
    END IF;
    IF v_effective_recipient IS NULL THEN
      RAISE EXCEPTION 'Recipient name is required.' USING ERRCODE = '23514';
    END IF;
  END IF;

  v_tracking_event_type := CASE v_next_status
    WHEN 'on_my_way' THEN 'on_my_way_to_pickup'
    WHEN 'on_site_pickup' THEN 'on_site_pickup'
    WHEN 'loaded' THEN 'loaded'
    WHEN 'in_transit' THEN 'on_my_way_to_delivery'
    WHEN 'on_site_delivery' THEN 'on_site_delivery'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'completed' THEN 'note'
    ELSE NULL
  END;

  UPDATE public.jobs AS j
  SET status = v_next_status::public.job_status,
      current_status = v_next_status,
      status_updated_at = now(),
      collection_photo_url = v_effective_collection_photo,
      driver_notes = coalesce(nullif(btrim(p_driver_notes), ''), j.driver_notes),
      delivery_photos = v_effective_delivery_photos,
      delivery_signature_data = v_effective_signature,
      client_signature_name = v_effective_recipient,
      pod_generated = CASE WHEN v_next_status = 'delivered' THEN true ELSE j.pod_generated END,
      pod_generated_at = CASE WHEN v_next_status = 'delivered' THEN coalesce(j.pod_generated_at, now()) ELSE j.pod_generated_at END,
      on_my_way_at = CASE WHEN v_next_status = 'on_my_way' AND j.on_my_way_at IS NULL THEN now() ELSE j.on_my_way_at END,
      on_site_pickup_at = CASE WHEN v_next_status = 'on_site_pickup' AND j.on_site_pickup_at IS NULL THEN now() ELSE j.on_site_pickup_at END,
      loaded_at = CASE WHEN v_next_status = 'loaded' AND j.loaded_at IS NULL THEN now() ELSE j.loaded_at END,
      on_site_delivery_at = CASE WHEN v_next_status = 'on_site_delivery' AND j.on_site_delivery_at IS NULL THEN now() ELSE j.on_site_delivery_at END,
      delivered_at = CASE WHEN v_next_status = 'delivered' AND j.delivered_at IS NULL THEN now() ELSE j.delivered_at END,
      completed_at = CASE WHEN v_next_status = 'completed' AND j.completed_at IS NULL THEN now() ELSE j.completed_at END,
      status_history = coalesce(j.status_history, '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'status', v_next_status,
          'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'source', 'driver_atomic_rpc',
          'actor_user_id', v_actor
        )),
      updated_at = now()
  WHERE j.id = p_job_id
    AND j.assigned_driver_id = p_driver_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status update could not be applied for this assignment.' USING ERRCODE = '42501';
  END IF;

  IF v_tracking_event_type IS NOT NULL THEN
    INSERT INTO public.job_tracking_events
      (job_id, event_type, created_by, message, meta)
    VALUES (
      p_job_id,
      v_tracking_event_type,
      v_actor,
      format('Driver updated job status to %s.', v_next_status),
      jsonb_build_object('driver_id', p_driver_id, 'source', 'driver_atomic_rpc')
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

REVOKE ALL ON FUNCTION public.driver_update_job_status_atomic(uuid, uuid, text, text, text, jsonb, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_update_job_status_atomic(uuid, uuid, text, text, text, jsonb, text, text)
  TO authenticated, service_role;

COMMENT ON COLUMN public.jobs.status_updated_at IS
  'Timestamp of the most recent operational status update.';
COMMENT ON COLUMN public.jobs.pod_photos IS
  'Persistent storage paths for POD document evidence not duplicated in delivery_photos.';

NOTIFY pgrst, 'reload schema';

COMMIT;
