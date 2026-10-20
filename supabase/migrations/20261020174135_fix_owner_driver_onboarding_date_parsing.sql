BEGIN;

CREATE OR REPLACE FUNCTION public.parse_onboarding_optional_date(p_value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path TO pg_catalog
AS $function$
DECLARE
  v_value text := NULLIF(btrim(p_value), '');
  v_date date;
BEGIN
  IF v_value IS NULL
     OR lower(v_value) IN ('n/a', 'na', 'not applicable', 'none') THEN
    RETURN NULL;
  END IF;

  BEGIN
    IF v_value ~ '^\d{4}-\d{2}-\d{2}$' THEN
      v_date := v_value::date;
    ELSIF v_value ~ '^\d{2}/\d{2}/\d{4}$' THEN
      v_date := make_date(
        split_part(v_value, '/', 3)::integer,
        split_part(v_value, '/', 2)::integer,
        split_part(v_value, '/', 1)::integer
      );
    ELSIF v_value ~ '^\d{2}-\d{2}-\d{4}$' THEN
      v_date := make_date(
        split_part(v_value, '-', 3)::integer,
        split_part(v_value, '-', 2)::integer,
        split_part(v_value, '-', 1)::integer
      );
    ELSE
      RAISE EXCEPTION 'Unsupported onboarding date format: %', v_value
        USING ERRCODE = '22007';
    END IF;
  EXCEPTION
    WHEN datetime_field_overflow OR invalid_datetime_format OR invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid onboarding date: %', v_value
        USING ERRCODE = '22007';
  END;

  RETURN v_date;
END;
$function$;

REVOKE ALL ON FUNCTION public.parse_onboarding_optional_date(text)
  FROM PUBLIC, anon, authenticated, service_role;

DO $do$
DECLARE
  v_definition text;
  v_updated text;
  v_dob_expr constant text := 'NULLIF(v_app.payload->>''dob'', '''')::date';
  v_visa_expr constant text := 'NULLIF(v_app.payload->>''visa_expiry'', '''')::date';
BEGIN
  SELECT pg_get_functiondef(
    'public.submit_onboarding_application_base_v1_legacy_20260927(uuid)'::regprocedure
  )
  INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Legacy onboarding submit function is missing.';
  END IF;

  IF position(v_dob_expr IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected DOB cast was not found in legacy onboarding submit function.';
  END IF;

  IF position(v_visa_expr IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected visa expiry cast was not found in legacy onboarding submit function.';
  END IF;

  v_updated := replace(
    v_definition,
    v_dob_expr,
    'public.parse_onboarding_optional_date(v_app.payload->>''dob'')'
  );

  v_updated := replace(
    v_updated,
    v_visa_expr,
    'public.parse_onboarding_optional_date(v_app.payload->>''visa_expiry'')'
  );

  EXECUTE v_updated;
END;
$do$;

REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1_legacy_20260927(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
