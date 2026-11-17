-- XDrive: repair ONLY incomplete, previously flagged PODs on delivered test jobs.
-- A valid signed POD, completed/invoiced job or issued invoice is immutable.
-- This privileged RPC is called solely by the authenticated Next.js Driver API.
-- Never reset pod_generated or rewrite job status to perform a correction.

CREATE OR REPLACE FUNCTION public.repair_incomplete_driver_pod_atomic(
  p_job_id uuid,
  p_driver_id uuid,
  p_user_id uuid,
  p_delivery_photos jsonb,
  p_damage_photos jsonb,
  p_pod_photos jsonb,
  p_signature_data jsonb,
  p_recipient_name text,
  p_driver_notes text,
  p_delivered_on date,
  p_left_at text,
  p_item_count integer,
  p_delivery_status text,
  p_delivery_notes text,
  p_photo_urls text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_updated public.jobs%ROWTYPE;
  v_pod_id uuid;
  v_now timestamptz := now();
  v_old_sig text;
  v_new_sig text;
  v_old_count integer := 0;
  v_old_unique integer := 0;
  v_old_image_count integer := 0;
  v_new_count integer := 0;
  v_new_unique integer := 0;
  v_new_image_count integer := 0;
  v_has_existing_pod boolean := false;
  v_valid_existing boolean := false;
BEGIN
  IF p_job_id IS NULL OR p_driver_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated job, driver and user are required for POD repair.' USING ERRCODE = '42501';
  END IF;

  -- A service-role call alone cannot provide arbitrary driver/user combinations.
  SELECT j.* INTO v_job
  FROM public.jobs j
  JOIN public.drivers d ON d.id = j.assigned_driver_id AND d.user_id = p_user_id
  WHERE j.id = p_job_id AND j.assigned_driver_id = p_driver_id
  FOR UPDATE OF j;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assigned driver job is not authorised for POD repair.' USING ERRCODE = '42501';
  END IF;
  IF lower(COALESCE(v_job.current_status::text, v_job.status::text, '')) <> 'delivered'
     OR COALESCE(v_job.pod_generated, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Only a previously flagged, delivered POD can be repaired.' USING ERRCODE = '23514';
  END IF;

  -- Never rewrite signed commercial evidence after invoice issue.
  IF EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.job_id = p_job_id
      AND lower(COALESCE(i.status::text,'')) NOT IN ('draft','void')
  ) THEN
    RAISE EXCEPTION 'Invoice has been issued: existing POD requires administrator review.'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_job.delivery_photos) = 'array' THEN
    SELECT count(*)::integer, count(DISTINCT btrim(e.path))::integer,
           count(*) FILTER (WHERE lower(e.path) ~ '[.](png|jpe?g)$')::integer
    INTO v_old_count, v_old_unique, v_old_image_count
    FROM jsonb_array_elements_text(v_job.delivery_photos) e(path);
  END IF;
  IF jsonb_typeof(v_job.delivery_signature_data) = 'string' THEN
    v_old_sig := v_job.delivery_signature_data #>> '{}';
  ELSIF jsonb_typeof(v_job.delivery_signature_data) = 'object'
      AND COALESCE(v_job.delivery_signature_data->>'type', '') <> 'recipient_typed_name_attestation'
      AND COALESCE(v_job.delivery_signature_data->>'signature_method', '') <> 'typed_name_attestation' THEN
    v_old_sig := COALESCE(NULLIF(v_job.delivery_signature_data->>'signature_data', ''),
                          NULLIF(v_job.delivery_signature_data->>'value', ''));
  END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.proof_of_delivery pod
    WHERE pod.job_id = p_job_id AND NULLIF(btrim(COALESCE(pod.received_by, '')), '') IS NOT NULL
  ) INTO v_has_existing_pod;
  v_valid_existing :=
    v_old_count BETWEEN 1 AND 10
    AND v_old_unique = v_old_count
    AND v_old_image_count = v_old_count
    AND NULLIF(btrim(COALESCE(v_job.client_signature_name,'')), '') IS NOT NULL
    AND COALESCE(v_job.pod_generated_at IS NOT NULL, false)
    AND v_has_existing_pod
    AND (
      v_old_sig ~ '^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$'
      OR v_old_sig ~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/=]+$'
      OR v_old_sig ~ '^[^/[:space:]]+/[^/[:space:]]+/([^/[:space:]]+/)*[^/[:space:]]+[.](png|jpe?g)$'
    );

  IF v_valid_existing THEN
    RETURN to_jsonb(v_job) || jsonb_build_object('_alreadySubmitted', true);
  END IF;

  IF jsonb_typeof(p_delivery_photos) <> 'array' THEN
    RAISE EXCEPTION 'Delivery photographs must be an array.' USING ERRCODE = '23514';
  END IF;
  SELECT count(*)::integer, count(DISTINCT btrim(e.path))::integer,
         count(*) FILTER (WHERE lower(e.path) ~ '[.](png|jpe?g)$')::integer
  INTO v_new_count, v_new_unique, v_new_image_count
  FROM jsonb_array_elements_text(p_delivery_photos) e(path);
  IF v_new_count NOT BETWEEN 1 AND 10 OR v_new_unique <> v_new_count
     OR v_new_image_count <> v_new_count THEN
    RAISE EXCEPTION 'Provide 1-10 distinct JPEG/PNG delivery photographs.' USING ERRCODE = '23514';
  END IF;

  IF p_signature_data IS NULL OR p_signature_data = 'null'::jsonb THEN
    RAISE EXCEPTION 'Drawn recipient signature required.' USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(p_signature_data) = 'string' THEN
    v_new_sig := p_signature_data #>> '{}';
  ELSIF jsonb_typeof(p_signature_data) = 'object'
      AND COALESCE(p_signature_data->>'type','') <> 'recipient_typed_name_attestation'
      AND COALESCE(p_signature_data->>'signature_method','') <> 'typed_name_attestation' THEN
    v_new_sig := COALESCE(NULLIF(p_signature_data->>'signature_data',''),
                          NULLIF(p_signature_data->>'value',''));
  END IF;
  IF v_new_sig IS NULL OR length(v_new_sig) > 2500000 OR NOT (
    v_new_sig ~ '^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$'
    OR v_new_sig ~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/=]+$'
    OR v_new_sig ~ '^[^/[:space:]]+/[^/[:space:]]+/([^/[:space:]]+/)*[^/[:space:]]+[.](png|jpe?g)$'
  ) THEN
    RAISE EXCEPTION 'A valid hand-drawn signature image is required.' USING ERRCODE = '23514';
  END IF;
  IF NULLIF(btrim(COALESCE(p_recipient_name,'')), '') IS NULL
     OR p_delivered_on IS NULL OR p_item_count IS NULL OR p_item_count < 1
     OR p_delivery_status IS DISTINCT FROM 'Completed Delivery' THEN
    RAISE EXCEPTION 'Recipient, delivery date, count and completed delivery are required.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.jobs
  SET delivery_photos = p_delivery_photos,
      damage_photos = COALESCE(p_damage_photos,'[]'::jsonb),
      pod_photos = COALESCE(p_pod_photos,'[]'::jsonb),
      delivery_signature_data = p_signature_data,
      client_signature_name = btrim(p_recipient_name),
      driver_notes = p_driver_notes,
      pod_generated = true,
      pod_generated_at = v_now,
      updated_at = v_now
  WHERE id = p_job_id AND assigned_driver_id = p_driver_id
  RETURNING * INTO v_updated;

  SELECT pod.id INTO v_pod_id
  FROM public.proof_of_delivery pod
  WHERE pod.job_id = p_job_id
  ORDER BY pod.created_at DESC LIMIT 1 FOR UPDATE;
  IF v_pod_id IS NULL THEN
    INSERT INTO public.proof_of_delivery (
      job_id, delivered_on, received_by, left_at, no_of_items,
      delivery_status, delivery_notes, photo_urls, created_by, updated_at
    ) VALUES (
      p_job_id, p_delivered_on, btrim(p_recipient_name), p_left_at, p_item_count,
      p_delivery_status, p_delivery_notes, COALESCE(p_photo_urls,ARRAY[]::text[]),
      p_user_id, v_now
    );
  ELSE
    UPDATE public.proof_of_delivery
    SET delivered_on = p_delivered_on,
        received_by = btrim(p_recipient_name),
        left_at = p_left_at,
        no_of_items = p_item_count,
        delivery_status = p_delivery_status,
        delivery_notes = p_delivery_notes,
        photo_urls = COALESCE(p_photo_urls,ARRAY[]::text[]),
        updated_at = v_now
    WHERE id = v_pod_id;
  END IF;
  RETURN to_jsonb(v_updated);
END;
$function$;

-- This SECURITY DEFINER RPC is a privileged server action, not a public API.
REVOKE ALL ON FUNCTION public.repair_incomplete_driver_pod_atomic(
  uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, text,
  date, text, integer, text, text, text[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repair_incomplete_driver_pod_atomic(
  uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, text,
  date, text, integer, text, text, text[]
) TO service_role;
