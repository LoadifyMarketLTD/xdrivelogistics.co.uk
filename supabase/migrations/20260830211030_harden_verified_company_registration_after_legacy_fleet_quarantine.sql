BEGIN;

-- Quarantined legacy Fleet shells are retained historical records, not current
-- company authority. The verified registration path may ignore only shells with
-- an explicit P0-12 MIGRATE resolution; every other existing company remains a
-- conservative blocker. created_by alone can authorize reuse only while the
-- matching company is still pending approval.
CREATE OR REPLACE FUNCTION public.register_validated_company_atomic(
  p_actor_user_id uuid,
  p_company_number text,
  p_company_name text,
  p_registry_status text,
  p_account_type text
)
RETURNS TABLE (
  success boolean,
  http_status integer,
  error_code text,
  error_message text,
  company_id uuid,
  created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_company_number text := regexp_replace(upper(trim(coalesce(p_company_number, ''))), '[^A-Z0-9]', '', 'g');
  v_company_name text := trim(coalesce(p_company_name, ''));
  v_registry_status text := lower(trim(coalesce(p_registry_status, '')));
  v_account_type text := lower(trim(coalesce(p_account_type, '')));
  v_company_type text;
  v_company public.companies%ROWTYPE;
  v_match_count integer := 0;
  v_other_company_count integer := 0;
  v_authorized boolean := false;
  v_created boolean := false;
BEGIN
  IF p_actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_actor_user_id
  ) THEN
    RETURN QUERY SELECT false, 401, 'INVALID_ACTOR', 'Authenticated actor is required.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_company_number !~ '^[A-Z0-9]{6,16}$' THEN
    RETURN QUERY SELECT false, 400, 'INVALID_COMPANY_NUMBER', 'Company number is invalid.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_company_name = '' OR length(v_company_name) > 500 THEN
    RETURN QUERY SELECT false, 400, 'INVALID_COMPANY_NAME', 'Company name is invalid.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_registry_status <> 'active' THEN
    RETURN QUERY SELECT false, 409, 'REGISTRY_STATUS_NOT_ACTIVE', 'Only active Companies House records may register.', NULL::uuid, false;
    RETURN;
  END IF;

  IF v_account_type = 'broker_shipper' THEN
    v_company_type := 'broker';
  ELSIF v_account_type = 'fleet_courier' THEN
    v_company_type := 'carrier';
  ELSE
    RETURN QUERY SELECT false, 400, 'INVALID_ACCOUNT_TYPE', 'Company registration is limited to broker and fleet accounts.', NULL::uuid, false;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('register-company-user:' || p_actor_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('register-company-number:' || v_company_number, 0));

  SELECT c.*
  INTO v_company
  FROM public.company_registration_claims claim
  JOIN public.companies c ON c.id = claim.company_id
  WHERE claim.company_number = v_company_number
    AND NOT EXISTS (
      SELECT 1
      FROM public.legacy_fleet_onboarding_resolutions r
      WHERE r.legacy_company_id = c.id
        AND r.classification = 'MIGRATE'
        AND r.resolution_code = 'quarantine_legacy_active_shell'
    )
  FOR UPDATE OF claim, c;

  IF NOT FOUND THEN
    SELECT count(*)
    INTO v_match_count
    FROM public.companies c
    WHERE regexp_replace(upper(trim(coalesce(c.company_number, ''))), '[^A-Z0-9]', '', 'g') = v_company_number
      AND NOT EXISTS (
        SELECT 1
        FROM public.legacy_fleet_onboarding_resolutions r
        WHERE r.legacy_company_id = c.id
          AND r.classification = 'MIGRATE'
          AND r.resolution_code = 'quarantine_legacy_active_shell'
      );

    IF v_match_count > 1 THEN
      RETURN QUERY SELECT false, 409, 'DUPLICATE_LEGACY_COMPANIES',
        'Multiple existing companies use this company number. An administrator must resolve them.', NULL::uuid, false;
      RETURN;
    END IF;

    IF v_match_count = 1 THEN
      SELECT c.*
      INTO v_company
      FROM public.companies c
      WHERE regexp_replace(upper(trim(coalesce(c.company_number, ''))), '[^A-Z0-9]', '', 'g') = v_company_number
        AND NOT EXISTS (
          SELECT 1
          FROM public.legacy_fleet_onboarding_resolutions r
          WHERE r.legacy_company_id = c.id
            AND r.classification = 'MIGRATE'
            AND r.resolution_code = 'quarantine_legacy_active_shell'
        )
      FOR UPDATE;
    END IF;
  END IF;

  IF v_company.id IS NOT NULL THEN
    SELECT (
      (v_company.status::text = 'pending_approval' AND v_company.created_by = p_actor_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.company_memberships cm
        WHERE cm.company_id = v_company.id
          AND cm.user_id = p_actor_user_id
          AND cm.status = 'active'
          AND cm.role_in_company = 'owner'
      )
    )
    INTO v_authorized;

    IF NOT v_authorized THEN
      RETURN QUERY SELECT false, 409, 'COMPANY_ALREADY_REGISTERED',
        'This company number is already registered to another account.', NULL::uuid, false;
      RETURN;
    END IF;

    SELECT count(DISTINCT c.id)
    INTO v_other_company_count
    FROM public.companies c
    WHERE c.id <> v_company.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.legacy_fleet_onboarding_resolutions r
        WHERE r.legacy_company_id = c.id
          AND r.classification = 'MIGRATE'
          AND r.resolution_code = 'quarantine_legacy_active_shell'
      )
      AND (
        c.created_by = p_actor_user_id
        OR EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id = c.id
            AND cm.user_id = p_actor_user_id
            AND cm.status = 'active'
            AND cm.role_in_company = 'owner'
        )
      );

    IF v_other_company_count > 0 THEN
      RETURN QUERY SELECT false, 409, 'ACCOUNT_HAS_MULTIPLE_COMPANIES',
        'This account is linked to another company. An administrator must confirm the correct company.', NULL::uuid, false;
      RETURN;
    END IF;

    v_created := false;
  ELSE
    SELECT count(DISTINCT c.id)
    INTO v_other_company_count
    FROM public.companies c
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.legacy_fleet_onboarding_resolutions r
        WHERE r.legacy_company_id = c.id
          AND r.classification = 'MIGRATE'
          AND r.resolution_code = 'quarantine_legacy_active_shell'
      )
      AND (
        c.created_by = p_actor_user_id
        OR EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id = c.id
            AND cm.user_id = p_actor_user_id
            AND cm.status = 'active'
            AND cm.role_in_company = 'owner'
        )
      );

    IF v_other_company_count > 0 THEN
      RETURN QUERY SELECT false, 409, 'ACCOUNT_ALREADY_LINKED_TO_COMPANY',
        'This account is already linked to another company.', NULL::uuid, false;
      RETURN;
    END IF;

    INSERT INTO public.companies (
      name,
      company_number,
      status,
      company_type,
      created_by
    )
    VALUES (
      v_company_name,
      v_company_number,
      'pending_approval',
      v_company_type,
      p_actor_user_id
    )
    RETURNING * INTO v_company;

    v_created := true;
  END IF;

  UPDATE public.companies
  SET name = v_company_name,
      company_number = v_company_number,
      company_type = v_company_type
  WHERE id = v_company.id;

  INSERT INTO public.company_registration_claims (
    company_number,
    company_id,
    claimed_by,
    registry_name,
    registry_status,
    updated_at
  )
  VALUES (
    v_company_number,
    v_company.id,
    p_actor_user_id,
    v_company_name,
    v_registry_status,
    now()
  )
  ON CONFLICT (company_number)
  DO UPDATE SET
    registry_name = EXCLUDED.registry_name,
    registry_status = EXCLUDED.registry_status,
    updated_at = now()
  WHERE public.company_registration_claims.company_id = EXCLUDED.company_id
    AND public.company_registration_claims.claimed_by = EXCLUDED.claimed_by;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_registration_claims claim
    WHERE claim.company_number = v_company_number
      AND claim.company_id = v_company.id
      AND claim.claimed_by = p_actor_user_id
  ) THEN
    RETURN QUERY SELECT false, 409, 'COMPANY_CLAIM_CONFLICT',
      'The company number was claimed by another registration.', NULL::uuid, false;
    RETURN;
  END IF;

  INSERT INTO public.company_memberships (
    company_id,
    user_id,
    role_in_company,
    status,
    updated_at
  )
  VALUES (
    v_company.id,
    p_actor_user_id,
    'owner',
    'active',
    now()
  )
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET
    role_in_company = 'owner',
    status = 'active',
    updated_at = now();

  UPDATE public.profiles
  SET company_id = COALESCE(company_id, v_company.id),
      updated_at = now()
  WHERE user_id = p_actor_user_id;

  INSERT INTO public.company_registration_audit (
    actor_user_id,
    company_id,
    company_number,
    action,
    metadata
  )
  VALUES (
    p_actor_user_id,
    v_company.id,
    v_company_number,
    CASE WHEN v_created THEN 'created' ELSE 'reused' END,
    jsonb_build_object(
      'registered_name', v_company_name,
      'registry_status', v_registry_status,
      'account_type', v_account_type,
      'source', 'companies_house_server_validation'
    )
  );

  RETURN QUERY SELECT true, CASE WHEN v_created THEN 201 ELSE 200 END,
    NULL::text, NULL::text, v_company.id, v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.register_validated_company_atomic(uuid, text, text, text, text) IS
  'Server-authenticated Companies House verified broker/fleet registration. Explicitly quarantined legacy Fleet shells are historical evidence only and never company authority.';

NOTIFY pgrst, 'reload schema';
COMMIT;
