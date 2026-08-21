-- PreLive P0 closure: user-controlled signup metadata and legacy direct company
-- provisioning must never create operational authority.
--
-- This migration is forward-only and intentionally non-visual. It:
-- 1) trusts only server-controlled auth app_metadata for bootstrap role authority;
-- 2) makes direct authenticated company creation pending-approval only;
-- 3) prevents a pending company creator from activating their own membership;
-- 4) activates the canonical creator membership only when governance activates
--    the company;
-- 5) removes the profile-only Driver bid fallback and requires an active company
--    or an approved commercial Driver row;
-- 6) makes onboarding approval the authoritative broker/fleet/driver/customer
--    profile-role promotion point.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';

-- Public signup has no authoritative operational role until onboarding or
-- governance establishes one. NULL is the fail-closed bootstrap state.
ALTER TABLE public.profiles
  ALTER COLUMN role DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 1. Auth bootstrap: raw_user_meta_data is request data, never role authority.
--    Server-controlled raw_app_meta_data may carry a canonical/legacy role for
--    trusted admin/invitation flows. Ordinary public signup starts with role NULL
--    until onboarding/membership authority is established server-side.
-- ---------------------------------------------------------------------------
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

-- Remove the legacy metadata-role synchronizer. It reads user-controlled
-- raw_user_meta_data and therefore conflicts with the fail-closed authority
-- boundary implemented below.
DROP TRIGGER IF EXISTS trg_enforce_profile_role_from_auth_users ON auth.users;
DROP FUNCTION IF EXISTS public.enforce_profile_role_from_auth_users();

DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;
CREATE TRIGGER on_auth_user_profile_sync
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_profile_sync();

REVOKE ALL ON FUNCTION public.handle_auth_user_profile_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_auth_user_profile_sync() TO service_role;

COMMENT ON FUNCTION public.handle_auth_user_profile_sync() IS
  'Authoritative roles may bootstrap only from server-controlled app_metadata. Public raw_user_meta_data is request-only and cannot grant a role.';

-- ---------------------------------------------------------------------------
-- 2. Direct authenticated company creation is a request, never an approval.
--    Canonical server/service-role onboarding paths may still explicitly insert
--    active companies where the business contract permits it.
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies
  ALTER COLUMN status SET DEFAULT 'pending_approval';

DROP POLICY IF EXISTS "companies_insert_admin" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_authenticated" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_pending_creator" ON public.companies;

CREATE POLICY "companies_insert_pending_creator"
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND status::text = 'pending_approval'
  );

-- ---------------------------------------------------------------------------
-- 3. A pending-company creator may create only their own owner membership.
--    A BEFORE trigger forces it to invited while the company is not approved,
--    even if a legacy client requests status='active'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_pending_creator_membership_activation()
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
  v_company_status text;
  v_company_creator uuid;
BEGIN
  IF v_jwt_role <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.status::text, c.created_by
  INTO v_company_status, v_company_creator
  FROM public.companies c
  WHERE c.id = NEW.company_id;

  IF v_company_creator = auth.uid()
     AND NEW.user_id = auth.uid()
     AND NEW.role_in_company::text = 'owner'
     AND v_company_status = 'pending_approval'
  THEN
    NEW.status := 'invited';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_pending_creator_membership_activation
  ON public.company_memberships;
CREATE TRIGGER trg_guard_pending_creator_membership_activation
  BEFORE INSERT OR UPDATE ON public.company_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_pending_creator_membership_activation();

REVOKE ALL ON FUNCTION public.guard_pending_creator_membership_activation()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_pending_creator_membership_activation()
  TO service_role;

DROP POLICY IF EXISTS memberships_insert_creator_or_admin
  ON public.company_memberships;
CREATE POLICY memberships_insert_creator_or_admin
  ON public.company_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_company_admin(company_id)
    OR (
      public.is_company_creator(company_id)
      AND user_id = auth.uid()
      AND role_in_company::text = 'owner'
      AND status::text IN ('invited', 'active')
    )
  );

-- Governance activation is the only event that turns a pending creator's owner
-- membership into operational authority. Service-controlled onboarding paths
-- that already created an active owner membership are left unchanged.
CREATE OR REPLACE FUNCTION public.activate_company_creator_membership_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status::text = 'active'
     AND OLD.status::text IS DISTINCT FROM 'active'
     AND NEW.created_by IS NOT NULL
  THEN
    INSERT INTO public.company_memberships (
      company_id,
      user_id,
      role_in_company,
      status,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.created_by,
      'owner',
      'active',
      now()
    )
    ON CONFLICT (company_id, user_id)
    DO UPDATE SET
      role_in_company = 'owner',
      status = 'active',
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_company_creator_membership_on_approval
  ON public.companies;
CREATE TRIGGER trg_activate_company_creator_membership_on_approval
  AFTER UPDATE OF status ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_company_creator_membership_on_approval();

REVOKE ALL ON FUNCTION public.activate_company_creator_membership_on_approval()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_company_creator_membership_on_approval()
  TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Exchange bid RLS must not trust profile.role='driver' without a canonical
--    Driver row, and company bids require an active company as well as an active
--    membership.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;

CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bidder_user_id = auth.uid()
    AND (
      (
        job_bids.company_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          JOIN public.companies c ON c.id = cm.company_id
          WHERE cm.company_id = job_bids.company_id
            AND cm.user_id = auth.uid()
            AND cm.status::text = 'active'
            AND c.status::text = 'active'
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.drivers d
        WHERE d.user_id = auth.uid()
          AND d.app_access = true
          AND COALESCE(d.status::text, '') = 'active'
          AND d.can_commercial_bid = true
          AND (
            d.company_id = job_bids.company_id
            OR (d.company_id IS NULL AND job_bids.company_id IS NULL)
          )
          AND (
            d.company_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM public.companies dc
              WHERE dc.id = d.company_id
                AND dc.status::text = 'active'
            )
          )
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_bids.job_id
        AND j.status = 'posted'
        AND j.awarded_carrier_company_id IS NULL
        AND (
          j.exchange_visibility = 'exchange'
          OR (
            j.exchange_visibility = 'direct'
            AND job_bids.company_id IS NOT NULL
            AND j.direct_invite_company_id = job_bids.company_id
          )
        )
        AND (job_bids.company_id IS NULL OR j.company_id <> job_bids.company_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Approval is the authoritative role-promotion boundary. Preserve the latest
--    reviewed business logic as a private base function, then wrap it so company
--    activation, membership changes, notifications and profile authority remain
--    one atomic transaction.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure(
       'public.review_onboarding_application_atomic_authority_base_v1(uuid,uuid,text,text)'
     ) IS NULL
  THEN
    IF to_regprocedure(
         'public.review_onboarding_application_atomic(uuid,uuid,text,text)'
       ) IS NULL
    THEN
      RAISE EXCEPTION 'review_onboarding_application_atomic(uuid,uuid,text,text) is required before authority closure.'
        USING ERRCODE = '42883';
    END IF;

    ALTER FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text)
      RENAME TO review_onboarding_application_atomic_authority_base_v1;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic_authority_base_v1(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.review_onboarding_application_atomic(
  p_application_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE (
  onboarding_application_id uuid,
  status text,
  company_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result_application_id uuid;
  v_result_status text;
  v_result_company_id uuid;
  v_user_id uuid;
  v_account_type text;
  v_authoritative_role text;
  v_action text := lower(trim(COALESCE(p_action, '')));
BEGIN
  SELECT
    r.onboarding_application_id,
    r.status,
    r.company_id
  INTO
    v_result_application_id,
    v_result_status,
    v_result_company_id
  FROM public.review_onboarding_application_atomic_authority_base_v1(
    p_application_id,
    p_actor_user_id,
    v_action,
    p_notes
  ) AS r;

  IF v_result_application_id IS NULL THEN
    RAISE EXCEPTION 'Canonical onboarding review returned no result.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_action = 'approve' THEN
    SELECT oa.user_id, oa.account_type::text
    INTO v_user_id, v_account_type
    FROM public.onboarding_applications oa
    WHERE oa.id = p_application_id;

    v_authoritative_role := CASE lower(trim(COALESCE(v_account_type, '')))
      WHEN 'broker_shipper' THEN 'broker'
      WHEN 'fleet_courier' THEN 'company_admin'
      WHEN 'owner_driver' THEN 'driver'
      WHEN 'individual_driver' THEN 'driver'
      WHEN 'customer_shipper' THEN 'customer'
      ELSE NULL
    END;

    IF v_user_id IS NULL OR v_authoritative_role IS NULL THEN
      RAISE EXCEPTION 'Approved onboarding has no canonical profile-role mapping.'
        USING ERRCODE = '23514';
    END IF;

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
      v_user_id,
      v_authoritative_role,
      'active',
      v_result_company_id,
      v_authoritative_role = 'driver',
      now(),
      now()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      role = EXCLUDED.role,
      status = 'active',
      company_id = COALESCE(EXCLUDED.company_id, public.profiles.company_id),
      is_driver = EXCLUDED.is_driver,
      updated_at = now();
  END IF;

  RETURN QUERY
  SELECT v_result_application_id, v_result_status, v_result_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text)
  TO service_role;

COMMENT ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text) IS
  'Canonical service-controlled onboarding review plus atomic authoritative profile-role promotion on approval.';

NOTIFY pgrst, 'reload schema';
COMMIT;
