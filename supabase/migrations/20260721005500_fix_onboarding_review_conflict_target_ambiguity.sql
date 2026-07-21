-- The review function returns a TABLE column named company_id. In PL/pgSQL,
-- ON CONFLICT (company_id, user_id) is therefore ambiguous between the output
-- variable and the membership table column. Replace the inferred conflict target
-- with the concrete unique constraint name.

BEGIN;

DO $$
DECLARE
  v_signature regprocedure := to_regprocedure(
    'public.review_onboarding_application_atomic(uuid,uuid,text,text)'
  );
  v_definition text;
BEGIN
  IF v_signature IS NULL THEN
    RAISE EXCEPTION 'review_onboarding_application_atomic(uuid,uuid,text,text) does not exist';
  END IF;

  SELECT pg_get_functiondef(v_signature)
  INTO v_definition;

  IF position('ON CONSTRAINT company_memberships_company_id_user_id_key' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position('ON CONFLICT (company_id, user_id)' IN v_definition) = 0 THEN
    RAISE EXCEPTION
      'Unexpected review_onboarding_application_atomic definition: membership conflict target was not found';
  END IF;

  v_definition := replace(
    v_definition,
    'ON CONFLICT (company_id, user_id)',
    'ON CONFLICT ON CONSTRAINT company_memberships_company_id_user_id_key'
  );

  EXECUTE v_definition;
END;
$$;

REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text)
  TO service_role;

COMMIT;
