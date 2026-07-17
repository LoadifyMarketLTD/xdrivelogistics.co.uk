-- 063_expand_profiles_role_canonical_for_exchange_accounts.sql
-- Expand canonical app roles in public.profiles.role to support
-- owner | broker | company_admin | company_staff | driver | customer.

BEGIN;

-- Owner aliases
UPDATE public.profiles
SET role = 'owner',
    updated_at = NOW()
WHERE role IS NOT NULL
  AND LOWER(role) IN ('owner', 'superadmin', 'super_admin', 'platform_owner');

-- Broker aliases
UPDATE public.profiles
SET role = 'broker',
    updated_at = NOW()
WHERE role IS NOT NULL
  AND LOWER(role) IN ('broker', 'freight_broker', 'shipper_broker');

-- Company admin aliases
UPDATE public.profiles
SET role = 'company_admin',
    updated_at = NOW()
WHERE role IS NOT NULL
  AND LOWER(role) IN ('company_admin', 'admin', 'admin_staff', 'org_admin', 'platform_admin');

-- Company staff aliases
UPDATE public.profiles
SET role = 'company_staff',
    updated_at = NOW()
WHERE role IS NOT NULL
  AND LOWER(role) IN ('company', 'company_staff', 'dispatcher', 'carrier', 'admin_operator');

-- Driver aliases
UPDATE public.profiles
SET role = 'driver',
    is_driver = TRUE,
    updated_at = NOW()
WHERE role IS NOT NULL
  AND LOWER(role) IN ('driver', 'owner_driver');

-- Customer aliases
UPDATE public.profiles
SET role = 'customer',
    updated_at = NOW()
WHERE role IS NOT NULL
  AND LOWER(role) IN ('customer', 'shipper', 'client', 'viewer');

-- Catch-all fallback
UPDATE public.profiles
SET role = 'customer',
    updated_at = NOW()
WHERE role IS NOT NULL
  AND role NOT IN ('owner', 'broker', 'company_admin', 'company_staff', 'driver', 'customer');

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'customer';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_canonical;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_canonical
  CHECK (role IS NULL OR role IN ('owner', 'broker', 'company_admin', 'company_staff', 'driver', 'customer'));

COMMIT;

NOTIFY pgrst, 'reload schema';
