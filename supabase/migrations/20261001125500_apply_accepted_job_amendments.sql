BEGIN;

CREATE OR REPLACE FUNCTION public.fn_apply_accepted_job_amendment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_patch jsonb;
  v_pickup jsonb;
  v_delivery jsonb;
  v_cargo jsonb;
  v_references jsonb;
BEGIN
  IF NEW.status <> 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  v_patch := COALESCE(NEW.change_summary->'jobPatch', '{}'::jsonb);
  v_pickup := COALESCE(v_patch->'pickup', '{}'::jsonb);
  v_delivery := COALESCE(v_patch->'delivery', '{}'::jsonb);
  v_cargo := COALESCE(v_patch->'cargo', '{}'::jsonb);
  v_references := COALESCE(v_patch->'references', '{}'::jsonb);
  UPDATE public.jobs
  SET
    pickup_location = CASE WHEN v_pickup ? 'address'
      THEN NULLIF(btrim(v_pickup->>'address'), '') ELSE pickup_location END,
    pickup_postcode = CASE WHEN v_pickup ? 'postcode'
      THEN NULLIF(upper(btrim(v_pickup->>'postcode')), '') ELSE pickup_postcode END,
    pickup_datetime = CASE WHEN v_pickup ? 'dateTime'
      THEN NULLIF(v_pickup->>'dateTime', '')::timestamptz ELSE pickup_datetime END,
    collection_window_start = CASE WHEN v_pickup ? 'dateTime'
      THEN NULLIF(v_pickup->>'dateTime', '')::timestamptz ELSE collection_window_start END,
    collection_contact_name = CASE WHEN v_pickup ? 'contactName'
      THEN NULLIF(btrim(v_pickup->>'contactName'), '') ELSE collection_contact_name END,
    collection_contact_phone = CASE WHEN v_pickup ? 'contactPhone'
      THEN NULLIF(btrim(v_pickup->>'contactPhone'), '') ELSE collection_contact_phone END,
    collection_notes = CASE WHEN v_pickup ? 'notes'
      THEN NULLIF(btrim(v_pickup->>'notes'), '') ELSE collection_notes END,
    delivery_location = CASE WHEN v_delivery ? 'address'
      THEN NULLIF(btrim(v_delivery->>'address'), '') ELSE delivery_location END,
    delivery_postcode = CASE WHEN v_delivery ? 'postcode'
      THEN NULLIF(upper(btrim(v_delivery->>'postcode')), '') ELSE delivery_postcode END,
    delivery_datetime = CASE WHEN v_delivery ? 'dateTime'
      THEN NULLIF(v_delivery->>'dateTime', '')::timestamptz ELSE delivery_datetime END,
    delivery_window_start = CASE WHEN v_delivery ? 'dateTime'
      THEN NULLIF(v_delivery->>'dateTime', '')::timestamptz ELSE delivery_window_start END,
    delivery_contact_name = CASE WHEN v_delivery ? 'contactName'
      THEN NULLIF(btrim(v_delivery->>'contactName'), '') ELSE delivery_contact_name END,
    delivery_contact_phone = CASE WHEN v_delivery ? 'contactPhone'
      THEN NULLIF(btrim(v_delivery->>'contactPhone'), '') ELSE delivery_contact_phone END,
    delivery_notes = CASE WHEN v_delivery ? 'notes'
      THEN NULLIF(btrim(v_delivery->>'notes'), '') ELSE delivery_notes END,
    weight_kg = CASE WHEN v_cargo ? 'weightKg'
      THEN NULLIF(v_cargo->>'weightKg', '')::numeric ELSE weight_kg END,
    pallets = CASE WHEN v_cargo ? 'pallets'
      THEN NULLIF(v_cargo->>'pallets', '')::integer ELSE pallets END,
    cargo_type = CASE WHEN v_cargo ? 'type'
      THEN NULLIF(btrim(v_cargo->>'type'), '') ELSE cargo_type END,
    customer_reference = CASE WHEN v_references ? 'customerReference'
      THEN NULLIF(btrim(v_references->>'customerReference'), '') ELSE customer_reference END,
    purchase_order_number = CASE WHEN v_references ? 'purchaseOrder'
      THEN NULLIF(btrim(v_references->>'purchaseOrder'), '') ELSE purchase_order_number END,
    booking_reference = CASE WHEN v_references ? 'bookingReference'
      THEN NULLIF(btrim(v_references->>'bookingReference'), '') ELSE booking_reference END,
    agreed_rate_gbp = NEW.effective_agreed_amount,
    agreed_rate = NEW.effective_agreed_amount,
    payment_terms = NEW.payment_terms,
    pod_required = NEW.pod_required,
    updated_at = now()
  WHERE id = NEW.job_id;

  IF jsonb_object_length(v_pickup) > 0 THEN
    UPDATE public.job_stops
    SET
      address = CASE WHEN v_pickup ? 'address' THEN COALESCE(NULLIF(btrim(v_pickup->>'address'), ''), address) ELSE address END,
      postcode = CASE WHEN v_pickup ? 'postcode' THEN COALESCE(NULLIF(upper(btrim(v_pickup->>'postcode')), ''), postcode) ELSE postcode END,
      contact_name = CASE WHEN v_pickup ? 'contactName' THEN NULLIF(btrim(v_pickup->>'contactName'), '') ELSE contact_name END,
      contact_phone = CASE WHEN v_pickup ? 'contactPhone' THEN NULLIF(btrim(v_pickup->>'contactPhone'), '') ELSE contact_phone END,
      instructions = CASE WHEN v_pickup ? 'notes' THEN NULLIF(btrim(v_pickup->>'notes'), '') ELSE instructions END,
      window_start = CASE WHEN v_pickup ? 'dateTime' THEN NULLIF(v_pickup->>'dateTime', '')::timestamptz ELSE window_start END,
      updated_at = now()
    WHERE id = (
      SELECT id FROM public.job_stops
      WHERE job_id = NEW.job_id AND stop_type = 'collection'
      ORDER BY sequence ASC
      LIMIT 1
    );
  END IF;

  IF jsonb_object_length(v_delivery) > 0 THEN
    UPDATE public.job_stops
    SET
      address = CASE WHEN v_delivery ? 'address' THEN COALESCE(NULLIF(btrim(v_delivery->>'address'), ''), address) ELSE address END,
      postcode = CASE WHEN v_delivery ? 'postcode' THEN COALESCE(NULLIF(upper(btrim(v_delivery->>'postcode')), ''), postcode) ELSE postcode END,
      contact_name = CASE WHEN v_delivery ? 'contactName' THEN NULLIF(btrim(v_delivery->>'contactName'), '') ELSE contact_name END,
      contact_phone = CASE WHEN v_delivery ? 'contactPhone' THEN NULLIF(btrim(v_delivery->>'contactPhone'), '') ELSE contact_phone END,
      instructions = CASE WHEN v_delivery ? 'notes' THEN NULLIF(btrim(v_delivery->>'notes'), '') ELSE instructions END,
      window_start = CASE WHEN v_delivery ? 'dateTime' THEN NULLIF(v_delivery->>'dateTime', '')::timestamptz ELSE window_start END,
      updated_at = now()
    WHERE id = (
      SELECT id FROM public.job_stops
      WHERE job_id = NEW.job_id AND stop_type = 'delivery'
      ORDER BY sequence DESC
      LIMIT 1
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_accepted_job_amendment
  ON public.job_commercial_agreement_amendments;
CREATE TRIGGER trg_apply_accepted_job_amendment
AFTER UPDATE ON public.job_commercial_agreement_amendments
FOR EACH ROW
WHEN (OLD.status = 'proposed' AND NEW.status = 'accepted')
EXECUTE FUNCTION public.fn_apply_accepted_job_amendment();

COMMIT;

NOTIFY pgrst, 'reload schema';
