-- Workspace security hardening identified during the 2026-09-27 full audit.
-- This migration intentionally changes only direct RPC exposure/search-path posture.
-- It does not alter business workflow semantics.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Pure classification helper. Pin search_path to remove mutable-search-path
-- ambiguity while preserving SECURITY INVOKER behavior.
ALTER FUNCTION public.fn_notification_event_class(text)
  SET search_path = pg_catalog, public;

-- These helpers are internal implementation primitives in the current repo.
-- They are invoked by privileged trigger/RPC code, not by browser clients.
-- Remove direct Data API execution for signed-in users.
REVOKE ALL ON FUNCTION public.driver_has_valid_cpc(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_has_valid_cpc(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_expiring_vehicle_documents(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_expiring_vehicle_documents(integer)
  TO service_role;

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.driver_has_valid_cpc(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'driver_has_valid_cpc remains directly executable by authenticated.';
  END IF;

  IF has_function_privilege('authenticated', 'public.get_expiring_vehicle_documents(integer)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'get_expiring_vehicle_documents remains directly executable by authenticated.';
  END IF;

  IF (
    SELECT p.proconfig IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM unnest(p.proconfig) cfg
         WHERE cfg = 'search_path=pg_catalog, public'
       )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fn_notification_event_class'
      AND p.pronargs = 1
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'fn_notification_event_class search_path is not pinned.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
