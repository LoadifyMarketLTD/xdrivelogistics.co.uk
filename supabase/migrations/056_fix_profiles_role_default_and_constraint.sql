-- ============================================================
-- 056_fix_profiles_role_default_and_constraint.sql
--
-- ROOT CAUSE:
--   Migration 017/020 added profiles.role with DEFAULT 'viewer'.
--   Migration 031 added CHECK profiles_role_canonical that allows only
--   ('owner','admin','company','driver','customer') but did NOT change
--   the DEFAULT. Any INSERT that omits role (or any existing row carrying
--   role='viewer') violates the constraint, causing:
--     "new row for relation profiles violates check constraint
--      profiles_role_canonical"
--
-- This migration:
--   1. Backfills any remaining non-canonical role values to 'customer'
--   2. Changes the column DEFAULT from 'viewer' to 'customer'
--   3. Replaces the CHECK constraint (drop + re-add idempotently) to
--      ensure the live constraint matches the canonical set
--   4. Re-applies the canonical handle_auth_user_profile_sync trigger
--      function (idempotent CREATE OR REPLACE) so the live function is
--      guaranteed to match migration 031's canonical CASE mapping
-- ============================================================

-- ── 1. Backfill any remaining non-canonical role values ─────────────────────
UPDATE public.profiles
SET    role       = 'owner',
       updated_at = NOW()
WHERE  LOWER(role) IN ('superadmin', 'super_admin', 'platform_owner')
  AND  role IS NOT NULL;

UPDATE public.profiles
SET    role       = 'admin',
       updated_at = NOW()
WHERE  LOWER(role) IN ('company_admin', 'org_admin', 'platform_admin', 'admin_staff')
  AND  role IS NOT NULL;

UPDATE public.profiles
SET    role       = 'company',
       updated_at = NOW()
WHERE  LOWER(role) IN ('broker', 'freight_broker', 'carrier', 'dispatcher',
                       'company_staff', 'company_admin')
  AND  role NOT IN ('owner', 'admin', 'company', 'driver', 'customer');

UPDATE public.profiles
SET    role       = 'driver',
       updated_at = NOW()
WHERE  LOWER(role) IN ('owner_driver')
  AND  role IS NOT NULL;

-- Catch-all: 'viewer' and any other non-canonical value → 'customer'
UPDATE public.profiles
SET    role       = 'customer',
       updated_at = NOW()
WHERE  role IS NOT NULL
  AND  role NOT IN ('owner', 'admin', 'company', 'driver', 'customer');

-- ── 2. Fix the column DEFAULT so missing-role INSERTs use 'customer' ─────────
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'customer';

-- ── 3. Re-apply the CHECK constraint with the correct allowed set ────────────
--    Drop first (if it exists) so we guarantee the live definition is correct,
--    then re-add. Safe because step 1 already backfilled any violating rows.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_canonical;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_canonical
  CHECK (role IS NULL OR role IN ('owner', 'admin', 'company', 'driver', 'customer'));

-- ── 4. Re-apply canonical trigger function (idempotent) ─────────────────────
--    Guarantees the live function has the full CASE mapping even if migration
--    031's CREATE OR REPLACE did not execute successfully in production.
CREATE OR REPLACE FUNCTION public.handle_auth_user_profile_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_role  text;
  v_role      text;
  v_full_name text;
  v_phone     text;
  v_is_driver boolean;
BEGIN
  v_raw_role := LOWER(COALESCE(
    NEW.raw_user_meta_data ->> 'role',
    NEW.raw_user_meta_data ->> 'requested_role',
    'customer'
  ));

  -- Map any legacy or alias role value to a canonical app role.
  v_role := CASE v_raw_role
    WHEN 'owner'          THEN 'owner'
    WHEN 'superadmin'     THEN 'owner'
    WHEN 'super_admin'    THEN 'owner'
    WHEN 'platform_owner' THEN 'owner'
    WHEN 'admin'          THEN 'admin'
    WHEN 'company_admin'  THEN 'admin'
    WHEN 'admin_staff'    THEN 'admin'
    WHEN 'org_admin'      THEN 'admin'
    WHEN 'platform_admin' THEN 'admin'
    WHEN 'company'        THEN 'company'
    WHEN 'dispatcher'     THEN 'company'
    WHEN 'company_staff'  THEN 'company'
    WHEN 'broker'         THEN 'company'
    WHEN 'freight_broker' THEN 'company'
    WHEN 'carrier'        THEN 'company'
    WHEN 'driver'         THEN 'driver'
    WHEN 'owner_driver'   THEN 'driver'
    WHEN 'customer'       THEN 'customer'
    WHEN 'shipper'        THEN 'customer'
    WHEN 'client'         THEN 'customer'
    WHEN 'viewer'         THEN 'customer'  -- DEFAULT was 'viewer'; map to canonical
    ELSE                       'customer'  -- safe fallback for unknown values
  END;

  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name'
  );
  v_phone     := NEW.raw_user_meta_data ->> 'phone';
  v_is_driver := v_role = 'driver';

  INSERT INTO public.profiles (user_id, role, status, full_name, phone, is_driver, created_at, updated_at)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data ->> 'status', 'active'),
    v_full_name,
    v_phone,
    v_is_driver,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE
    SET role       = COALESCE(EXCLUDED.role,      public.profiles.role),
        status     = COALESCE(EXCLUDED.status,    public.profiles.status),
        full_name  = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        phone      = COALESCE(EXCLUDED.phone,     public.profiles.phone),
        is_driver  = EXCLUDED.is_driver,
        updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists (idempotent: DROP IF EXISTS + CREATE).
DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;

CREATE TRIGGER on_auth_user_profile_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_profile_sync();

NOTIFY pgrst, 'reload schema';
