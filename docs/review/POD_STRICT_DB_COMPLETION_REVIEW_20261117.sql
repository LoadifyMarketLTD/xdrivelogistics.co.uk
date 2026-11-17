-- REVIEW-ONLY SQL PATCH. Not applied to XDrive Production.
-- MUST be converted into a Supabase CLI migration and clean-replayed before deployment.
-- Replaces the EXISTING completed-status trigger function without altering other triggers.
-- Does not alter historical jobs unless they enter the completed state anew.
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_require_complete_pod_before_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_old_status text;
  v_new_status text;
  v_photo_count integer;
  v_signature text;
  v_has_pod_row boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  v_old_status := lower(COALESCE(NULLIF(OLD.current_status::text,''), NULLIF(OLD.status::text,''), ''));
  v_new_status := lower(COALESCE(NULLIF(NEW.current_status::text,''), NULLIF(NEW.status::text,''), ''));
  IF v_new_status <> 'completed' OR v_old_status = 'completed' THEN RETURN NEW; END IF;

  IF NOT COALESCE(NEW.pod_generated, false) OR NEW.pod_generated_at IS NULL THEN
    RAISE EXCEPTION 'POD must be completed before marking the job completed.' USING ERRCODE = '23514';
  END IF;

  IF NEW.delivery_photos IS NULL OR jsonb_typeof(NEW.delivery_photos) <> 'array' THEN
    RAISE EXCEPTION 'Delivery photographs must be a persisted photo array.' USING ERRCODE = '23514';
  END IF;

  -- Delivery photographs ONLY; POD documents do not substitute for photos.
  SELECT count(DISTINCT btrim(v.path))::integer
    INTO v_photo_count
    FROM jsonb_array_elements_text(NEW.delivery_photos) AS v(path)
    WHERE NULLIF(btrim(v.path), '') IS NOT NULL
      AND lower(v.path) ~ '[.](png|jpe?g)$';

  IF v_photo_count NOT BETWEEN 1 AND 10
     OR jsonb_array_length(NEW.delivery_photos) <> v_photo_count THEN
    RAISE EXCEPTION 'Between 1 and 10 distinct JPEG/PNG delivery photographs are required.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.delivery_signature_data IS NULL OR NEW.delivery_signature_data = 'null'::jsonb THEN
    RAISE EXCEPTION 'A drawn recipient signature is required.' USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(NEW.delivery_signature_data) = 'object' THEN
    IF COALESCE(NEW.delivery_signature_data->>'type','') = 'recipient_typed_name_attestation'
       OR COALESCE(NEW.delivery_signature_data->>'signature_method','') = 'typed_name_attestation' THEN
      RAISE EXCEPTION 'A typed name cannot substitute for the drawn signature.'
        USING ERRCODE = '23514';
    END IF;
    v_signature := COALESCE(NULLIF(NEW.delivery_signature_data->>'signature_data',''),
                            NULLIF(NEW.delivery_signature_data->>'value',''));
  ELSIF jsonb_typeof(NEW.delivery_signature_data) = 'string' THEN
    v_signature := NEW.delivery_signature_data #>> '{}';
  ELSE
    RAISE EXCEPTION 'Recipient signature format is invalid.' USING ERRCODE = '23514';
  END IF;

  IF v_signature IS NULL OR length(v_signature) > 2500000
     OR NOT (
       v_signature ~ '^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$'
       OR v_signature ~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/=]+$'
       OR v_signature ~ '^[^/[:space:]]+/[^/[:space:]]+/([^/[:space:]]+/)*[^/[:space:]]+[.](png|jpe?g)$'
     ) THEN
    RAISE EXCEPTION 'A verifiable drawn recipient signature image is required.'
      USING ERRCODE = '23514';
  END IF;

  IF NULLIF(btrim(COALESCE(NEW.client_signature_name,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Recipient full name is required.' USING ERRCODE = '23514';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.proof_of_delivery pod
    WHERE pod.job_id=NEW.id
      AND NULLIF(btrim(COALESCE(pod.received_by,'')), '') IS NOT NULL
  ) INTO v_has_pod_row;
  IF NOT v_has_pod_row THEN
    RAISE EXCEPTION 'Persisted proof-of-delivery record is required.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
