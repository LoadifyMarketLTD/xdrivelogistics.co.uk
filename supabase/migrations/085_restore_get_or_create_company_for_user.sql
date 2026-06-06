-- Migration 085: Restore RPC compatibility for get_or_create_company_for_user()
--
-- Some production schemas are missing the zero-argument RPC signature expected
-- by the web client, causing PostgREST PGRST202:
-- "Could not find the function public.get_or_create_company_for_user without parameters".
--
-- This migration re-creates the canonical no-arg function and grants execute to
-- authenticated users. Safe to run repeatedly.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_or_create_company_for_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_user_id    uuid := auth.uid();
  v_user_email text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user is required to provision company context.';
  END IF;

  -- 1) Existing active/non-suspended membership
  SELECT company_id INTO v_company_id
  FROM public.company_memberships
  WHERE user_id = v_user_id
    AND status <> 'suspended'
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

  -- 2) Existing company created by this user (missing membership row)
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE created_by = v_user_id
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status)
    VALUES (v_company_id, v_user_id, 'owner', 'active')
    ON CONFLICT (company_id, user_id) DO UPDATE
      SET role_in_company = 'owner',
          status = 'active';

    RETURN v_company_id;
  END IF;

  -- 3) First-time provisioning
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO public.companies (name, email, created_by)
  VALUES (COALESCE(v_user_email, 'My Company'), v_user_email, v_user_id)
  RETURNING id INTO v_company_id;

  INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status)
  VALUES (v_company_id, v_user_id, 'owner', 'active');

  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_company_for_user() TO authenticated;

COMMIT;
