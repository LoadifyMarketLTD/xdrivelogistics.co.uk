BEGIN;

DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.review_onboarding_application_atomic_authority_base_v1(uuid,uuid,text,text)'::regprocedure
  ) INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'Canonical onboarding review authority base is missing.';
  END IF;

  IF v_definition LIKE '%WHERE c.created_by = v_app.user_id%'
     OR v_definition LIKE '%ORDER BY c.created_at DESC%'
  THEN
    RAISE EXCEPTION 'Onboarding review still infers company authority from created_by provenance.';
  END IF;

  IF v_definition NOT LIKE '%v_company_id := v_app.company_id%'
     OR v_definition NOT LIKE '%explicit canonical company binding before approval%'
  THEN
    RAISE EXCEPTION 'Explicit onboarding company binding is not enforced by the review authority base.';
  END IF;

  IF v_definition NOT LIKE '%v_company_status = ''active''%'
     OR v_definition NOT LIKE '%assert_company_compliance_ready(v_company_id)%'
  THEN
    RAISE EXCEPTION 'Already-active company onboarding approval is not idempotently compliance revalidated.';
  END IF;

  IF v_definition NOT LIKE '%v_company_status IN (''rejected'', ''suspended'', ''inactive'')%'
  THEN
    RAISE EXCEPTION 'Governance-blocked companies are not fail-closed in onboarding approval.';
  END IF;

  IF has_function_privilege(
       'anon',
       'public.review_onboarding_application_atomic_authority_base_v1(uuid,uuid,text,text)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'public.review_onboarding_application_atomic_authority_base_v1(uuid,uuid,text,text)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'service_role',
       'public.review_onboarding_application_atomic_authority_base_v1(uuid,uuid,text,text)',
       'EXECUTE'
     )
  THEN
    RAISE EXCEPTION 'Internal onboarding review authority base is directly executable by an API role.';
  END IF;

  IF has_function_privilege(
       'anon',
       'public.review_onboarding_application_atomic(uuid,uuid,text,text)',
       'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated',
       'public.review_onboarding_application_atomic(uuid,uuid,text,text)',
       'EXECUTE'
     )
     OR NOT has_function_privilege(
       'service_role',
       'public.review_onboarding_application_atomic(uuid,uuid,text,text)',
       'EXECUTE'
     )
  THEN
    RAISE EXCEPTION 'Canonical onboarding review RPC execution boundary changed unexpectedly.';
  END IF;
END;
$$;

COMMIT;
