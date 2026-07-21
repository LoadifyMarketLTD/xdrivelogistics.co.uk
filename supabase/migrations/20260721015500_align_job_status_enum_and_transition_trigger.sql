-- Align the database enum and the legacy transition trigger with the lifecycle
-- already used by web, native Android and the driver status RPC.

DO $$
DECLARE
  v_value text;
BEGIN
  FOREACH v_value IN ARRAY ARRAY[
    'on_my_way',
    'on_site_pickup',
    'loaded',
    'on_site_delivery',
    'completed'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      WHERE e.enumtypid = 'public.job_status'::regtype
        AND e.enumlabel = v_value
    ) THEN
      EXECUTE format('ALTER TYPE public.job_status ADD VALUE %L', v_value);
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.validate_job_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_allowed_next text[];
  v_delivery_photos jsonb;
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
      'Invalid job status transition: % → % (allowed: %)',
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

  IF NEW.status::text = 'delivered' AND coalesce(NEW.pod_required, true) THEN
    v_delivery_photos := coalesce(to_jsonb(NEW.delivery_photos), '[]'::jsonb);
    IF jsonb_typeof(v_delivery_photos) <> 'array'
       OR jsonb_array_length(v_delivery_photos) = 0
    THEN
      RAISE EXCEPTION 'Job cannot be marked delivered without a delivery photo.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.delivery_signature_data IS NULL
       OR btrim(NEW.delivery_signature_data #>> '{}') = ''
    THEN
      RAISE EXCEPTION 'Job cannot be marked delivered without a recipient signature.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.client_signature_name IS NULL
       OR btrim(NEW.client_signature_name) = ''
    THEN
      RAISE EXCEPTION 'Job cannot be marked delivered without a recipient name.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_job_status_transition() IS
  'Validates the canonical posted-to-paid lifecycle including driver execution and POD stages.';

NOTIFY pgrst, 'reload schema';
