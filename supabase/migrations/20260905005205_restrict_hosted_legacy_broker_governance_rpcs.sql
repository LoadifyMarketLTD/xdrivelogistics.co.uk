-- Hosted migration-history reconciliation alias.
-- Production recorded this hardening at 20260905005205 while the canonical
-- repository migration is 20260904233000. The canonical migration runs first on
-- fresh replay; this file only verifies the hosted security effect.

BEGIN;

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
    IF v_proc IS NOT NULL AND (
      has_function_privilege('anon', v_proc, 'EXECUTE')
      OR has_function_privilege('authenticated', v_proc, 'EXECUTE')
      OR NOT has_function_privilege('service_role', v_proc, 'EXECUTE')
    ) THEN
      RAISE EXCEPTION 'Hosted broker governance RPC privilege contract is not converged for %.', v_signature;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
