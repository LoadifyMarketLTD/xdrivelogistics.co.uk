BEGIN;

CREATE OR REPLACE FUNCTION public.record_driver_pod_atomic(
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_pod_id uuid;
  v_now timestamptz := now();
BEGIN
  UPDATE public.jobs
  SET
    delivery_photos = COALESCE(p_delivery_photos, '[]'::jsonb),
    damage_photos = COALESCE(p_damage_photos, '[]'::jsonb),
    pod_photos = COALESCE(p_pod_photos, '[]'::jsonb),
    delivery_signature_data = p_signature_data,
    client_signature_name = p_recipient_name,
    driver_notes = p_driver_notes,
    pod_generated = true,
    pod_generated_at = v_now,
    updated_at = v_now
  WHERE id = p_job_id
    AND assigned_driver_id = p_driver_id
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assigned driver job not found for POD.' USING ERRCODE = 'P0002';
  END IF;

  SELECT id
  INTO v_pod_id
  FROM public.proof_of_delivery
  WHERE job_id = p_job_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_pod_id IS NULL THEN
    INSERT INTO public.proof_of_delivery (
      job_id, delivered_on, received_by, left_at, no_of_items,
      delivery_status, delivery_notes, photo_urls, created_by, updated_at
    ) VALUES (
      p_job_id, p_delivered_on, p_recipient_name, p_left_at, p_item_count,
      p_delivery_status, p_delivery_notes, COALESCE(p_photo_urls, ARRAY[]::text[]),
      p_user_id, v_now
    );
  ELSE
    UPDATE public.proof_of_delivery
    SET
      delivered_on = p_delivered_on,
      received_by = p_recipient_name,
      left_at = p_left_at,
      no_of_items = p_item_count,
      delivery_status = p_delivery_status,
      delivery_notes = p_delivery_notes,
      photo_urls = COALESCE(p_photo_urls, ARRAY[]::text[]),
      created_by = p_user_id,
      updated_at = v_now
    WHERE id = v_pod_id;
  END IF;

  RETURN to_jsonb(v_job);
END;
$$;

REVOKE ALL ON FUNCTION public.record_driver_pod_atomic(
  uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, text,
  date, text, integer, text, text, text[]
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_driver_pod_atomic(
  uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, text,
  date, text, integer, text, text, text[]
) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';