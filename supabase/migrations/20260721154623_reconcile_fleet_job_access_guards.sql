BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_driver_access_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.user_id = auth.uid()
      AND d.status = 'active'
      AND d.app_access IS TRUE
      AND public.owner_driver_compliance_current(d.user_id)
      AND public.fleet_driver_compliance_current(d.id)
  );
$$;

-- Extend the canonical assignment guard already used by
-- trg_job_driver_compliance_guard. Reusing the existing function avoids a
-- second competing trigger and preserves legacy dependency relationships.
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
REVOKE ALL ON FUNCTION public.current_user_driver_access_allowed()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_driver_access_allowed()
  TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('public.guard_job_driver_compliance()') IS NULL
     OR to_regprocedure('public.current_user_driver_access_allowed()') IS NULL THEN
    RAISE EXCEPTION 'Fleet Driver job-access guard reconciliation failed.';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
