-- Hosted migration-history reconciliation alias.
--
-- Production recorded restrict_legacy_governance_security_definer_rpcs at
-- 20260905005143 after the canonical repository migration was committed as
-- 20260904222500. Do not rewrite Production migration history. On a fresh
-- repository replay the canonical migration runs first; this hosted-version
-- alias only verifies that its security effect converged.

BEGIN;

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname
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
    IF has_function_privilege('anon', fn.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', fn.oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', fn.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Hosted legacy governance RPC privilege contract is not converged for %.', fn.proname;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
