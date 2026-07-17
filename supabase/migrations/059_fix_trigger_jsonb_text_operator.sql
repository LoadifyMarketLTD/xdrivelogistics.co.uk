-- ============================================================
-- 059_fix_trigger_jsonb_text_operator.sql
--
-- ROOT CAUSE:
--   The live handle_auth_user_profile_sync function was found using
--   the JSONB extraction operator (->) instead of the text extraction
--   operator (->>) when reading raw_user_meta_data fields.
--
--   Using -> returns a JSONB value (e.g. "driver" with surrounding
--   quotes in its text representation), so LOWER(... -> 'role')
--   produces '"driver"' which never matches any CASE branch, causing
--   every user to silently receive the 'customer' role fallback.
--   full_name, phone and status also stored JSON-quoted strings.
--
--   Migration 056 had the corrected ->> version but the live function
--   was not updated (CREATE OR REPLACE did not take effect).
--
-- This migration:
--   1. Force-replaces the trigger function with all -> changed to ->>
--   2. Recreates the trigger (idempotent)
-- ============================================================

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
  -- Use ->> to extract plain TEXT from JSONB (-> returns JSONB, not text).
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
    WHEN 'viewer'         THEN 'customer'
    ELSE                       'customer'
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

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;

CREATE TRIGGER on_auth_user_profile_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_profile_sync();

NOTIFY pgrst, 'reload schema';
