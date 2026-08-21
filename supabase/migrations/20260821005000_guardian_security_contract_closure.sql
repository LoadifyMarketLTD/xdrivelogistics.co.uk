-- Branch Guardian post-merge security contract closure.
--
-- Purpose:
--   1) Remove the unintended service_role grant from the public,
--      auth.uid()-bound vehicle advertising RPC.
--   2) Make existing public reporting/onboarding views obey caller permissions
--      and underlying-table RLS through security_invoker.
--
-- This migration is metadata/permission-only. It does not rewrite application
-- rows and remains safe when an optional view is absent.
--
-- Rollback (manual, only after a security review):
--   GRANT EXECUTE ON FUNCTION public.set_vehicle_advertising_state(uuid, text, text, jsonb)
--     TO service_role;
--   ALTER VIEW <view> RESET (security_invoker);

BEGIN;

DO $$
BEGIN
  IF to_regprocedure(
    'public.set_vehicle_advertising_state(uuid,text,text,jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'Canonical vehicle advertising RPC is missing; refusing partial security closure.'
      USING ERRCODE = '42883';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION
  public.set_vehicle_advertising_state(uuid, text, text, jsonb)
FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION
  public.set_vehicle_advertising_state(uuid, text, text, jsonb)
TO authenticated;

DO $$
DECLARE
  v_view text;
BEGIN
  FOREACH v_view IN ARRAY ARRAY[
    'jobs_reporting',
    'v_loads',
    'onboarding_approvals_documents_v1',
    'onboarding_approvals_documents_v2'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_view)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER VIEW public.%I SET (security_invoker = true)',
        v_view
      );
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_view text;
  v_reloptions text[];
BEGIN
  IF has_function_privilege(
    'service_role',
    'public.set_vehicle_advertising_state(uuid,text,text,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'service_role still has EXECUTE on the auth.uid()-bound vehicle advertising RPC.'
      USING ERRCODE = '42501';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.set_vehicle_advertising_state(uuid,text,text,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'anon unexpectedly has EXECUTE on the vehicle advertising RPC.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.set_vehicle_advertising_state(uuid,text,text,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'authenticated lost EXECUTE on the vehicle advertising RPC.'
      USING ERRCODE = '42501';
  END IF;

  FOREACH v_view IN ARRAY ARRAY[
    'jobs_reporting',
    'v_loads',
    'onboarding_approvals_documents_v1',
    'onboarding_approvals_documents_v2'
  ]
  LOOP
    SELECT c.reloptions
    INTO v_reloptions
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = v_view
      AND c.relkind = 'v';

    IF FOUND
       AND NOT (
         coalesce(v_reloptions, ARRAY[]::text[])
         @> ARRAY['security_invoker=true']
       ) THEN
      RAISE EXCEPTION
        'View public.% was not converted to security_invoker.', v_view
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
