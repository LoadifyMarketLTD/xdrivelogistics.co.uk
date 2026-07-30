-- Backfill canonical Company Driver role activation and company compliance subject selection.
-- Applies to environments where earlier migrations are already installed.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.assert_company_compliance_ready(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application_id uuid;
BEGIN
  SELECT application.id
  INTO v_application_id
  FROM public.companies company
  JOIN public.onboarding_applications application
    ON application.user_id = company.created_by
   AND (
     application.company_id = company.id
     OR application.company_id IS NULL
   )
  WHERE company.id = p_company_id
    AND EXISTS (
      SELECT 1
      FROM public.compliance_document_requirements requirement
      WHERE requirement.account_type = application.account_type
        AND requirement.document_family = 'company'
        AND requirement.required = true
        AND requirement.active = true
    )
  ORDER BY
    CASE WHEN application.company_id = company.id THEN 0 ELSE 1 END,
    application.created_at DESC
  LIMIT 1;

  IF v_application_id IS NULL THEN
    RAISE EXCEPTION
      'Cannot activate company without a linked onboarding application.'
      USING ERRCODE = '23514';
  END IF;

  PERFORM public.assert_onboarding_compliance_ready(v_application_id);
END;
$$;

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
    NEW.risk_reviewed_by,
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
  SET status = 'active',
      company_id = COALESCE(NEW.company_id, company_id),
      updated_at = now()
  WHERE user_id = NEW.user_id;

  IF v_identity_mode IN ('company_driver', 'owner_driver') THEN
    UPDATE public.drivers
    SET status = 'active',
        app_access = true,
        company_id = NEW.company_id,
        updated_at = now()
    WHERE user_id = NEW.user_id;

    UPDATE public.company_memberships
    SET status = 'active',
        role_in_company = CASE
          WHEN v_identity_mode = 'company_driver' AND role_in_company = 'owner' THEN 'driver'
          ELSE role_in_company
        END,
        updated_at = now()
    WHERE user_id = NEW.user_id
      AND company_id = NEW.company_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_company_compliance_ready(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_company_compliance_ready(uuid) TO service_role;

COMMIT;
