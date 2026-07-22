BEGIN;

-- Reconcile guard_driver_access_compliance and its trigger. These objects are
-- defined in 20260721154621_reconcile_fleet_driver_activation_guard.sql but may
-- be absent on staging databases whose migration records predate that file
-- (because the normalised version numbers were assigned before that file
-- existed). Creating them here is idempotent and does not alter any already-
-- applied migration.
CREATE OR REPLACE FUNCTION public.guard_driver_access_compliance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_application_exists boolean := false;
  v_owner_compliant boolean := true;
  v_fleet_invitation_exists boolean := false;
  v_fleet_compliant boolean := true;
BEGIN
  IF COALESCE(NEW.app_access, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      WHERE oa.user_id = NEW.user_id
        AND oa.account_type = 'owner_driver'
    ) INTO v_owner_application_exists;

    IF v_owner_application_exists THEN
      v_owner_compliant := public.owner_driver_compliance_current(NEW.user_id);
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.fleet_driver_invitations fdi
    WHERE fdi.driver_id = NEW.id
  ) INTO v_fleet_invitation_exists;

  IF v_fleet_invitation_exists THEN
    v_fleet_compliant := public.fleet_driver_compliance_current(NEW.id);
  END IF;

  IF NOT v_owner_compliant OR NOT v_fleet_compliant THEN
    NEW.app_access := false;
    IF v_fleet_invitation_exists AND COALESCE(NEW.status, '') = 'active' THEN
      NEW.status := 'invited';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.drivers'::regclass
      AND tgname = 'trg_driver_access_compliance_guard'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_driver_access_compliance_guard
    BEFORE INSERT OR UPDATE OF app_access, user_id, status
    ON public.drivers
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_driver_access_compliance();
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.guard_driver_access_compliance()
  FROM PUBLIC, anon, authenticated;

-- Reconcile guard_job_driver_compliance and its trigger. Defined in
-- 20260721154623_reconcile_fleet_job_access_guards.sql; same rationale as above.
CREATE OR REPLACE FUNCTION public.guard_job_driver_compliance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
BEGIN
  IF NEW.assigned_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.assigned_driver_id IS NOT DISTINCT FROM OLD.assigned_driver_id THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_driver
  FROM public.drivers
  WHERE id = NEW.assigned_driver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assigned driver does not exist.' USING ERRCODE = '23503';
  END IF;

  IF COALESCE(v_driver.status, '') <> 'active'
     OR COALESCE(v_driver.app_access, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Driver is not approved for application access and cannot be assigned.'
      USING ERRCODE = '23514';
  END IF;

  IF v_driver.user_id IS NOT NULL
     AND NOT public.owner_driver_compliance_current(v_driver.user_id) THEN
    RAISE EXCEPTION 'Owner-driver compliance is missing, unverified or expired.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT public.fleet_driver_compliance_current(v_driver.id) THEN
    RAISE EXCEPTION 'Fleet-driver invitation or compliance is incomplete or expired.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.jobs'::regclass
      AND tgname = 'trg_job_driver_compliance_guard'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_job_driver_compliance_guard
    BEFORE INSERT OR UPDATE OF assigned_driver_id
    ON public.jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_job_driver_compliance();
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.guard_job_driver_compliance()
  FROM PUBLIC, anon, authenticated;

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
