-- Forward-only repair for the legacy profiles.id foreign-key contract.
-- Both profiles.id and profiles.user_id reference auth.users(id), therefore
-- auth bootstrap must set both identifiers from NEW.id.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_auth_user_profile_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_server_role text := lower(btrim(COALESCE(NEW.raw_app_meta_data ->> 'role', '')));
  v_role text;
  v_full_name text;
  v_phone text;
  v_is_driver boolean := false;
BEGIN
  v_role := CASE v_server_role
    WHEN 'owner' THEN 'owner'
    WHEN 'superadmin' THEN 'owner'
    WHEN 'super_admin' THEN 'owner'
    WHEN 'platform_owner' THEN 'owner'
    WHEN 'platform_admin' THEN 'owner'
    WHEN 'platform_administrator' THEN 'owner'

    WHEN 'broker' THEN 'broker'
    WHEN 'freight_broker' THEN 'broker'
    WHEN 'shipper_broker' THEN 'broker'
    WHEN 'transport_broker' THEN 'broker'

    WHEN 'company_admin' THEN 'company_admin'
    WHEN 'admin' THEN 'company_admin'
    WHEN 'admin_staff' THEN 'company_admin'
    WHEN 'org_admin' THEN 'company_admin'
    WHEN 'fleet_operator' THEN 'company_admin'

    WHEN 'company_staff' THEN 'company_staff'
    WHEN 'company' THEN 'company_staff'
    WHEN 'dispatcher' THEN 'company_staff'
    WHEN 'carrier' THEN 'company_staff'
    WHEN 'admin_operator' THEN 'company_staff'

    WHEN 'driver' THEN 'driver'
    WHEN 'owner_driver' THEN 'driver'
    WHEN 'owner-driver' THEN 'driver'
    WHEN 'owner_operator' THEN 'driver'
    WHEN 'owner-operator' THEN 'driver'
    WHEN 'self_employed' THEN 'driver'
    WHEN 'self-employed' THEN 'driver'
    WHEN 'self_employed_driver' THEN 'driver'
    WHEN 'company_driver' THEN 'driver'

    WHEN 'customer' THEN 'customer'
    WHEN 'customer_shipper' THEN 'customer'
    WHEN 'shipper' THEN 'customer'
    WHEN 'client' THEN 'customer'
    WHEN 'viewer' THEN 'customer'
    ELSE NULL
  END;

  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name'
  );
  v_phone := NEW.raw_user_meta_data ->> 'phone';
  v_is_driver := COALESCE(v_role = 'driver', false);

  INSERT INTO public.profiles (
    id,
    user_id,
    role,
    status,
    full_name,
    phone,
    is_driver,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    v_role,
    'active',
    v_full_name,
    v_phone,
    v_is_driver,
    now(),
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    -- Auth INSERT is not a privilege-promotion channel. Preserve any existing
    -- server-owned role/status/company/driver authority.
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = now();

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
