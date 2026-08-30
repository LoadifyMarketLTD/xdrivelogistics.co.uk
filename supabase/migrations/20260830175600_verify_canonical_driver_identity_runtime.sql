BEGIN;

-- P0-02 production proof. Every mutation below runs inside an exception
-- subtransaction and is rolled back deliberately, leaving production rows
-- unchanged after the assertions complete.
DO $$
DECLARE
  v_active_identity_id uuid;
  v_active_user_id uuid;
  v_active_company_id uuid;
  v_driver_id uuid;
  v_profile_status text;
  v_membership_status text;
  v_driver_status text;
  v_driver_is_active boolean;
  v_driver_app_access boolean;
  v_unverified_driver_id uuid;
  v_unverified_user_id uuid;
  v_unverified_company_id uuid;
BEGIN
  SELECT i.id, i.user_id, i.company_id, d.id,
         p.status::text, cm.status, d.status::text, d.is_active, d.app_access
  INTO v_active_identity_id, v_active_user_id, v_active_company_id, v_driver_id,
       v_profile_status, v_membership_status, v_driver_status,
       v_driver_is_active, v_driver_app_access
  FROM public.platform_identity_registry i
  JOIN public.drivers d ON d.user_id = i.user_id AND d.company_id = i.company_id
  JOIN public.profiles p ON p.user_id = i.user_id
  JOIN public.company_memberships cm ON cm.user_id = i.user_id AND cm.company_id = i.company_id
  WHERE i.identity_mode IN ('company_driver', 'owner_driver')
    AND i.status = 'active'
    AND i.verified_at IS NOT NULL
  ORDER BY i.created_at
  LIMIT 1;

  IF v_active_identity_id IS NOT NULL THEN
    BEGIN
      UPDATE public.platform_identity_registry
      SET status = 'on_hold', updated_at = now()
      WHERE id = v_active_identity_id;

      IF EXISTS (
        SELECT 1 FROM public.drivers
        WHERE id = v_driver_id
          AND (status::text <> 'inactive' OR is_active IS DISTINCT FROM false OR app_access IS DISTINCT FROM false)
      ) THEN
        RAISE EXCEPTION 'Identity hold did not fail-close Driver runtime access.';
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = v_active_user_id AND role = 'driver' AND status::text <> 'pending'
      ) THEN
        RAISE EXCEPTION 'Identity hold did not fail-close Driver profile status.';
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.company_memberships
        WHERE user_id = v_active_user_id AND company_id = v_active_company_id AND status <> 'invited'
      ) THEN
        RAISE EXCEPTION 'Identity hold did not fail-close Driver membership.';
      END IF;

      RAISE EXCEPTION USING ERRCODE = 'PZ021', MESSAGE = 'rollback identity hold proof';
    EXCEPTION WHEN SQLSTATE 'PZ021' THEN
      NULL;
    END;

    IF NOT EXISTS (
      SELECT 1 FROM public.platform_identity_registry i
      JOIN public.drivers d ON d.user_id = i.user_id AND d.company_id = i.company_id
      JOIN public.profiles p ON p.user_id = i.user_id
      JOIN public.company_memberships cm ON cm.user_id = i.user_id AND cm.company_id = i.company_id
      WHERE i.id = v_active_identity_id
        AND i.status = 'active'
        AND p.status::text = v_profile_status
        AND cm.status = v_membership_status
        AND d.status::text = v_driver_status
        AND d.is_active IS NOT DISTINCT FROM v_driver_is_active
        AND d.app_access IS NOT DISTINCT FROM v_driver_app_access
    ) THEN
      RAISE EXCEPTION 'Identity hold proof did not roll back cleanly.';
    END IF;
  END IF;

  SELECT d.id, d.user_id, d.company_id
  INTO v_unverified_driver_id, v_unverified_user_id, v_unverified_company_id
  FROM public.drivers d
  WHERE NOT EXISTS (
    SELECT 1 FROM public.platform_identity_registry i
    WHERE i.user_id = d.user_id
      AND i.company_id = d.company_id
      AND i.identity_mode IN ('company_driver', 'owner_driver')
      AND i.status = 'active'
      AND i.verified_at IS NOT NULL
  )
  ORDER BY d.created_at
  LIMIT 1;

  IF v_unverified_driver_id IS NOT NULL THEN
    BEGIN
      UPDATE public.drivers
      SET status = 'active'::public.status_enum,
          is_active = true,
          app_access = true,
          updated_at = now()
      WHERE id = v_unverified_driver_id;

      IF EXISTS (
        SELECT 1 FROM public.drivers
        WHERE id = v_unverified_driver_id
          AND (status::text <> 'inactive' OR is_active IS DISTINCT FROM false OR app_access IS DISTINCT FROM false)
      ) THEN
        RAISE EXCEPTION 'Unverified Driver activation attempt escaped the identity gate.';
      END IF;

      RAISE EXCEPTION USING ERRCODE = 'PZ022', MESSAGE = 'rollback unverified Driver proof';
    EXCEPTION WHEN SQLSTATE 'PZ022' THEN
      NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE (d.status::text = 'active' OR d.is_active = true OR d.app_access = true)
      AND NOT EXISTS (
        SELECT 1 FROM public.platform_identity_registry i
        WHERE i.user_id = d.user_id
          AND i.company_id = d.company_id
          AND i.identity_mode IN ('company_driver', 'owner_driver')
          AND i.status = 'active'
          AND i.verified_at IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'Runtime proof finished with operational Driver authority missing canonical identity.';
  END IF;
END;
$$;

COMMIT;
