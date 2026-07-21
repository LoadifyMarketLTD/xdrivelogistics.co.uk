BEGIN;

DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.fleet_driver_invitations') IS NULL THEN
    v_missing := array_append(v_missing, 'table:fleet_driver_invitations');
  END IF;

  IF to_regprocedure('public.rotate_fleet_driver_invitation_token(uuid,uuid,boolean)') IS NULL THEN
    v_missing := array_append(v_missing, 'function:rotate_fleet_driver_invitation_token');
  END IF;

  IF to_regprocedure('public.fleet_driver_compliance_current(uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'function:fleet_driver_compliance_current');
  END IF;

  IF to_regprocedure('public.approve_fleet_driver_invitation(uuid,uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'function:approve_fleet_driver_invitation');
  END IF;

  IF to_regprocedure('public.revoke_fleet_driver_invitation(uuid,uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'function:revoke_fleet_driver_invitation');
  END IF;

  IF to_regprocedure('public.current_user_driver_access_allowed()') IS NULL THEN
    v_missing := array_append(v_missing, 'function:current_user_driver_access_allowed');
  END IF;

  IF to_regprocedure('public.guard_driver_access_compliance()') IS NULL THEN
    v_missing := array_append(v_missing, 'function:guard_driver_access_compliance');
  END IF;

  IF to_regprocedure('public.guard_job_driver_compliance()') IS NULL THEN
    v_missing := array_append(v_missing, 'function:guard_job_driver_compliance');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.drivers'::regclass
      AND tgname = 'trg_driver_access_compliance_guard'
      AND NOT tgisinternal
  ) THEN
    v_missing := array_append(v_missing, 'trigger:trg_driver_access_compliance_guard');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.jobs'::regclass
      AND tgname = 'trg_job_driver_compliance_guard'
      AND NOT tgisinternal
  ) THEN
    v_missing := array_append(v_missing, 'trigger:trg_job_driver_compliance_guard');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.company_memberships'::regclass
      AND tgname = 'trg_guard_fleet_driver_membership_activation'
      AND NOT tgisinternal
  ) THEN
    v_missing := array_append(v_missing, 'trigger:trg_guard_fleet_driver_membership_activation');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.driver_documents'::regclass
      AND tgname = 'trg_sync_fleet_driver_document_access'
      AND NOT tgisinternal
  ) THEN
    v_missing := array_append(v_missing, 'trigger:trg_sync_fleet_driver_document_access');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    WHERE c.oid = 'public.fleet_driver_invitations'::regclass
      AND c.relrowsecurity
  ) THEN
    v_missing := array_append(v_missing, 'rls:fleet_driver_invitations');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fleet_driver_invitations'
      AND policyname = 'fleet_driver_invitations_deny_authenticated'
  ) THEN
    v_missing := array_append(v_missing, 'policy:fleet_driver_invitations_deny_authenticated');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'Fleet Driver runtime contract incomplete: %', array_to_string(v_missing, ', ');
  END IF;
END
$$;

COMMIT;
