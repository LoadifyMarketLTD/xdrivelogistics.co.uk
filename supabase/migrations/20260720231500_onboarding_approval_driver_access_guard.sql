-- Keep onboarding approval, driver application access and job assignment eligibility aligned.
-- Apply on staging first. This migration does not approve any pending application by itself.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_onboarding_approval_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.account_type <> 'owner_driver' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    UPDATE public.companies
    SET status = 'active', updated_at = now()
    WHERE id = NEW.company_id;

    UPDATE public.profiles
    SET role = 'driver',
        status = 'active',
        is_driver = true,
        company_id = COALESCE(NEW.company_id, company_id),
        updated_at = now()
    WHERE user_id = NEW.user_id;

    UPDATE public.drivers
    SET status = 'active',
        app_access = true,
        company_id = COALESCE(NEW.company_id, company_id),
        updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSIF NEW.status IN ('rejected', 'request_changes') THEN
    UPDATE public.drivers
    SET app_access = false,
        updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_onboarding_approval_access ON public.onboarding_applications;
CREATE TRIGGER trg_sync_onboarding_approval_access
AFTER INSERT OR UPDATE OF status, company_id ON public.onboarding_applications
FOR EACH ROW
WHEN (NEW.account_type = 'owner_driver')
EXECUTE FUNCTION public.sync_onboarding_approval_access();

-- Repair already-approved owner-driver rows without changing pending/rejected records.
UPDATE public.companies c
SET status = 'active', updated_at = now()
FROM public.onboarding_applications oa
WHERE oa.company_id = c.id
  AND oa.account_type = 'owner_driver'
  AND oa.status = 'approved';

UPDATE public.profiles p
SET role = 'driver',
    status = 'active',
    is_driver = true,
    company_id = COALESCE(oa.company_id, p.company_id),
    updated_at = now()
FROM public.onboarding_applications oa
WHERE oa.user_id = p.user_id
  AND oa.account_type = 'owner_driver'
  AND oa.status = 'approved';

UPDATE public.drivers d
SET status = 'active',
    app_access = true,
    company_id = COALESCE(oa.company_id, d.company_id),
    updated_at = now()
FROM public.onboarding_applications oa
WHERE oa.user_id = d.user_id
  AND oa.account_type = 'owner_driver'
  AND oa.status = 'approved';

CREATE OR REPLACE FUNCTION public.guard_job_driver_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
  v_onboarding_status text;
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

  IF COALESCE(v_driver.status, '') <> 'active' OR COALESCE(v_driver.app_access, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Driver is not approved for application access and cannot be assigned.' USING ERRCODE = '23514';
  END IF;

  IF v_driver.user_id IS NOT NULL THEN
    SELECT oa.status
    INTO v_onboarding_status
    FROM public.onboarding_applications oa
    WHERE oa.user_id = v_driver.user_id
      AND oa.account_type = 'owner_driver'
    ORDER BY oa.updated_at DESC
    LIMIT 1;

    IF v_onboarding_status IS NOT NULL AND v_onboarding_status <> 'approved' THEN
      RAISE EXCEPTION 'Owner-driver onboarding is not approved.' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_job_driver_assignment ON public.jobs;
CREATE TRIGGER trg_guard_job_driver_assignment
BEFORE INSERT OR UPDATE OF assigned_driver_id ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.guard_job_driver_assignment();

REVOKE ALL ON FUNCTION public.sync_onboarding_approval_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_job_driver_assignment() FROM PUBLIC, anon, authenticated;

COMMIT;
