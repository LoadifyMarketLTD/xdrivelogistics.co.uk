-- ============================================================
-- 060_fix_profiles_status_type_in_auth_trigger.sql
--
-- ROOT CAUSE:
--   Supabase Auth /invite inserts into auth.users, which triggers
--   public.handle_auth_user_profile_sync(). The function wrote:
--     COALESCE(NEW.raw_user_meta_data ->> 'status', 'active')
--   into public.profiles.status.
--
--   In production, public.profiles.status is enum user_status.
--   Writing raw text can fail with:
--     SQLSTATE 42804: column "status" is of type user_status but
--     expression is of type text
--
-- FIX:
--   Replace the trigger function to stop writing raw text into
--   public.profiles.status. Let the column default/type enforcement
--   apply on insert, and preserve existing status on conflict updates.
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
  v_raw_role := LOWER(COALESCE(
    NEW.raw_user_meta_data ->> 'role',
    NEW.raw_user_meta_data ->> 'requested_role',
    'customer'
  ));

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

  INSERT INTO public.profiles (user_id, role, full_name, phone, is_driver, created_at, updated_at)
  VALUES (
    NEW.id,
    v_role,
    v_full_name,
    v_phone,
    v_is_driver,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE
    SET role       = COALESCE(EXCLUDED.role,      public.profiles.role),
        full_name  = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        phone      = COALESCE(EXCLUDED.phone,     public.profiles.phone),
        is_driver  = EXCLUDED.is_driver,
        updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;

CREATE TRIGGER on_auth_user_profile_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_profile_sync();

NOTIFY pgrst, 'reload schema';
