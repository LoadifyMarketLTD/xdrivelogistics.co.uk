-- Hosted migration-history reconciliation alias.
-- Production recorded guard_driver_self_service_protected_fields at
-- 20260905005440 while the canonical repository migration is 20260904225000.
-- Fresh replay executes the canonical trigger/function migration first; this file
-- verifies the hosted-version effect.

BEGIN;

DO $$
DECLARE
  v_proc regprocedure;
  v_trigger_count integer;
BEGIN
  v_proc := to_regprocedure('public.guard_driver_self_service_protected_fields()');

  SELECT count(*)
  INTO v_trigger_count
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.drivers'::regclass
    AND t.tgname = 'trg_guard_driver_self_service_protected_fields'
    AND NOT t.tgisinternal;

  IF v_proc IS NULL OR v_trigger_count <> 1 THEN
    RAISE EXCEPTION 'Driver self-service protected-field guard is not installed.';
  END IF;

  IF has_function_privilege('anon', v_proc, 'EXECUTE')
     OR has_function_privilege('authenticated', v_proc, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_proc, 'EXECUTE') THEN
    RAISE EXCEPTION 'Driver self-service protected-field guard privileges are not converged.';
  END IF;
END;
$$;

COMMIT;
