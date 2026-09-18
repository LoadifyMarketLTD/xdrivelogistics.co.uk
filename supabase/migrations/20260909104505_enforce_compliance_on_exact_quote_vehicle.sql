CREATE OR REPLACE FUNCTION public.fn_guard_quote_vehicle_compliance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_vehicle public.vehicles%ROWTYPE;
  v_requested_type text;
  v_has_mot boolean := false;
  v_has_insurance boolean := false;
BEGIN
  IF NEW.bidder_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.quote_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'A specific active vehicle is required for a driver quote.' USING ERRCODE = '23514';
  END IF;

  SELECT v.* INTO v_vehicle
  FROM public.vehicles v
  WHERE v.id = NEW.quote_vehicle_id
    AND v.assigned_driver_id = NEW.bidder_driver_id
    AND COALESCE(v.status::text, '') = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The quoted vehicle is not active or is not assigned to this driver.' USING ERRCODE = '42501';
  END IF;

  IF NEW.company_id IS NOT NULL AND v_vehicle.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'The quoted vehicle does not belong to the bidding company.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(NULLIF(j.requested_vehicle_type, ''), NULLIF(j.vehicle_type::text, ''))
  INTO v_requested_type
  FROM public.jobs j
  WHERE j.id = NEW.job_id;

  IF v_requested_type IS NOT NULL
     AND NOT public.vehicle_can_cover_requested_type(v_vehicle.type, v_requested_type) THEN
    RAISE EXCEPTION 'The quoted vehicle is not compatible with this job.' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.vehicle_documents vd
    WHERE vd.vehicle_id = v_vehicle.id
      AND lower(COALESCE(vd.status::text, '')) = 'approved'
      AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
      AND regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
          IN ('mot', 'vehiclemot', 'goodsvehicletest')
  ) INTO v_has_mot;

  SELECT EXISTS (
    SELECT 1
    FROM public.vehicle_documents vd
    WHERE vd.vehicle_id = v_vehicle.id
      AND lower(COALESCE(vd.status::text, '')) = 'approved'
      AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
      AND regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
          IN ('insurance', 'vehicleinsurance', 'motorfleetinsurance', 'insurancecertificate')
  ) INTO v_has_insurance;

  IF NOT v_has_mot OR NOT v_has_insurance THEN
    RAISE EXCEPTION 'The quoted vehicle must have current MOT and insurance.' USING ERRCODE = '42501';
  END IF;

  IF public.vehicle_requires_driver_cpc(
    v_vehicle.type,
    v_vehicle.max_weight_kg,
    COALESCE(v_vehicle.is_zero_emission, false)
  ) AND NOT public.driver_has_valid_cpc(NEW.bidder_driver_id) THEN
    RAISE EXCEPTION 'Driver CPC is required for the selected vehicle.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_quote_vehicle_compliance ON public.job_bids;
CREATE TRIGGER trg_guard_quote_vehicle_compliance
BEFORE INSERT ON public.job_bids
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_quote_vehicle_compliance();;
