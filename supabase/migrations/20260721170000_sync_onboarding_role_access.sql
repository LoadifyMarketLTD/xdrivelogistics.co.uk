-- Keep the selected onboarding account type, profile role and access state aligned.
-- This prevents incomplete or misclassified accounts from entering the wrong workspace.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_onboarding_role_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_role text;
  v_profile_status text;
BEGIN
  v_profile_role := CASE NEW.account_type
    WHEN 'customer_shipper' THEN 'customer'
    WHEN 'broker_shipper' THEN 'broker'
    WHEN 'fleet_courier' THEN 'company_admin'
    WHEN 'owner_driver' THEN 'driver'
    ELSE NULL
  END;

  IF v_profile_role IS NULL THEN
    RAISE EXCEPTION 'Unsupported onboarding account type: %', NEW.account_type
      USING ERRCODE = '23514';
  END IF;

  v_profile_status := CASE
    WHEN NEW.status = 'approved' THEN 'active'
    WHEN NEW.status = 'rejected' THEN 'blocked'
    ELSE 'pending'
  END;

  INSERT INTO public.profiles (
    user_id,
    role,
    status,
    company_id,
    is_driver,
    created_at,
    updated_at
  )
  VALUES (
    NEW.user_id,
    v_profile_role,
    v_profile_status,
    NEW.company_id,
    NEW.account_type = 'owner_driver',
    now(),
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    status = CASE
      WHEN public.profiles.status = 'suspended' AND NEW.status <> 'approved'
        THEN public.profiles.status
      ELSE EXCLUDED.status
    END,
    company_id = COALESCE(NEW.company_id, public.profiles.company_id),
    is_driver = EXCLUDED.is_driver,
    updated_at = now();

  IF NEW.status = 'approved' AND NEW.company_id IS NOT NULL THEN
    UPDATE public.companies
    SET status = 'active', updated_at = now()
    WHERE id = NEW.company_id;
  END IF;

  IF NEW.account_type = 'owner_driver' THEN
    IF NEW.status = 'approved' THEN
      UPDATE public.drivers
      SET status = 'active',
          app_access = true,
          company_id = COALESCE(NEW.company_id, company_id),
          updated_at = now()
      WHERE user_id = NEW.user_id;
    ELSE
      UPDATE public.drivers
      SET app_access = false,
          company_id = COALESCE(NEW.company_id, company_id),
          updated_at = now()
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_onboarding_approval_access ON public.onboarding_applications;
DROP TRIGGER IF EXISTS trg_sync_onboarding_role_access ON public.onboarding_applications;
CREATE TRIGGER trg_sync_onboarding_role_access
AFTER INSERT OR UPDATE OF status, account_type, company_id
ON public.onboarding_applications
FOR EACH ROW
EXECUTE FUNCTION public.sync_onboarding_role_access();

-- Reconcile existing onboarding users without changing the selected account type
-- or approving any application.
UPDATE public.onboarding_applications
SET status = status
WHERE account_type IN (
  'customer_shipper',
  'broker_shipper',
  'fleet_courier',
  'owner_driver'
);

REVOKE ALL ON FUNCTION public.sync_onboarding_role_access() FROM PUBLIC, anon, authenticated;

COMMIT;
