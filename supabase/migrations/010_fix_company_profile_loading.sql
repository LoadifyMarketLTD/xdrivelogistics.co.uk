-- ============================================================
-- 010_fix_company_profile_loading.sql
--
-- Fixes "Company profile not loaded yet" error caused by a
-- circular RLS dependency:
--   - company_memberships SELECT policy required is_company_member()
--     which only returns true for status='active', so users with
--     'invited' (default) status or no membership could never load
--     their company profile.
--   - companies SELECT policy had the same issue.
--
-- Changes:
--   1) company_memberships: allow users to SELECT their own rows
--   2) companies: allow SELECT for member or creator
--   3) get_or_create_company_for_user(): SECURITY DEFINER function
--      that returns the caller's company_id, creating a default
--      company + owner membership if none exists.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1) Fix company_memberships SELECT policy
--    Replace the is_company_member() guard (active-only) with a
--    simple "own row" check so every authenticated user can read
--    their own membership record regardless of status.
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "memberships_select_member" ON public.company_memberships;

CREATE POLICY "memberships_select_own"
  ON public.company_memberships
  FOR SELECT
  USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- 2) Fix companies SELECT policy
--    Allow a user to see a company if they have any non-suspended
--    membership OR if they are the creator (created_by).
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "companies_select_member" ON public.companies;

CREATE POLICY "companies_select_member_or_creator"
  ON public.companies
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company_memberships
      WHERE company_id = id
        AND user_id    = auth.uid()
        AND status    <> 'suspended'
    )
  );

-- ──────────────────────────────────────────────────────────────
-- 3) get_or_create_company_for_user()
--    Returns the company_id for the calling authenticated user.
--    Resolution order:
--      a) Any non-suspended membership row
--      b) A company the user created (creates membership if missing)
--      c) Creates a brand-new company + owner membership
--    SECURITY DEFINER so it can bypass RLS for the provisioning
--    steps while still using auth.uid() for the caller identity.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_or_create_company_for_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_user_id    uuid  := auth.uid();
  v_user_email text;
BEGIN
  -- a) Existing membership (any non-suspended status)
  SELECT company_id INTO v_company_id
  FROM public.company_memberships
  WHERE user_id = v_user_id
    AND status <> 'suspended'
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    RETURN v_company_id;
  END IF;

  -- b) Company created by this user (no membership record yet)
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE created_by = v_user_id
  LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status)
    VALUES (v_company_id, v_user_id, 'owner', 'active')
    ON CONFLICT (company_id, user_id)
    DO UPDATE SET status = 'active', role_in_company = 'owner';

    RETURN v_company_id;
  END IF;

  -- c) No company at all — provision a default one
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO public.companies (name, email, created_by)
  VALUES (
    COALESCE(v_user_email, 'My Company'),
    v_user_email,
    v_user_id
  )
  RETURNING id INTO v_company_id;

  INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status)
  VALUES (v_company_id, v_user_id, 'owner', 'active');

  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_company_for_user() TO authenticated;

COMMIT;
