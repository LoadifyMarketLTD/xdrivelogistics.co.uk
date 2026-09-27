BEGIN;

ALTER FUNCTION public.assert_company_compliance_ready(uuid)
  RENAME TO assert_company_compliance_ready_legacy_20260927;

REVOKE ALL ON FUNCTION public.assert_company_compliance_ready_legacy_20260927(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assert_company_compliance_ready(
  p_company_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_status text;
BEGIN
  SELECT c.status::text
    INTO v_company_status
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_company_status IS NULL THEN
    RAISE EXCEPTION 'Company not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_company_status = 'active' THEN
    RETURN;
  END IF;

  PERFORM public.assert_company_compliance_ready_legacy_20260927(p_company_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_company_compliance_ready(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
