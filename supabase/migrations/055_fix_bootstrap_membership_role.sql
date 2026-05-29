-- Migration 055: Fix bootstrap_company_membership() — invalid role 'member'
--
-- Root cause (Part 2 / Part 6 of forensic report):
--   Migration 050 assigned role_in_company = 'member' for admin-assigned users.
--   'member' is NOT a valid value of the public.company_role enum.
--   Valid values: 'owner', 'admin', 'dispatcher', 'viewer'.
--   This caused a runtime type error whenever bootstrap tried to create such a row.
--
-- Fix:
--   Replace 'member' with 'viewer' — the lowest-privilege valid role that
--   satisfies is_company_member() checks without granting write access.
--   The function is otherwise identical to migration 050.

CREATE OR REPLACE FUNCTION public.bootstrap_company_membership()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_company_id uuid;
  v_is_creator boolean;
  v_role       public.company_role;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Resolve company_id from profile
  SELECT company_id INTO v_company_id
  FROM   public.profiles
  WHERE  user_id = v_user_id
  LIMIT  1;

  -- 2. If no company in profile, fall back to get_or_create_company_for_user
  IF v_company_id IS NULL THEN
    RETURN public.get_or_create_company_for_user();
  END IF;

  -- 3. Already have an active membership? Nothing to do.
  IF EXISTS (
    SELECT 1
    FROM   public.company_memberships
    WHERE  user_id    = v_user_id
      AND  company_id = v_company_id
      AND  status    <> 'suspended'
  ) THEN
    RETURN v_company_id;
  END IF;

  -- 4. Determine role: owner if creator, otherwise viewer (lowest valid enum value)
  SELECT (created_by = v_user_id) INTO v_is_creator
  FROM   public.companies
  WHERE  id = v_company_id;

  v_role := CASE WHEN v_is_creator THEN 'owner'::public.company_role
                 ELSE 'viewer'::public.company_role
            END;

  -- 5. Upsert the missing membership row
  INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status)
  VALUES (v_company_id, v_user_id, v_role, 'active')
  ON CONFLICT (company_id, user_id)
    DO UPDATE SET status = 'active', role_in_company = EXCLUDED.role_in_company;

  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_company_membership() TO authenticated;

NOTIFY pgrst, 'reload schema';
