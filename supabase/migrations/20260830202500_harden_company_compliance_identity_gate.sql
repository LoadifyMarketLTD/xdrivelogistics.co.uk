BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- P0-10 hardening: company activation must always validate the canonical linked
-- onboarding application. Accounts without company-family requirements (for
-- example Owner Driver) still have identity requirements and must not bypass
-- those requirements through a direct governance company-status action.
CREATE OR REPLACE FUNCTION public.assert_company_compliance_ready(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application_id uuid;
BEGIN
  SELECT application.id
  INTO v_application_id
  FROM public.companies company
  JOIN public.onboarding_applications application
    ON application.user_id = company.created_by
   AND (
     application.company_id = company.id
     OR application.company_id IS NULL
   )
  WHERE company.id = p_company_id
  ORDER BY
    CASE WHEN application.company_id = company.id THEN 0 ELSE 1 END,
    application.created_at DESC
  LIMIT 1;

  IF v_application_id IS NULL THEN
    RAISE EXCEPTION
      'Cannot activate company without a linked onboarding application.'
      USING ERRCODE = '23514';
  END IF;

  -- One authoritative compliance assertion covers both identity-family and
  -- company-family requirements according to onboarding.account_type.
  PERFORM public.assert_onboarding_compliance_ready(v_application_id);
END;
$$;

REVOKE ALL ON FUNCTION public.assert_company_compliance_ready(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_company_compliance_ready(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.assert_company_compliance_ready(uuid) FROM authenticated;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.assert_company_compliance_ready(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.assert_company_compliance_ready(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Company compliance activation helper is externally executable.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.compliance_document_requirements
    WHERE account_type = 'owner_driver'
      AND document_family = 'identity'
      AND doc_type = 'insurance'
      AND required = true
      AND active = true
  ) THEN
    RAISE EXCEPTION 'Owner Driver personal insurance unexpectedly became mandatory.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
