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

-- Legacy direct RPC retained for compatibility, but a suspended/disabled Driver
-- must never be able to reactivate their own operational presence through a
-- SECURITY DEFINER call. Valid active Drivers keep the same go-online behavior.
CREATE OR REPLACE FUNCTION public.driver_go_online()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_driver_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'driver_go_online: not authenticated (auth.uid() is null)'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.id
  INTO v_profile_id
  FROM public.profiles p
  WHERE p.user_id = v_user_id
    AND COALESCE(p.status::text, '') = 'active'
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Driver profile is not active.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.drivers d
  SET
    is_active = true,
    availability_status = 'available',
    last_app_login = now(),
    updated_at = now()
  WHERE d.user_id = v_user_id
    AND COALESCE(d.status::text, '') = 'active'
    AND COALESCE(d.app_access, false) = true
  RETURNING d.id INTO v_driver_id;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Driver account is not approved for app access.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.driver_availability_slots s
  SET
    available = true,
    updated_at = now()
  WHERE s.driver_id = v_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.driver_go_online() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_go_online() TO authenticated, service_role;

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.driver_has_valid_cpc(uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'driver_has_valid_cpc remains directly executable by authenticated.';
  END IF;

  IF has_function_privilege('authenticated', 'public.get_expiring_vehicle_documents(integer)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'get_expiring_vehicle_documents remains directly executable by authenticated.';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.driver_go_online()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'driver_go_online must remain available to authenticated active Drivers.';
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
