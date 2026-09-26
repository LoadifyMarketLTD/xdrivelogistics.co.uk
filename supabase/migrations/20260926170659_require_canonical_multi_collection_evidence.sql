BEGIN;

CREATE OR REPLACE FUNCTION public.fn_require_canonical_collection_evidence_before_loaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_status text;
  v_new_status text;
  v_photo_count integer := 0;
  v_handover_photos jsonb;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_old_status := lower(COALESCE(NULLIF(OLD.current_status::text,''), NULLIF(OLD.status::text,''), ''));
  v_new_status := lower(COALESCE(NULLIF(NEW.current_status::text,''), NULLIF(NEW.status::text,''), ''));

  IF v_new_status <> 'loaded' OR v_old_status = 'loaded' THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(COALESCE(NEW.pickup_photos, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Collection photo evidence must be stored as a canonical photo array.' USING ERRCODE = '23514';
  END IF;
  v_photo_count := jsonb_array_length(COALESCE(NEW.pickup_photos, '[]'::jsonb));
  IF v_photo_count < 1 THEN
    RAISE EXCEPTION 'At least one verified collection photo is required before marking the job loaded.' USING ERRCODE = '23514';
  END IF;
  IF v_photo_count > 10 THEN
    RAISE EXCEPTION 'No more than 10 collection photos may be linked to one handover.' USING ERRCODE = '23514';
  END IF;

  IF NEW.collection_handover IS NULL OR jsonb_typeof(NEW.collection_handover) <> 'object' THEN
    RAISE EXCEPTION 'A verified collection handover is required before marking the job loaded.' USING ERRCODE = '23514';
  END IF;
  v_handover_photos := COALESCE(NEW.collection_handover -> 'photoPaths', '[]'::jsonb);
  IF jsonb_typeof(v_handover_photos) <> 'array' OR jsonb_array_length(v_handover_photos) < 1 THEN
    RAISE EXCEPTION 'Collection handover must contain verified photo evidence.' USING ERRCODE = '23514';
  END IF;
  IF NOT COALESCE(NEW.pickup_photos, '[]'::jsonb) @> v_handover_photos THEN
    RAISE EXCEPTION 'Collection handover photo evidence does not match the canonical job evidence.' USING ERRCODE = '23514';
  END IF;

  -- Legacy consumers may still read collection_photo_url. Preserve it as a
  -- compatibility pointer only; pickup_photos remains the canonical evidence list.
  IF NULLIF(btrim(COALESCE(NEW.collection_photo_url,'')), '') IS NULL THEN
    NEW.collection_photo_url := NEW.pickup_photos ->> 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_canonical_collection_evidence_before_loaded ON public.jobs;
CREATE TRIGGER trg_require_canonical_collection_evidence_before_loaded
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.fn_require_canonical_collection_evidence_before_loaded();

COMMIT;
NOTIFY pgrst, 'reload schema';
