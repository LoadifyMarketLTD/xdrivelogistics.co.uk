-- 066_role_alias_backfill_and_auth_trigger_update.sql
-- Ensure auth trigger writes canonical expanded app roles.

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

    WHEN 'broker'         THEN 'broker'
    WHEN 'freight_broker' THEN 'broker'
    WHEN 'shipper_broker' THEN 'broker'

    WHEN 'company_admin'  THEN 'company_admin'
    WHEN 'admin'          THEN 'company_admin'
    WHEN 'admin_staff'    THEN 'company_admin'
    WHEN 'org_admin'      THEN 'company_admin'
    WHEN 'platform_admin' THEN 'company_admin'

    WHEN 'company_staff'  THEN 'company_staff'
    WHEN 'company'        THEN 'company_staff'
    WHEN 'dispatcher'     THEN 'company_staff'
    WHEN 'carrier'        THEN 'company_staff'
    WHEN 'admin_operator' THEN 'company_staff'

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
    SET role       = COALESCE(EXCLUDED.role, public.profiles.role),
        status     = COALESCE(EXCLUDED.status, public.profiles.status),
        full_name  = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        phone      = COALESCE(EXCLUDED.phone, public.profiles.phone),
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
