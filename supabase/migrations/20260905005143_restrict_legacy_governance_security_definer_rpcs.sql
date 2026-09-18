BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
DECLARE
  fn record;
  qualified_signature text;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname = ANY (ARRAY[
        'approve_company',
        'reject_company',
        'submit_company_for_review',
        'create_driver_invite'
      ]::text[])
  LOOP
    qualified_signature := format(
      '%I.%I(%s)',
      fn.schema_name,
      fn.function_name,
      fn.identity_arguments
    );

    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      qualified_signature
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      qualified_signature
    );
  END LOOP;
END;
$$;

COMMIT;;
