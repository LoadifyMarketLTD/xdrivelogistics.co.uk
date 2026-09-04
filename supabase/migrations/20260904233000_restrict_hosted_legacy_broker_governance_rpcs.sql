-- Go-live hardening: hosted production still contains legacy broker approval RPCs
-- that are not part of the repository migration/runtime contract and have no
-- repository callers. Keep them available only to trusted server/service flows.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
DECLARE
  v_signature text;
  v_proc regprocedure;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.approve_broker(uuid,text)',
    'public.reject_broker(uuid,text)'
  ] LOOP
    v_proc := to_regprocedure(v_signature);

    IF v_proc IS NOT NULL THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        v_signature
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO service_role',
        v_signature
      );

      IF has_function_privilege('anon', v_proc, 'EXECUTE')
         OR has_function_privilege('authenticated', v_proc, 'EXECUTE')
         OR NOT has_function_privilege('service_role', v_proc, 'EXECUTE') THEN
        RAISE EXCEPTION 'Legacy broker governance privilege contract failed for %.', v_signature;
      END IF;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
