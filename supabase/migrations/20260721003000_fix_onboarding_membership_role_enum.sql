-- Repair the deployed canonical onboarding submit function without replaying
-- historical migrations. The function currently declares v_role as text and
-- writes it into company_memberships.role_in_company (public.company_role),
-- which PostgreSQL correctly rejects during the real submit journey.

BEGIN;

DO $$
DECLARE
  v_signature regprocedure := to_regprocedure('public.submit_onboarding_application(uuid)');
  v_definition text;
BEGIN
  IF v_signature IS NULL THEN
    RAISE EXCEPTION 'submit_onboarding_application(uuid) does not exist';
  END IF;

  SELECT pg_get_functiondef(v_signature)
  INTO v_definition;

  IF position('v_role public.company_role;' IN v_definition) > 0 THEN
    -- Already repaired; keep the migration idempotent for mixed environments.
    RETURN;
  END IF;

  IF position('v_role text;' IN v_definition) = 0 THEN
    RAISE EXCEPTION
      'Unexpected submit_onboarding_application definition: v_role declaration was not found';
  END IF;

  v_definition := replace(
    v_definition,
    'v_role text;',
    'v_role public.company_role;'
  );

  EXECUTE v_definition;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid) TO service_role;

COMMIT;
