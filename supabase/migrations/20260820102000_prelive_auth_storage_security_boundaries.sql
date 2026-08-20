-- PreLive Checkpoint A remediation: close the two P0 security boundaries found
-- during the 2026-08-20 functional audit.
--
-- 1) Auth profile bootstrap must never trust user-controlled metadata for
--    platform-owner authority or account status.
-- 2) Authenticated users must not be able to mutate their own authoritative
--    profile role/status/company/driver flags after signup.
-- 3) onboarding-documents reviewers must be tenant scoped. Platform owner keeps
--    global review access; company reviewers only see applications belonging to
--    a company where they hold an active owner/admin membership.
--
-- No Workspace/Super Admin visual contract is changed by this migration.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- P0-AUTH: canonical safe auth.users -> profiles bootstrap.
-- Public/signup metadata may choose only ordinary application identities.
-- Platform owner is intentionally impossible to create from raw_user_meta_data;
-- the service-role-only promote_to_platform_owner() path remains authoritative.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_auth_user_profile_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw_role text;
  v_role text;
  v_full_name text;
  v_phone text;
  v_is_driver boolean;
BEGIN
  v_raw_role := lower(btrim(COALESCE(
    NEW.raw_user_meta_data ->> 'role',
    NEW.raw_user_meta_data ->> 'requested_role',
    'customer'
  )));

  -- Only non-platform identities are accepted from user-controlled metadata.
  -- Unknown values and every owner/super-admin alias fail closed to customer.
  v_role := CASE v_raw_role
    WHEN 'broker' THEN 'broker'
    WHEN 'freight_broker' THEN 'broker'
    WHEN 'shipper_broker' THEN 'broker'
    WHEN 'transport_broker' THEN 'broker'

    WHEN 'company_admin' THEN 'company_admin'
    WHEN 'fleet_operator' THEN 'company_admin'
    WHEN 'org_admin' THEN 'company_admin'

    WHEN 'company_staff' THEN 'company_staff'
    WHEN 'dispatcher' THEN 'company_staff'
    WHEN 'carrier' THEN 'company_staff'
    WHEN 'admin_operator' THEN 'company_staff'

    WHEN 'driver' THEN 'driver'
    WHEN 'owner_driver' THEN 'driver'
    WHEN 'owner_operator' THEN 'driver'
    WHEN 'company_driver' THEN 'driver'

    WHEN 'customer' THEN 'customer'
    WHEN 'customer_shipper' THEN 'customer'
    WHEN 'shipper' THEN 'customer'
    WHEN 'client' THEN 'customer'
    WHEN 'viewer' THEN 'customer'
    ELSE 'customer'
  END;

  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name'
  );
  v_phone := NEW.raw_user_meta_data ->> 'phone';
  v_is_driver := v_role = 'driver';

  INSERT INTO public.profiles (
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
    -- server-owned role/status if a profile was provisioned before this trigger.
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;
CREATE TRIGGER on_auth_user_profile_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_profile_sync();

COMMENT ON FUNCTION public.handle_auth_user_profile_sync() IS
  'Fail-closed Auth bootstrap. raw_user_meta_data may select ordinary app identities only; platform-owner authority and profile status are never trusted from user-controlled metadata.';

-- ---------------------------------------------------------------------------
-- P0-AUTH companion guard: even where historical table grants allow UPDATE,
-- an authenticated user cannot convert their own profile into a different
-- authoritative identity/status/company context. Service-role/server workflows
-- remain unaffected.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_authority_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role text := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
BEGIN
  IF v_jwt_role = 'authenticated'
     AND auth.uid() IS NOT NULL
     AND OLD.user_id = auth.uid()
     AND (
       NEW.role IS DISTINCT FROM OLD.role
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.is_driver IS DISTINCT FROM OLD.is_driver
     ) THEN
    RAISE EXCEPTION 'Authoritative profile fields cannot be changed by the authenticated user.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_authority_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_authority_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_authority_fields();

REVOKE ALL ON FUNCTION public.guard_profile_authority_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_profile_authority_fields() TO service_role;

COMMENT ON FUNCTION public.guard_profile_authority_fields() IS
  'Rejects authenticated self-mutation of profiles.role/status/company_id/is_driver; authoritative server/service-role workflows remain valid.';

-- ---------------------------------------------------------------------------
-- P0-STORAGE: replace global company_admin document review with a tenant-bound
-- reviewer contract. Storage path convention is:
-- onboarding-documents/{user_id}/{application_id}/{filename}
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS onboarding_docs_select_reviewer ON storage.objects;
DROP POLICY IF EXISTS onboarding_docs_select_tenant_reviewer ON storage.objects;

CREATE POLICY onboarding_docs_select_tenant_reviewer
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'onboarding-documents'
  AND (
    -- Platform Owner is the only authenticated global reviewer.
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'owner'
        AND COALESCE(p.status::text, '') = 'active'
    )
    OR
    -- Company review is allowed only when the storage path resolves to an
    -- onboarding application belonging to that exact company and the caller
    -- has an active owner/admin membership in the same company.
    EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      JOIN public.company_memberships cm
        ON cm.company_id = oa.company_id
       AND cm.user_id = auth.uid()
       AND COALESCE(cm.status::text, '') = 'active'
       AND COALESCE(cm.role_in_company::text, '') IN ('owner', 'admin')
      WHERE oa.company_id IS NOT NULL
        AND oa.user_id::text = (storage.foldername(name))[1]
        AND oa.id::text = (storage.foldername(name))[2]
    )
  )
);

COMMENT ON POLICY onboarding_docs_select_tenant_reviewer ON storage.objects IS
  'PreLive P0 boundary: Platform Owner may review globally; company owner/admin may review only onboarding documents whose {user_id}/{application_id} path resolves to an application in their own active company.';

NOTIFY pgrst, 'reload schema';
COMMIT;
