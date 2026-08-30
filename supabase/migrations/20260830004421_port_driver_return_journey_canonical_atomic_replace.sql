-- Ported from PR #398 after production-schema verification.
-- Server-only atomic replacement/clear for the canonical Expo Driver Return Journey contract.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('public.return_journeys') IS NULL THEN
    RAISE EXCEPTION 'public.return_journeys does not exist';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.replace_driver_return_journey_canonical(
  p_driver_id uuid,
  p_company_id uuid,
  p_from_postcode text,
  p_to_postcode text,
  p_available_from timestamptz,
  p_available_to timestamptz,
  p_vehicle_type text,
  p_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_from_postcode text := nullif(upper(trim(p_from_postcode)), '');
  v_to_postcode text := nullif(upper(trim(p_to_postcode)), '');
  v_vehicle_type text := nullif(trim(p_vehicle_type), '');
  v_notes text := nullif(trim(p_notes), '');
BEGIN
  IF p_driver_id IS NULL THEN
    RAISE EXCEPTION 'Driver identity is required.' USING ERRCODE = '22023';
  END IF;

  IF v_from_postcode IS NULL THEN
    DELETE FROM public.return_journeys
    WHERE driver_id = p_driver_id;
    RETURN NULL;
  END IF;

  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'A company-bound driver profile is required for return journeys.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id = p_driver_id
      AND d.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Driver company binding is invalid.' USING ERRCODE = '42501';
  END IF;

  IF p_available_from IS NOT NULL
     AND p_available_to IS NOT NULL
     AND p_available_to < p_available_from THEN
    RAISE EXCEPTION 'Return journey end must not be before its start.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.return_journeys
  WHERE driver_id = p_driver_id;

  INSERT INTO public.return_journeys (
    id,
    company_id,
    driver_id,
    from_postcode,
    to_postcode,
    available_from,
    available_to,
    vehicle_type,
    notes,
    status,
    created_at
  ) VALUES (
    v_id,
    p_company_id,
    p_driver_id,
    v_from_postcode,
    v_to_postcode,
    p_available_from,
    p_available_to,
    v_vehicle_type,
    v_notes,
    'available',
    now()
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_driver_return_journey_canonical(
  uuid, uuid, text, text, timestamptz, timestamptz, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_driver_return_journey_canonical(
  uuid, uuid, text, text, timestamptz, timestamptz, text, text
) FROM anon;
REVOKE ALL ON FUNCTION public.replace_driver_return_journey_canonical(
  uuid, uuid, text, text, timestamptz, timestamptz, text, text
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_driver_return_journey_canonical(
  uuid, uuid, text, text, timestamptz, timestamptz, text, text
) TO service_role;

COMMENT ON FUNCTION public.replace_driver_return_journey_canonical(
  uuid, uuid, text, text, timestamptz, timestamptz, text, text
) IS 'Server-only atomic replacement/clear of the canonical Expo Driver Return Journey declaration.';

NOTIFY pgrst, 'reload schema';
COMMIT;
