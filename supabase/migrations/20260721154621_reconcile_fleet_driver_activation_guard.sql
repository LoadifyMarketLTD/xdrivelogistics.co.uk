BEGIN;

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

COMMIT;
