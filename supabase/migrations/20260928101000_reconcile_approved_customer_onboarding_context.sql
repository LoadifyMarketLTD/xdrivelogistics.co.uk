BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $repair$
DECLARE
  v_app public.onboarding_applications%ROWTYPE;
  v_company_id uuid;
  v_company_name text;
  v_contact_email text;
  v_contact_phone text;
  v_billing_address text;
  v_existing_company_count integer;
  v_existing_membership_count integer;
BEGIN
  FOR v_app IN
    SELECT *
    FROM public.onboarding_applications
    WHERE status = 'approved'
      AND account_type = 'customer_shipper'
      AND company_id IS NULL
    ORDER BY created_at
    FOR UPDATE
  LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_app.user_id) THEN
      RAISE EXCEPTION 'Approved customer onboarding % references a missing auth user.', v_app.id
        USING ERRCODE = '23503';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = v_app.user_id
        AND COALESCE(p.status::text, '') = 'active'
        AND lower(COALESCE(p.role, '')) = 'customer'
    ) THEN
      RAISE EXCEPTION 'Approved customer onboarding % does not have an active customer profile.', v_app.id
        USING ERRCODE = '23514';
    END IF;

    SELECT count(*) INTO v_existing_company_count
    FROM public.companies c
    WHERE c.created_by = v_app.user_id;

    SELECT count(*) INTO v_existing_membership_count
    FROM public.company_memberships cm
    WHERE cm.user_id = v_app.user_id;

    IF v_existing_company_count <> 0 OR v_existing_membership_count <> 0 THEN
      RAISE EXCEPTION
        'Approved customer onboarding % has ambiguous pre-existing company context (companies %, memberships %).',
        v_app.id, v_existing_company_count, v_existing_membership_count
        USING ERRCODE = '23514';
    END IF;

    v_company_name := COALESCE(
      NULLIF(trim(v_app.payload->>'company_name'), ''),
      NULLIF(trim(v_app.payload->>'full_name'), ''),
      split_part(v_app.email, '@', 1) || ' workspace'
    );
    v_contact_email := COALESCE(
      NULLIF(trim(v_app.payload->>'contact_email'), ''),
      NULLIF(trim(v_app.payload->>'email'), ''),
      v_app.email
    );
    v_contact_phone := COALESCE(
      NULLIF(trim(v_app.payload->>'contact_phone'), ''),
      NULLIF(trim(v_app.payload->>'phone'), '')
    );
    v_billing_address := COALESCE(
      NULLIF(trim(v_app.payload->>'billing_address'), ''),
      NULLIF(trim(v_app.payload->>'address'), '')
    );

    INSERT INTO public.companies (
      name,
      legal_name,
      trading_name,
      email,
      phone,
      address_line1,
      country,
      status,
      company_type,
      created_by
    )
    VALUES (
      v_company_name,
      v_company_name,
      v_company_name,
      v_contact_email,
      v_contact_phone,
      v_billing_address,
      'GB',
      'active'::public.company_status,
      'customer',
      v_app.user_id
    )
    RETURNING id INTO v_company_id;

    INSERT INTO public.company_memberships (
      company_id,
      user_id,
      invited_email,
      role_in_company,
      status,
      updated_at
    )
    VALUES (
      v_company_id,
      v_app.user_id,
      v_contact_email,
      'admin',
      'active',
      now()
    );

    UPDATE public.profiles
    SET company_id = v_company_id,
        role = 'customer',
        status = 'active',
        updated_at = now()
    WHERE user_id = v_app.user_id;

    UPDATE public.onboarding_applications
    SET company_id = v_company_id,
        last_activity_at = now()
    WHERE id = v_app.id;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.onboarding_applications a
    WHERE a.status = 'approved'
      AND a.account_type = 'customer_shipper'
      AND (
        a.company_id IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.user_id = a.user_id
            AND p.company_id = a.company_id
            AND COALESCE(p.status::text, '') = 'active'
            AND lower(COALESCE(p.role, '')) = 'customer'
        )
        OR NOT EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.user_id = a.user_id
            AND cm.company_id = a.company_id
            AND cm.status = 'active'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Approved customer onboarding company-context invariant is still violated.'
      USING ERRCODE = '23514';
  END IF;
END;
$repair$;

COMMIT;
