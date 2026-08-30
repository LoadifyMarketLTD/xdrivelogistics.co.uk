BEGIN;

-- P0-02: reconcile the canonical Driver identity boundary.
--
-- Production historically contains Driver/profile/membership rows that pre-date
-- platform_identity_registry. The unified identity gate also attempted to write
-- the non-existent enum value `pending_verification` into both profiles.status
-- (user_status) and drivers.status (status_enum). Repair the gate first, then
-- reconcile historical records without inventing an approved identity.

-- -----------------------------------------------------------------------------
-- 1. Enum-safe profile gate.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_driver_profile_identity_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_identity public.platform_identity_registry%ROWTYPE;
BEGIN
  IF NEW.role IS DISTINCT FROM 'driver' OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_identity
  FROM public.platform_identity_registry identity
  WHERE identity.user_id = NEW.user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_identity.company_id IS DISTINCT FROM NEW.company_id
       OR v_identity.identity_mode NOT IN ('company_driver', 'owner_driver')
    THEN
      RAISE EXCEPTION
        'Identity conflict: the verified identity cannot be assigned to this company or role.'
        USING ERRCODE = '23505';
    END IF;

    IF v_identity.status = 'active' THEN
      RETURN NEW;
    END IF;

    -- A known but non-active identity must stay fail-closed. `pending` is the
    -- valid user_status enum value for an account awaiting/re-entering review.
    NEW.status := 'pending'::public.user_status;
    RETURN NEW;
  END IF;

  PERFORM public.ensure_company_driver_onboarding(
    NEW.user_id,
    NEW.company_id,
    NEW.full_name,
    NEW.phone
  );

  NEW.status := 'pending'::public.user_status;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Enum-safe Driver record gate.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_driver_record_identity_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_identity public.platform_identity_registry%ROWTYPE;
BEGIN
  IF NEW.user_id IS NULL OR NEW.company_id IS NULL THEN
    NEW.status := 'inactive'::public.status_enum;
    NEW.is_active := false;
    NEW.app_access := false;
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_identity
  FROM public.platform_identity_registry identity
  WHERE identity.user_id = NEW.user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_identity.company_id IS DISTINCT FROM NEW.company_id
       OR v_identity.identity_mode NOT IN ('company_driver', 'owner_driver')
    THEN
      RAISE EXCEPTION
        'Identity conflict: the verified identity cannot be assigned to this company.'
        USING ERRCODE = '23505';
    END IF;

    IF v_identity.status = 'active' THEN
      RETURN NEW;
    END IF;

    -- Identity exists but is on hold/banned/closed: preserve the record while
    -- making it operationally impossible to use until a valid activation event.
    NEW.status := 'inactive'::public.status_enum;
    NEW.is_active := false;
    NEW.app_access := false;
    RETURN NEW;
  END IF;

  PERFORM public.ensure_company_driver_onboarding(
    NEW.user_id,
    NEW.company_id,
    NEW.display_name,
    NEW.phone
  );

  NEW.status := 'inactive'::public.status_enum;
  NEW.is_active := false;
  NEW.app_access := false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_drivers_identity_gate ON public.drivers;
CREATE TRIGGER trg_drivers_identity_gate
  BEFORE INSERT OR UPDATE OF user_id, company_id, status, is_active, app_access
  ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_driver_record_identity_gate();

-- -----------------------------------------------------------------------------
-- 3. Approval remains the only positive activation event. Preserve the current
--    identity conflict checks, but make every activated enum/relationship value
--    compatible with the actual production schema.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_approved_onboarding_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_identity_mode text;
  v_existing public.platform_identity_registry%ROWTYPE;
  v_normalized_name text;
BEGIN
  IF NEW.status <> 'approved' OR COALESCE(OLD.status, '') = 'approved' THEN
    RETURN NEW;
  END IF;

  v_identity_mode := CASE
    WHEN NEW.account_type = 'individual_driver' THEN 'company_driver'
    WHEN NEW.account_type = 'owner_driver' THEN 'owner_driver'
    WHEN NEW.account_type IN ('fleet_courier', 'broker_shipper') THEN 'company_owner'
    ELSE 'company_user'
  END;

  IF v_identity_mode IN ('company_driver', 'owner_driver') AND NEW.company_id IS NULL THEN
    RAISE EXCEPTION
      'Cannot activate % identity without one linked company.', v_identity_mode
      USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.platform_identity_registry identity
  WHERE identity.user_id = NEW.user_id
  FOR UPDATE;

  IF FOUND AND (
    v_existing.identity_mode <> v_identity_mode
    OR v_existing.company_id IS DISTINCT FROM NEW.company_id
  ) THEN
    RAISE EXCEPTION
      'Identity conflict: approval would replace another company or identity mode.'
      USING ERRCODE = '23505';
  END IF;

  v_normalized_name := lower(trim(COALESCE(
    NULLIF(NEW.payload->>'full_name', ''),
    NULLIF(NEW.payload->>'contact_person', ''),
    split_part(NEW.email, '@', 1)
  )));

  INSERT INTO public.platform_identity_registry (
    user_id,
    company_id,
    identity_mode,
    legal_name_normalized,
    status,
    verified_at,
    verified_by,
    updated_at
  )
  VALUES (
    NEW.user_id,
    NEW.company_id,
    v_identity_mode,
    v_normalized_name,
    'active',
    now(),
    COALESCE(NEW.risk_reviewed_by, NEW.reviewed_by),
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    company_id = EXCLUDED.company_id,
    identity_mode = EXCLUDED.identity_mode,
    legal_name_normalized = EXCLUDED.legal_name_normalized,
    status = 'active',
    verified_at = now(),
    verified_by = EXCLUDED.verified_by,
    updated_at = now();

  UPDATE public.profiles
  SET status = 'active'::public.user_status,
      company_id = COALESCE(NEW.company_id, company_id),
      updated_at = now()
  WHERE user_id = NEW.user_id;

  IF v_identity_mode IN ('company_driver', 'owner_driver') THEN
    UPDATE public.drivers
    SET status = 'active'::public.status_enum,
        is_active = true,
        app_access = true,
        company_id = NEW.company_id,
        updated_at = now()
    WHERE user_id = NEW.user_id;

    UPDATE public.company_memberships
    SET status = 'active',
        role_in_company = CASE
          -- `driver` is not a valid company_memberships role. Company Driver
          -- authority is represented by profiles.role='driver'; membership uses
          -- the canonical non-owner member role.
          WHEN v_identity_mode = 'company_driver' AND role_in_company = 'owner' THEN 'member'
          ELSE role_in_company
        END,
        updated_at = now()
    WHERE user_id = NEW.user_id
      AND company_id = NEW.company_id;
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. A Driver identity moving away from ACTIVE immediately fails closed across
--    profile, membership and Driver runtime access. Re-activation is deliberately
--    NOT performed by this trigger; approval/review remains the positive gate.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fail_close_driver_access_on_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_identity_mode text;
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_company_id := OLD.company_id;
    v_identity_mode := OLD.identity_mode;
    v_status := 'closed';
  ELSE
    v_user_id := NEW.user_id;
    v_company_id := NEW.company_id;
    v_identity_mode := NEW.identity_mode;
    v_status := NEW.status;
  END IF;

  IF v_identity_mode NOT IN ('company_driver', 'owner_driver') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' OR v_status <> 'active' THEN
    UPDATE public.profiles
    SET status = 'pending'::public.user_status,
        updated_at = now()
    WHERE user_id = v_user_id
      AND role = 'driver';

    UPDATE public.company_memberships
    SET status = 'invited',
        updated_at = now()
    WHERE user_id = v_user_id
      AND company_id = v_company_id
      AND status = 'active';

    UPDATE public.drivers
    SET status = 'inactive'::public.status_enum,
        is_active = false,
        app_access = false,
        updated_at = now()
    WHERE user_id = v_user_id
      AND company_id = v_company_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.fail_close_driver_access_on_identity_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_close_driver_access_on_identity_change() FROM anon;
REVOKE ALL ON FUNCTION public.fail_close_driver_access_on_identity_change() FROM authenticated;

DROP TRIGGER IF EXISTS trg_fail_close_driver_access_on_identity_update
  ON public.platform_identity_registry;
CREATE TRIGGER trg_fail_close_driver_access_on_identity_update
  AFTER UPDATE OF status, company_id, identity_mode
  ON public.platform_identity_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.fail_close_driver_access_on_identity_change();

DROP TRIGGER IF EXISTS trg_fail_close_driver_access_on_identity_delete
  ON public.platform_identity_registry;
CREATE TRIGGER trg_fail_close_driver_access_on_identity_delete
  AFTER DELETE
  ON public.platform_identity_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.fail_close_driver_access_on_identity_change();

-- -----------------------------------------------------------------------------
-- 5. Conservative historical backfill. Only an already-approved, risk-clear,
--    fully compliant Driver onboarding with a matching active company, Driver,
--    profile and active membership can create a missing canonical identity.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_app record;
  v_existing public.platform_identity_registry%ROWTYPE;
  v_missing integer;
  v_expected_mode text;
  v_normalized_name text;
BEGIN
  FOR v_app IN
    SELECT oa.*
    FROM public.onboarding_applications oa
    JOIN public.companies c
      ON c.id = oa.company_id
     AND c.status::text = 'active'
    JOIN public.drivers d
      ON d.user_id = oa.user_id
     AND d.company_id = oa.company_id
    JOIN public.profiles p
      ON p.user_id = oa.user_id
     AND p.role = 'driver'
     AND p.company_id = oa.company_id
    JOIN public.company_memberships cm
      ON cm.user_id = oa.user_id
     AND cm.company_id = oa.company_id
     AND cm.status = 'active'
    WHERE oa.account_type IN ('owner_driver', 'individual_driver')
      AND oa.status::text = 'approved'
      AND oa.risk_status = 'clear'
    ORDER BY oa.created_at, oa.id
  LOOP
    v_expected_mode := CASE
      WHEN v_app.account_type = 'owner_driver' THEN 'owner_driver'
      ELSE 'company_driver'
    END;

    SELECT count(*)
    INTO v_missing
    FROM public.get_missing_onboarding_documents(v_app.id);

    IF v_missing <> 0 THEN
      CONTINUE;
    END IF;

    SELECT *
    INTO v_existing
    FROM public.platform_identity_registry identity
    WHERE identity.user_id = v_app.user_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_existing.company_id IS DISTINCT FROM v_app.company_id
         OR v_existing.identity_mode IS DISTINCT FROM v_expected_mode
      THEN
        RAISE EXCEPTION
          'Historical identity conflict for user %: onboarding would replace another company or identity mode.',
          v_app.user_id
          USING ERRCODE = '23505';
      END IF;

      CONTINUE;
    END IF;

    v_normalized_name := lower(trim(COALESCE(
      NULLIF(v_app.payload->>'full_name', ''),
      NULLIF(v_app.payload->>'contact_person', ''),
      split_part(v_app.email, '@', 1)
    )));

    INSERT INTO public.platform_identity_registry (
      user_id,
      company_id,
      identity_mode,
      legal_name_normalized,
      status,
      verified_at,
      verified_by,
      updated_at
    )
    VALUES (
      v_app.user_id,
      v_app.company_id,
      v_expected_mode,
      v_normalized_name,
      'active',
      COALESCE(v_app.reviewed_at, v_app.updated_at, now()),
      COALESCE(v_app.risk_reviewed_by, v_app.reviewed_by),
      now()
    );
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Reconcile historical rows that pre-date the identity gates. This does not
--    approve anyone. Missing/non-active identity means pending/invited/inactive.
-- -----------------------------------------------------------------------------
UPDATE public.profiles p
SET status = 'pending'::public.user_status,
    updated_at = now()
WHERE p.role = 'driver'
  AND p.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.platform_identity_registry identity
    WHERE identity.user_id = p.user_id
      AND identity.company_id = p.company_id
      AND identity.identity_mode IN ('company_driver', 'owner_driver')
      AND identity.status = 'active'
      AND identity.verified_at IS NOT NULL
  );

UPDATE public.company_memberships cm
SET status = 'invited',
    updated_at = now()
WHERE cm.status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = cm.user_id
      AND p.role = 'driver'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.platform_identity_registry identity
    WHERE identity.user_id = cm.user_id
      AND identity.company_id = cm.company_id
      AND identity.identity_mode IN ('company_driver', 'owner_driver')
      AND identity.status = 'active'
      AND identity.verified_at IS NOT NULL
  );

UPDATE public.drivers d
SET status = 'inactive'::public.status_enum,
    is_active = false,
    app_access = false,
    updated_at = now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.platform_identity_registry identity
  WHERE identity.user_id = d.user_id
    AND identity.company_id = d.company_id
    AND identity.identity_mode IN ('company_driver', 'owner_driver')
    AND identity.status = 'active'
    AND identity.verified_at IS NOT NULL
);

-- -----------------------------------------------------------------------------
-- 7. Final production/replay invariants.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_driver_app_access_without_identity integer;
  v_driver_active_without_identity integer;
  v_profile_active_without_identity integer;
  v_membership_active_without_identity integer;
  v_eligible_approved_without_identity integer;
BEGIN
  SELECT count(*) INTO v_driver_app_access_without_identity
  FROM public.drivers d
  WHERE d.app_access = true
    AND NOT EXISTS (
      SELECT 1 FROM public.platform_identity_registry identity
      WHERE identity.user_id = d.user_id
        AND identity.company_id = d.company_id
        AND identity.identity_mode IN ('company_driver', 'owner_driver')
        AND identity.status = 'active'
        AND identity.verified_at IS NOT NULL
    );

  SELECT count(*) INTO v_driver_active_without_identity
  FROM public.drivers d
  WHERE (d.status::text = 'active' OR d.is_active = true)
    AND NOT EXISTS (
      SELECT 1 FROM public.platform_identity_registry identity
      WHERE identity.user_id = d.user_id
        AND identity.company_id = d.company_id
        AND identity.identity_mode IN ('company_driver', 'owner_driver')
        AND identity.status = 'active'
        AND identity.verified_at IS NOT NULL
    );

  SELECT count(*) INTO v_profile_active_without_identity
  FROM public.profiles p
  WHERE p.role = 'driver'
    AND p.company_id IS NOT NULL
    AND p.status::text = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.platform_identity_registry identity
      WHERE identity.user_id = p.user_id
        AND identity.company_id = p.company_id
        AND identity.identity_mode IN ('company_driver', 'owner_driver')
        AND identity.status = 'active'
        AND identity.verified_at IS NOT NULL
    );

  SELECT count(*) INTO v_membership_active_without_identity
  FROM public.company_memberships cm
  JOIN public.profiles p ON p.user_id = cm.user_id AND p.role = 'driver'
  WHERE cm.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.platform_identity_registry identity
      WHERE identity.user_id = cm.user_id
        AND identity.company_id = cm.company_id
        AND identity.identity_mode IN ('company_driver', 'owner_driver')
        AND identity.status = 'active'
        AND identity.verified_at IS NOT NULL
    );

  SELECT count(*) INTO v_eligible_approved_without_identity
  FROM public.onboarding_applications oa
  JOIN public.companies c ON c.id = oa.company_id AND c.status::text = 'active'
  JOIN public.drivers d ON d.user_id = oa.user_id AND d.company_id = oa.company_id
  JOIN public.profiles p ON p.user_id = oa.user_id AND p.role = 'driver' AND p.company_id = oa.company_id
  JOIN public.company_memberships cm ON cm.user_id = oa.user_id AND cm.company_id = oa.company_id AND cm.status = 'active'
  WHERE oa.account_type IN ('owner_driver', 'individual_driver')
    AND oa.status::text = 'approved'
    AND oa.risk_status = 'clear'
    AND NOT EXISTS (
      SELECT 1 FROM public.get_missing_onboarding_documents(oa.id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.platform_identity_registry identity
      WHERE identity.user_id = oa.user_id
        AND identity.company_id = oa.company_id
        AND identity.identity_mode = CASE WHEN oa.account_type = 'owner_driver' THEN 'owner_driver' ELSE 'company_driver' END
        AND identity.status = 'active'
        AND identity.verified_at IS NOT NULL
    );

  IF v_driver_app_access_without_identity <> 0
     OR v_driver_active_without_identity <> 0
     OR v_profile_active_without_identity <> 0
     OR v_membership_active_without_identity <> 0
     OR v_eligible_approved_without_identity <> 0
  THEN
    RAISE EXCEPTION
      'Canonical Driver identity reconciliation failed: app_access_without_identity=%, active_driver_without_identity=%, active_profile_without_identity=%, active_membership_without_identity=%, eligible_approved_without_identity=%',
      v_driver_app_access_without_identity,
      v_driver_active_without_identity,
      v_profile_active_without_identity,
      v_membership_active_without_identity,
      v_eligible_approved_without_identity;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
