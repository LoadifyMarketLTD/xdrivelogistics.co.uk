-- Hosted migration-history reconciliation alias.
-- Production recorded close_anonymous_security_definer_rpc_surface at
-- 20260905005339 while the canonical repository migration is 20260904231500.
-- Fresh replay executes the canonical hardening first; this file only verifies
-- that the non-PostGIS anonymous SECURITY DEFINER surface is still closed.

BEGIN;

DO $$
DECLARE
  v_bad_anon integer;
BEGIN
  SELECT count(*)
  INTO v_bad_anon
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.proname <> 'st_estimatedextent'
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_bad_anon <> 0 THEN
    RAISE EXCEPTION 'Non-PostGIS anonymous SECURITY DEFINER RPC surface is not converged: % remain.', v_bad_anon;
  END IF;
END;
$$;

COMMIT;
