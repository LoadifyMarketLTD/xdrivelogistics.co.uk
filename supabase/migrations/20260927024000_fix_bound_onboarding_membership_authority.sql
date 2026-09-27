BEGIN;

ALTER FUNCTION public.submit_onboarding_application_base_v1(uuid)
  RENAME TO submit_onboarding_application_base_v1_legacy_20260927;

REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1_legacy_20260927(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_onboarding_application_base_v1(
  p_application_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_app public.onboarding_applications%ROWTYPE;
  v_company_id uuid;
  v_company_number text;
  v_payload_company_number text;
  v_membership_role text;
  v_next_status text;
  v_contact_email text;
  v_contact_phone text;
BEGIN
  SELECT *
    INTO v_app
  FROM public.onboarding_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_app.company_id IS NULL
     OR v_app.account_type NOT IN ('broker_shipper', 'customer_shipper') THEN
    RETURN public.submit_onboarding_application_base_v1_legacy_20260927(p_application_id);
  END IF;

  IF v_app.status NOT IN ('draft', 'in_progress', 'request_changes', 'submitted', 'under_review') THEN
    RAISE EXCEPTION 'Onboarding application cannot be submitted from status %.', v_app.status
      USING ERRCODE = '23514';
  END IF;

  v_company_id := v_app.company_id;

  SELECT NULLIF(trim(c.company_number), '')
    INTO v_company_number
  FROM public.companies c
  WHERE c.id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bound onboarding company does not exist.' USING ERRCODE = 'P0002';
  END IF;

  v_payload_company_number := NULLIF(trim(v_app.payload->>'company_number'), '');
  IF v_payload_company_number IS NOT NULL
     AND v_company_number IS NOT NULL
     AND regexp_replace(upper(v_payload_company_number), '[^A-Z0-9]', '', 'g')
         <> regexp_replace(upper(v_company_number), '[^A-Z0-9]', '', 'g') THEN
    RAISE EXCEPTION 'Bound onboarding company number does not match the application.'
      USING ERRCODE = '23514';
  END IF;

  SELECT cm.role_in_company
    INTO v_membership_role
  FROM public.company_memberships cm
  WHERE cm.company_id = v_company_id
    AND cm.user_id = v_app.user_id
    AND cm.status = 'active'
  LIMIT 1
  FOR UPDATE;

  IF v_membership_role IS NULL THEN
    RAISE EXCEPTION 'An active membership in the bound company is required before submission.'
      USING ERRCODE = '42501';
  END IF;

  v_contact_email := COALESCE(
    NULLIF(trim(v_app.payload->>'contact_email'), ''),
    NULLIF(trim(v_app.payload->>'email'), ''),
    v_app.email
  );
  v_contact_phone := COALESCE(
    NULLIF(trim(v_app.payload->>'contact_phone'), ''),
    NULLIF(trim(v_app.payload->>'phone'), ''),
    NULL
  );

  UPDATE public.company_memberships
  SET invited_email = COALESCE(v_contact_email, invited_email),
      status = 'active',
      updated_at = now()
  WHERE company_id = v_company_id
    AND user_id = v_app.user_id;

  UPDATE public.profiles
  SET full_name = COALESCE(
        NULLIF(trim(v_app.payload->>'full_name'), ''),
        NULLIF(trim(v_app.payload->>'contact_person'), ''),
        full_name
      ),
      phone = COALESCE(v_contact_phone, phone),
      company_id = v_company_id,
      role = CASE
        WHEN v_app.account_type = 'customer_shipper' THEN 'customer'
        WHEN v_app.account_type = 'broker_shipper' THEN 'broker'
        ELSE role
      END,
      updated_at = now()
  WHERE user_id = v_app.user_id;

  v_next_status := CASE
    WHEN v_app.account_type = 'customer_shipper' THEN 'approved'
    ELSE 'under_review'
  END;

  UPDATE public.onboarding_applications
  SET status = v_next_status,
      company_id = v_company_id,
      current_step = CASE
        WHEN v_next_status = 'approved' THEN 'workspace_unlocked'
        ELSE 'pending_review'
      END,
      completion_percentage = 100,
      submitted_at = COALESCE(submitted_at, now()),
      last_activity_at = now()
  WHERE id = v_app.id;

  RETURN v_company_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_onboarding_application_base_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.review_onboarding_application_atomic_authority_base_v1(uuid, uuid, text, text)
  RENAME TO review_onboarding_application_atomic_authority_base_v1_legacy_20260927;

REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic_authority_base_v1_legacy_20260927(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.review_onboarding_application_atomic_authority_base_v1(
  p_application_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(onboarding_application_id uuid, status text, company_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_id uuid;
  v_existing_membership_role text;
BEGIN
  SELECT oa.company_id
    INTO v_company_id
  FROM public.onboarding_applications oa
  WHERE oa.id = p_application_id;

  IF p_action = 'approve' AND v_company_id IS NOT NULL THEN
    SELECT cm.role_in_company
      INTO v_existing_membership_role
    FROM public.company_memberships cm
    WHERE cm.company_id = v_company_id
      AND cm.user_id = (
        SELECT oa.user_id
        FROM public.onboarding_applications oa
        WHERE oa.id = p_application_id
      )
      AND cm.status = 'active'
    LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.review_onboarding_application_atomic_authority_base_v1_legacy_20260927(
    p_application_id,
    p_actor_user_id,
    p_action,
    p_notes
  );

  IF p_action = 'approve' AND v_existing_membership_role IS NOT NULL THEN
    UPDATE public.company_memberships cm
    SET role_in_company = v_existing_membership_role,
        updated_at = now()
    WHERE cm.company_id = v_company_id
      AND cm.user_id = (
        SELECT oa.user_id
        FROM public.onboarding_applications oa
        WHERE oa.id = p_application_id
      );
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic_authority_base_v1(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
