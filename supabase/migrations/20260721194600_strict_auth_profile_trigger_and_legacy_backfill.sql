-- Remove the emergency auth.users trigger behaviour that defaulted unknown
-- identities to Customer and activated public signups before onboarding.
-- Existing operational accounts are repaired once from authoritative company,
-- membership and driver records; login remains read-only.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_auth_user_profile_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requested text;
  v_role text;
  v_status text;
  v_is_driver boolean;
  v_full_name text;
  v_phone text;
BEGIN
  v_requested := lower(trim(COALESCE(
    NEW.raw_user_meta_data ->> 'account_type',
    NEW.raw_user_meta_data ->> 'requested_role',
    NEW.raw_user_meta_data ->> 'signup_type',
    NEW.raw_user_meta_data ->> 'role',
    NEW.raw_app_meta_data ->> 'role',
    ''
  )));

  -- Public account types always start pending. Fleet Drivers are created only
  -- by an authenticated Fleet Operator and use requested_role = driver; their
  -- company membership and drivers.app_access remain the operational gates.
  v_role := CASE
    WHEN v_requested IN ('customer', 'customer_shipper', 'shipper', 'client') THEN 'customer'
    WHEN v_requested IN ('broker', 'broker_shipper', 'transport_broker', 'freight_broker') THEN 'broker'
    WHEN v_requested IN ('fleet_operator', 'fleet_courier') THEN 'company_admin'
    WHEN v_requested IN ('owner_driver', 'owner-driver', 'owner_operator', 'owner-operator', 'sole_trader') THEN 'driver'
    WHEN v_requested IN ('driver', 'company_driver') THEN 'driver'
    WHEN v_requested IN ('company_admin', 'admin', 'org_admin') THEN 'company_admin'
    WHEN v_requested IN ('company_staff', 'company', 'dispatcher', 'carrier') THEN 'company_staff'
    WHEN v_requested IN ('owner', 'superadmin', 'super_admin', 'platform_owner') THEN 'owner'
    ELSE NULL
  END;

  -- Unknown metadata must not be silently converted into a Customer account.
  -- Leave it without a profile so authentication returns profile_missing and an
  -- administrator can repair the identity deliberately.
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  v_status := CASE
    WHEN v_requested IN (
      'customer', 'customer_shipper', 'shipper', 'client',
      'broker', 'broker_shipper', 'transport_broker', 'freight_broker',
      'fleet_operator', 'fleet_courier',
      'owner_driver', 'owner-driver', 'owner_operator', 'owner-operator', 'sole_trader'
    ) THEN 'pending'
    ELSE 'active'
  END;

  v_is_driver := v_role = 'driver';
  v_full_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), '')
  );
  v_phone := NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), '');

  INSERT INTO public.profiles (
    user_id, role, status, full_name, phone, is_driver, created_at, updated_at
  ) VALUES (
    NEW.id, v_role, v_status, v_full_name, v_phone, v_is_driver, now(), now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;
CREATE TRIGGER on_auth_user_profile_sync
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_profile_sync();

-- Backfill missing profiles for established active company accounts. This is a
-- one-time migration, not a login side effect. It never invents Customer when
-- the company/member evidence is ambiguous.
INSERT INTO public.profiles (
  user_id, role, status, company_id, is_driver, created_at, updated_at
)
SELECT DISTINCT ON (cm.user_id)
  cm.user_id,
  CASE
    WHEN lower(COALESCE(c.company_type, '')) IN ('broker', 'broker_shipper', 'transport_broker') THEN 'broker'
    WHEN lower(COALESCE(c.company_type, '')) IN ('customer', 'customer_shipper', 'shipper') THEN 'customer'
    WHEN lower(COALESCE(c.company_type, '')) IN ('owner_driver', 'owner_operator') THEN 'driver'
    WHEN cm.role_in_company IN ('owner', 'admin') THEN 'company_admin'
    ELSE 'company_staff'
  END,
  'active',
  cm.company_id,
  lower(COALESCE(c.company_type, '')) IN ('owner_driver', 'owner_operator'),
  now(),
  now()
FROM public.company_memberships cm
JOIN public.companies c ON c.id = cm.company_id
LEFT JOIN public.profiles p ON p.user_id = cm.user_id
WHERE p.user_id IS NULL
  AND cm.user_id IS NOT NULL
  AND cm.status = 'active'
  AND c.status::text = 'active'
ORDER BY cm.user_id, cm.updated_at DESC NULLS LAST, cm.created_at DESC NULLS LAST
ON CONFLICT (user_id) DO NOTHING;

-- A Fleet Driver may have a driver record but no profile due to an earlier
-- partial invitation. Use that explicit driver record rather than guessing.
INSERT INTO public.profiles (
  user_id, role, status, company_id, is_driver, created_at, updated_at
)
SELECT DISTINCT ON (d.user_id)
  d.user_id,
  'driver',
  CASE WHEN COALESCE(d.app_access, false) THEN 'active' ELSE 'pending' END,
  d.company_id,
  true,
  now(),
  now()
FROM public.drivers d
LEFT JOIN public.profiles p ON p.user_id = d.user_id
WHERE p.user_id IS NULL
  AND d.user_id IS NOT NULL
ORDER BY d.user_id, d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST
ON CONFLICT (user_id) DO NOTHING;

-- Resolve nullable legacy statuses only where authoritative evidence exists.
UPDATE public.profiles p
SET status = 'pending', updated_at = now()
FROM public.onboarding_applications a
WHERE p.user_id = a.user_id
  AND p.status IS NULL
  AND a.status <> 'approved';

UPDATE public.profiles p
SET status = 'active', updated_at = now()
WHERE p.status IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.user_id = p.user_id
      AND cm.status = 'active'
      AND c.status::text = 'active'
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
