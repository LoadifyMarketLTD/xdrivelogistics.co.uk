-- Owner Driver submission creates the company before the onboarding row receives
-- company_id. The identity gate must bind that same application to the newly
-- created company, not misclassify it as an unlinked Company Driver conflict.

BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_company_driver_onboarding(
  p_user_id uuid,
  p_company_id uuid,
  p_display_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.onboarding_applications%ROWTYPE;
  v_email text;
  v_application_id uuid;
BEGIN
  SELECT *
  INTO v_existing
  FROM public.onboarding_applications application
  WHERE application.user_id = p_user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.account_type = 'owner_driver' THEN
      IF v_existing.company_id IS NULL THEN
        UPDATE public.onboarding_applications
        SET company_id = p_company_id,
            payload = jsonb_set(
              COALESCE(payload, '{}'::jsonb),
              '{canonical_account_type}',
              '"owner_driver"'::jsonb,
              true
            ),
            last_activity_at = now()
        WHERE id = v_existing.id;

        RETURN v_existing.id;
      END IF;

      IF v_existing.company_id <> p_company_id THEN
        RAISE EXCEPTION
          'Identity conflict: this Owner Operator is already linked to another company.'
          USING ERRCODE = '23505';
      END IF;

      RETURN v_existing.id;
    END IF;

    IF v_existing.account_type = 'individual_driver' THEN
      IF v_existing.company_id IS NULL THEN
        RAISE EXCEPTION
          'Identity conflict: an unlinked historical driver application requires Platform Owner review before company assignment.'
          USING ERRCODE = '23505';
      END IF;

      IF v_existing.company_id <> p_company_id THEN
        RAISE EXCEPTION
          'Identity conflict: this Company Driver is already linked to another company.'
          USING ERRCODE = '23505';
      END IF;

      RETURN v_existing.id;
    END IF;

    RAISE EXCEPTION
      'Identity conflict: this user already has % onboarding and cannot be invited as a Company Driver.',
      v_existing.account_type
      USING ERRCODE = '23505';
  END IF;

  SELECT user_record.email
  INTO v_email
  FROM auth.users user_record
  WHERE user_record.id = p_user_id;

  INSERT INTO public.onboarding_applications (
    user_id,
    email,
    account_type,
    status,
    current_step,
    completion_percentage,
    company_id,
    payload,
    last_activity_at
  )
  VALUES (
    p_user_id,
    COALESCE(v_email, 'unknown@xdrive.local'),
    'individual_driver',
    'invited',
    'identity_details',
    5,
    p_company_id,
    jsonb_strip_nulls(jsonb_build_object(
      'canonical_account_type', 'company_driver',
      'invited_by_company_id', p_company_id,
      'full_name', p_display_name,
      'phone', p_phone,
      'email', v_email
    )),
    now()
  )
  RETURNING id INTO v_application_id;

  RETURN v_application_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_company_driver_onboarding(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_company_driver_onboarding(uuid, uuid, text, text) TO service_role;

COMMIT;
