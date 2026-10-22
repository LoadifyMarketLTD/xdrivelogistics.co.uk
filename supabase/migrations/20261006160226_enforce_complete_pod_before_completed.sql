CREATE OR REPLACE FUNCTION public.fn_require_complete_pod_before_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_old_status text;
  v_new_status text;
  v_delivery_photo_count integer := 0;
  v_pod_photo_count integer := 0;
  v_has_pod_row boolean := false;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  v_old_status := lower(COALESCE(NULLIF(OLD.current_status::text, ''), NULLIF(OLD.status::text, ''), ''));
  v_new_status := lower(COALESCE(NULLIF(NEW.current_status::text, ''), NULLIF(NEW.status::text, ''), ''));
  IF v_new_status <> 'completed' OR v_old_status = 'completed' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.pod_generated, false) IS NOT TRUE OR NEW.pod_generated_at IS NULL THEN
    RAISE EXCEPTION 'POD must be completed before marking the job completed.' USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(COALESCE(NEW.delivery_photos, '[]'::jsonb)) = 'array' THEN
    v_delivery_photo_count := jsonb_array_length(COALESCE(NEW.delivery_photos, '[]'::jsonb));
  END IF;
  IF jsonb_typeof(COALESCE(NEW.pod_photos, '[]'::jsonb)) = 'array' THEN
    v_pod_photo_count := jsonb_array_length(COALESCE(NEW.pod_photos, '[]'::jsonb));
  END IF;
  IF v_delivery_photo_count + v_pod_photo_count < 1 THEN
    RAISE EXCEPTION 'POD evidence is required before marking the job completed.' USING ERRCODE = '23514';
  END IF;
  IF NEW.delivery_signature_data IS NULL OR NEW.delivery_signature_data = 'null'::jsonb THEN
    RAISE EXCEPTION 'Recipient signature is required before marking the job completed.' USING ERRCODE = '23514';
  END IF;
  IF NULLIF(btrim(COALESCE(NEW.client_signature_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Recipient name is required before marking the job completed.' USING ERRCODE = '23514';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.proof_of_delivery pod
    WHERE pod.job_id = NEW.id
      AND NULLIF(btrim(COALESCE(pod.received_by, '')), '') IS NOT NULL
  ) INTO v_has_pod_row;
  IF NOT v_has_pod_row THEN
    RAISE EXCEPTION 'A persisted proof of delivery record is required before marking the job completed.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_require_complete_pod_before_completed ON public.jobs;
CREATE TRIGGER trg_require_complete_pod_before_completed
BEFORE UPDATE OF status, current_status ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.fn_require_complete_pod_before_completed();
REVOKE ALL ON FUNCTION public.fn_require_complete_pod_before_completed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_require_complete_pod_before_completed() TO service_role;
COMMENT ON FUNCTION public.fn_require_complete_pod_before_completed() IS
  'Database backstop: canonical completed state requires persisted POD, timestamp, evidence, signature and recipient.';
NOTIFY pgrst, 'reload schema';
