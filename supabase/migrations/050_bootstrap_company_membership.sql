-- Migration 050: bootstrap_company_membership()
--
-- Problem:
--   Several runtime flows (Documents driver dropdown, Quotes company context)
--   break because a user has profiles.company_id set but no matching row in
--   company_memberships. Every RLS policy that calls is_company_member() then
--   silently returns 0 rows — no error, just empty results.
--
--   get_or_create_company_for_user() cannot safely fix this because for users
--   whose company was assigned by an admin (profiles.company_id set manually,
--   no companies.created_by match) it would auto-provision a NEW empty company
--   instead of reusing the existing one.
--
-- Fix:
--   A new SECURITY DEFINER function bootstrap_company_membership() that:
--     1. Reads the current user's profiles.company_id.
--     2. If the user already has an active membership for that company → no-op.
--     3. If the user IS the company creator → upsert an owner membership.
--     4. Otherwise (admin-assigned company) → upsert a member membership so
--        RLS is_company_member checks start passing immediately.
--   Returns the resolved company_id (same as profiles.company_id).
--
--   This is safe to call multiple times (idempotent ON CONFLICT DO NOTHING/UPDATE).

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
  v_role       text;
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

  -- 4. Determine role: owner if creator, otherwise member
  SELECT (created_by = v_user_id) INTO v_is_creator
  FROM   public.companies
  WHERE  id = v_company_id;

  v_role := CASE WHEN v_is_creator THEN 'owner' ELSE 'member' END;

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
