-- 065_owner_driver_workspace_bootstrap.sql
-- Bootstrap personal workspace for owner-driver accounts.

CREATE OR REPLACE FUNCTION public.bootstrap_owner_driver_workspace()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_profile_role text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role, company_id
  INTO v_profile_role, v_company_id
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_profile_role IS NOT NULL AND LOWER(v_profile_role) NOT IN ('driver', 'owner_driver') THEN
    RETURN v_company_id;
  END IF;

  IF v_company_id IS NULL THEN
    v_company_id := public.get_or_create_company_for_user();
  END IF;

  UPDATE public.profiles
  SET role = 'driver',
      is_driver = TRUE,
      company_id = COALESCE(company_id, v_company_id),
      updated_at = NOW()
  WHERE user_id = v_user_id;

  INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status, updated_at)
  VALUES (v_company_id, v_user_id, 'owner', 'active', NOW())
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET role_in_company = 'owner',
                status = 'active',
                updated_at = EXCLUDED.updated_at;

  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_owner_driver_workspace() TO authenticated;

NOTIFY pgrst, 'reload schema';
